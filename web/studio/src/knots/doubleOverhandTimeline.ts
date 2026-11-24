import state from './doubleOverhand.theatre.json'

export const timelineState = state
export const phaseNames = ['loop', 'firstPass', 'secondPass', 'dressing', 'tightening'] as const
export type KnotPhase = typeof phaseNames[number]
export type Construction = Record<KnotPhase, number>

/** Valida também estados exportados pelo Studio antes de preparar a geometria. */
export function readTimeline(candidate: typeof state = state) {
  if (candidate.definitionVersion !== '0.4.0') throw new Error('Formato de estado incompatível com Theatre 0.7.2.')
  const sheet = candidate.sheetsById.Knot
  const sequence = sheet.sequence
  const object = sequence.tracksByObject.Construction
  const intervals = phaseNames.map(name => {
    const id = object.trackIdByPropPath[JSON.stringify([name]) as keyof typeof object.trackIdByPropPath]
    const track = object.trackData[id as keyof typeof object.trackData]
    const keys = track?.keyframes
    if (track?.type !== 'BasicKeyframedTrack' || !keys || keys.length < 2) throw new Error(`Etapa Theatre ausente: ${name}.`)
    if (keys[0].value !== 0 || keys.at(-1)!.value !== 1) throw new Error(`A etapa ${name} precisa começar em 0 e terminar em 1.`)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i], next = keys[i + 1]
      if (!Number.isFinite(key.position) || key.position < 0 || !Number.isFinite(key.value) || key.value < 0 || key.value > 1
        || ('type' in key && key.type !== 'bezier')
        || key.handles.length !== 4 || key.handles.some(x => !Number.isFinite(x) || x < 0 || x > 1)) throw new Error(`Parâmetros Theatre inválidos em ${name}.`)
      if (next && (next.position <= key.position || next.value < key.value || !key.connectedRight
        || key.handles[2] > next.handles[0] || key.handles[3] > next.handles[1])) throw new Error(`A etapa ${name} deve avançar continuamente.`)
    }
    return [keys[0].position, keys.at(-1)!.position] as const
  })
  if (intervals[0][0] !== 0 || intervals.some((interval, i) => i > 0 && Math.abs(interval[0] - intervals[i - 1][1]) > 1e-8)
    || !Number.isFinite(sequence.length) || sequence.length <= intervals[4][1]) throw new Error('As etapas Theatre devem ser consecutivas e terminar dentro da sequência, com tempo para finalizar.')
  const boundaries = [0, intervals[0][1], intervals[1][1], intervals[2][1], intervals[4][1], sequence.length]
  return { intervals, boundaries, durations: boundaries.slice(1).map((end, i) => end - boundaries[i]),
    dressingFraction: (intervals[3][1] - intervals[3][0]) / (intervals[4][1] - intervals[3][0]) }
}

// Valida dentro do Worker/controle, para que um arquivo de autoria inválido
// produza diagnóstico sem impedir a montagem do editor Amarra.
let cached: ReturnType<typeof readTimeline> | undefined
export function getDoubleOverhandTimeline() { return cached ??= readTimeline() }

let hash = 2166136261
for (const character of JSON.stringify(state)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
export const theatreProjectId = `Amarra Studio ${ (hash >>> 0).toString(36) }`
