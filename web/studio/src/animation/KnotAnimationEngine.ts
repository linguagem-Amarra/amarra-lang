import type { Frame, Step } from '../types'
import { stepDuration } from '../types'
import { interpolateFrame } from '../geometry'
import { TheatreKnotController } from './TheatreKnotController'

/** Relógio da animação, independente de React e da ordem de renderização. */
export class KnotAnimationEngine {
  private cursor = 0
  private running = false
  private rate = 1
  private continuous = true
  private durations: number[] = []
  private frames: Frame[] = []
  private theatre?: TheatreKnotController

  get ready() { return this.theatre?.ready ?? Promise.resolve() }
  get usesTheatre() { return !!this.theatre }
  get position() {
    if (!this.theatre) return this.cursor
    let time = this.theatre.seconds
    for (let i = 0; i < this.durations.length; i++) {
      if (time < this.durations[i] - 1e-9) return i + time / this.durations[i]
      time -= this.durations[i]
    }
    return this.durations.length
  }
  get posePosition() { return this.theatre?.posePosition(this.position) ?? this.position }
  get playing() { return this.theatre?.playing ?? this.running }
  get speed() { return this.rate }
  get autoAdvance() { return this.continuous }
  set autoAdvance(value: boolean) {
    if (value === this.continuous) return
    const playing = this.playing
    this.continuous = value
    if (playing) this.play()
  }

  configure(steps: Step[], frames: Frame[]) {
    const position = this.position
    this.pause()
    this.frames = frames
    this.durations = steps.map((step, i) => Math.max(.001, stepDuration(step, frames[i + 1])))
    if (frames[0]?.knot?.id === 'double-overhand') this.theatre ??= new TheatreKnotController()
    else { this.theatre?.dispose(); this.theatre = undefined }
    this.seek(position)
  }

  seek(position: number) {
    this.cursor = Math.max(0, Math.min(this.durations.length, Number.isFinite(position) ? position : 0))
    const seconds = this.durations.reduce((sum, duration, i) => sum + duration * Math.max(0, Math.min(1, this.cursor - i)), 0)
    this.theatre?.seek(seconds)
    return this.position
  }

  setSpeed(speed: number) {
    if (!Number.isFinite(speed) || speed < .25 || speed > 2) throw new RangeError('Velocidade deve estar entre 0,25× e 2×.')
    const playing = this.playing
    this.rate = speed
    if (playing) this.play()
  }

  play() {
    if (!this.durations.length) return
    if (this.position >= this.durations.length) this.seek(0)
    if (this.theatre) {
      const end = this.autoAdvance ? this.totalSeconds : this.durations.slice(0, Math.floor(this.position) + 1).reduce((sum, n) => sum + n, 0)
      this.theatre.play(end, this.speed)
    } else this.running = true
  }

  pause() { this.running = false; this.theatre?.pause() }
  restart() { this.pause(); this.seek(0) }
  next() { this.pause(); this.seek(Math.floor(this.position) + 1) }
  previous() { this.pause(); this.seek(Math.ceil(this.position) - 1) }

  advance(seconds: number) {
    if (this.theatre) { this.theatre.advance(seconds); return this.position }
    if (!this.playing || !Number.isFinite(seconds) || seconds <= 0) return this.position
    let remaining = seconds * this.speed
    while (remaining > 1e-10 && this.position < this.durations.length) {
      const index = Math.floor(this.position)
      const needed = (index + 1 - this.position) * this.durations[index]
      if (remaining < needed - 1e-10) { this.cursor += remaining / this.durations[index]; break }
      remaining -= needed
      this.cursor = index + 1
      if (!this.autoAdvance) { this.pause(); break }
    }
    if (this.position >= this.durations.length) this.pause()
    return this.position
  }

  get totalSeconds() { return this.durations.reduce((sum, duration) => sum + duration, 0) }
  get elapsedSeconds() {
    return this.durations.reduce((sum, duration, i) => sum + duration * Math.max(0, Math.min(1, this.position - i)), 0)
  }
  currentFrame() { return this.frames.length ? interpolateFrame(this.frames, this.posePosition) : undefined }
  dispose() { this.pause(); this.theatre?.dispose(); this.theatre = undefined }
}
