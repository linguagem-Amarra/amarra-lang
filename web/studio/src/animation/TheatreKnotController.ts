import * as theatreNamespace from '@theatre/core'
import { getDoubleOverhandTimeline, theatreProjectId, timelineState } from '../knots/doubleOverhandTimeline'

// Core 0.7 é CommonJS: Node e o pré-bundle do Vite expõem namespaces distintos.
const theatre = (theatreNamespace as typeof theatreNamespace & { default?: typeof theatreNamespace }).default ?? theatreNamespace
const { createRafDriver, getProject, onChange, types, val } = theatre

let nextInstance = 0
const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0))

/** Cada motor tem seu playhead; as curvas do projeto são compartilhadas no Studio. */
export class TheatreKnotController {
  private layout = getDoubleOverhandTimeline()
  private project = getProject(theatreProjectId, { state: timelineState })
  readonly sheet = this.project.sheet('Knot', `viewer-${++nextInstance}`)
  private driver = createRafDriver({ name: `Amarra ${nextInstance}` })
  private motion = this.sheet.object('Construction', {
    loop: types.number(0, { range: [0, 1], label: 'Formação do laço' }),
    firstPass: types.number(0, { range: [0, 1], label: 'Primeira passagem' }),
    secondPass: types.number(0, { range: [0, 1], label: 'Segunda passagem' }),
    dressing: types.number(0, { range: [0, 1], label: 'Acomodação' }),
    tightening: types.number(0, { range: [0, 1], label: 'Aperto' }),
  })
  private pulse = this.sheet.object('Playback', { revision: 0 })
  private milliseconds = 0
  private revision = 0
  private pending: { end: number; speed: number } | undefined
  private loaded = false
  private disposed = false
  private requestedSeconds?: number
  readonly ready = this.project.ready.then(() => {
    this.loaded = true
    if (this.requestedSeconds !== undefined && !this.disposed) {
      this.sheet.sequence.position = this.requestedSeconds
      this.requestedSeconds = undefined
    }
  })
  private unsubscribe = onChange(this.pulse.props.revision, () => {
    const command = this.pending
    if (!command || !this.loaded || this.disposed) return
    this.pending = undefined
    // Inicia dentro do tick: o tempo virtual do R3F também serve aos testes.
    void this.sheet.sequence.play({ range: [this.seconds, command.end], rate: command.speed, rafDriver: this.driver })
  }, this.driver)

  get seconds() { return this.requestedSeconds ?? this.sheet.sequence.position }
  get playing() { return !!this.pending || val(this.sheet.sequence.pointer.playing) }
  get values() { return this.motion.value }

  seek(seconds: number) {
    if (!this.loaded) this.requestedSeconds = seconds
    else this.sheet.sequence.position = seconds
  }
  play(end: number, speed: number) {
    if (this.disposed) return
    this.pending = { end, speed }
    if (this.loaded) this.startPending()
    else void this.ready.then(() => { if (this.pending && !this.disposed) this.startPending() })
  }
  private startPending() {
    this.pulse.initialValue = { revision: ++this.revision }
    this.driver.tick(this.milliseconds)
  }
  pause() { this.pending = undefined; this.sheet.sequence.pause() }
  advance(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return
    this.milliseconds += seconds * 1000
    this.driver.tick(this.milliseconds)
  }
  posePosition(position: number) {
    const index = Math.floor(position), values = this.values
    if (index === 0) return clamp(values.loop)
    if (index === 1) return 1 + clamp(values.firstPass)
    if (index === 2) return 2 + clamp(values.secondPass)
    if (index === 3) {
      const split = this.layout.dressingFraction
      const start = this.layout.intervals[4][0]
      return this.seconds < start ? 3 + split * clamp(values.dressing) : 3 + split + (1 - split) * clamp(values.tightening)
    }
    return position
  }
  dispose() {
    if (this.disposed) return
    this.pause(); this.disposed = true; this.unsubscribe()
    this.sheet.detachObject('Construction'); this.sheet.detachObject('Playback')
  }
}
