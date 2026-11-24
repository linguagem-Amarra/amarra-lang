import type { Frame, Plan, Point } from '../types'
import { smoothMotion } from '../types'
import { pathLength, samplePath } from '../ropeWinding'
import { bakeMotion } from '../ropeMotion'

export const FIGURE_EIGHT_LENGTH = 26
const SAMPLES = 384
const CUT = .4
const START = 2.7 + CUT
const SPAN = Math.PI * 2 - 2 * CUT
const SCALE = .55
const WORKING_TAIL = 1.5

const length = (p: Point) => Math.hypot(...p)
const unit = (p: Point): Point => p.map(x => x / length(p)) as Point
const subtract = (a: Point, b: Point): Point => a.map((x, i) => x - b[i]) as Point
const add = (a: Point, b: Point, scale = 1): Point => a.map((x, i) => x + b[i] * scale) as Point

// Parametrização regular do nó 4₁. Abrimos a curva em um arco sem cruzamentos
// e prolongamos as duas extremidades, obtendo um nó de parada numa só corda.
function knotPoint(t: number): Point {
  const r = SCALE * (2 + Math.cos(2 * t))
  return [r * Math.cos(3 * t), r * Math.sin(3 * t), SCALE * Math.sin(4 * t)]
}

function corePoint(fraction: number, tension: number): Point {
  const p = knotPoint(START + SPAN * fraction)
  const scale = 1 - .35 * tension
  return p.map(x => x * scale) as Point
}

function ropePose(progress: number, tension = 0): Point[] {
  const u = Math.max(0, Math.min(1, progress))
  const core = Array.from({ length: 385 }, (_, i) => corePoint(i / 384, tension))
  const first = unit(subtract(corePoint(0, tension), corePoint(.0001, tension)))
  const last = unit(subtract(core[core.length - 1], core[core.length - 2]))
  const guide = [...core, add(core[core.length - 1], last, WORKING_TAIL)]
  const target = pathLength(core) * u + WORKING_TAIL
  const prefix: Point[] = [guide[0]]
  let travelled = 0
  for (let i = 1; i < guide.length; i++) {
    const segment = length(subtract(guide[i], guide[i - 1]))
    if (travelled + segment >= target) {
      prefix.push(add(guide[i - 1], subtract(guide[i], guide[i - 1]), (target - travelled) / segment))
      break
    }
    prefix.push(guide[i])
    travelled += segment
  }
  const standing = FIGURE_EIGHT_LENGTH - pathLength(prefix)
  if (standing < 0) throw new Error('Comprimento insuficiente para o nó em oito.')
  const raw = [add(core[0], first, standing), ...prefix]
  return samplePath(raw, SAMPLES)
}

export function figureEightPose(progress: number, tension = 0): Point[] {
  return ropePose(progress, tension)
}

export function buildFigureEightFrames(plan: Plan): Frame[] {
  const working = plan.passos[1].pontas[0] === plan.pontas[0] ? 'A' : 'B'
  const depth = plan.passos[0].pontas[0] === plan.passos[1].pontas[0] ? 1 : -1
  const oriented = (points: Point[]): Point[] => points.map(([x, y, z]): Point => [y, -x, depth * z])
  const make = (points: Point[], phase: NonNullable<Frame['knot']>['phase'], stage: string,
    passes: number, tightness = 0): Frame => ({ points,
    tips: working === 'B' ? [points[0], points[points.length - 1]] : [points[points.length - 1], points[0]],
    knot: { id: 'figure-eight', phase, stage, passes, tightness,
      labels: [working === 'B' ? 'A' : 'B', working], workingTip: working,
      length: FIGURE_EIGHT_LENGTH, focus: [0, 0, 0] },
  })
  const formation = (u: number, tension = 0) => oriented(ropePose(u, tension))
  const frames = [make(formation(0), 'initial', 'Corda estendida', 0)]
  const stops = [.27, .72, 1]
  const stages = ['Formar o laço', 'Contornar o ramo por baixo', 'Passar a ponta pelo laço']
  for (let i = 0; i < stops.length; i++) {
    const from = i ? stops[i - 1] : 0
    const next = make(formation(stops[i]), i === 2 ? 'first-pass' : 'loop', stages[i], i === 2 ? 1 : 0)
    next.duration = i === 2 ? 4.2 : 3.4
    next.motion = bakeMotion(frames[frames.length - 1], next, t => formation(from + (stops[i] - from) * smoothMotion(t)), 128, undefined, 0)
    frames.push(next)
  }
  const tight = make(formation(1, 1), 'tighten', 'Apertar o nó em oito', 1, 1)
  tight.duration = 3.4
  tight.motion = bakeMotion(frames[frames.length - 1], tight, t => formation(1, smoothMotion(t)), 128, undefined, 0)
  frames.push(tight)
  const finished = make(tight.points, 'finished', 'Nó em oito finalizado', 1, 1)
  finished.duration = 1
  frames.push(finished)
  return frames.slice(0, plan.passos.length + 1)
}
