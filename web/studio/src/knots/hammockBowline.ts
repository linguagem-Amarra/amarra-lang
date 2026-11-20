import { CatmullRomCurve3, Vector3 } from 'three'
import type { Frame, Plan, Point } from '../types'
import { smoothMotion } from '../types'
import { bakeMotion } from '../ropeMotion'
import { pathLength, samplePath } from '../ropeWinding'
import { HAMMOCK_POST, HAMMOCK_PUNHO } from './hammockKnot'

const SAMPLES = 768
const TAU = Math.PI * 2

// Percurso contínuo: laço pequeno na parte firme, alça fixa ao redor do
// armador, ponta pelo laço, colar atrás da parte firme e retorno pelo laço.
function guide(tightness: number): Point[] {
  const points: Point[] = []
  const shrink = 1 - .23 * tightness
  const knot = (x: number, y: number, z: number): Point => [
    -.7 + (x + .7) * shrink, -.22 + (y + .22) * shrink, z,
  ]
  const append = (controls: Point[], count = 96) => {
    const curve = new CatmullRomCurve3(controls.map(point => new Vector3(...point)), false, 'centripetal')
    for (let i = points.length ? 1 : 0; i <= count; i++) points.push(curve.getPoint(i / count).toArray() as Point)
  }
  append([HAMMOCK_PUNHO, [-2.45, -.27, -.38], [-1.35, -.3, -.38], knot(-.75, -.32, -.38)], 100)
  append([knot(-.75, -.32, -.38), knot(-.4, -.32, -.38), knot(-.2, -.03, -.9), knot(-.34, .42, -.9),
    knot(-.92, .47, -.9), knot(-1.12, -.02, -.9), knot(-.7, -.75, -1.0),
    knot(.05, -.46, -.55)], 144)
  const radius = .97 - .22 * tightness
  append([knot(.05, -.46, -.55), [.85, -.43, -.53], [1.75, -.46, -.6],
    [HAMMOCK_POST[0], HAMMOCK_POST[1] - radius, -.6]], 80)
  for (let i = 1; i <= 192; i++) {
    const u = i / 192, angle = -Math.PI / 2 + TAU * u
    points.push([HAMMOCK_POST[0] + radius * Math.cos(angle),
      HAMMOCK_POST[1] + radius * Math.sin(angle), -.6 + 1.8 * u])
  }
  append([[HAMMOCK_POST[0], HAMMOCK_POST[1] - radius, 1.2], [2.8, -.58, 1.5],
    [2.7, -1.25, 1.55], [1.5, -1.4, 1.5], [.4, -.5, 1.35], knot(-.55, -.1, 1.2)], 96)
  append([knot(-.55, -.1, 1.2), knot(-.95, .28, 1.25), knot(-1.5, .1, 1.2),
    knot(-1.65, -.48, .85), knot(-1.5, -.7, .55)], 120)
  append([knot(-1.5, -.7, .55), knot(-1.2, -.85, .25), knot(-.75, .1, -.1), knot(-.6, .15, -.45),
    knot(-.55, .16, -1.45), knot(-.05, .4, -1.65)], 88)
  return points
}

const loose = guide(0)
const tight = guide(1)
const indices = [0, 100, 244, 516, 612, 732, loose.length - 1]
const distances = [0]
for (let i = 1; i < loose.length; i++) distances.push(distances[i - 1]
  + Math.hypot(...loose[i].map((value, axis) => value - loose[i - 1][axis])))
const cuts = indices.map(index => distances[index] / distances[distances.length - 1])
export const BOWLINE_ROPE_LENGTH = pathLength(loose) + 1.8
export const BOWLINE_FINISHED_ROPE_LENGTH = pathLength(tight) + 1.15

function pose(progress: number, tightness = 0, trim = 0): Point[] {
  const path = tightness ? loose.map((point, index) => point.map((value, axis) =>
    value + (tight[index][axis] - value) * tightness) as Point) : loose
  const total = pathLength(path)
  const target = Math.max(0, Math.min(1, progress)) * total
  const prefix: Point[] = [path[0]]
  let length = 0
  for (let i = 1; i < path.length; i++) {
    const segment = Math.hypot(...path[i].map((value, axis) => value - path[i - 1][axis]))
    if (length + segment >= target) {
      prefix.push(path[i - 1].map((value, axis) => value
        + (path[i][axis] - value) * (target - length) / segment) as Point)
      break
    }
    prefix.push(path[i])
    length += segment
  }
  const tip = prefix[prefix.length - 1]
  const before = progress < 1e-7 ? [tip[0] - 1, tip[1], tip[2]] : prefix[prefix.length - 2]
  const direction = tip.map((value, axis) => value - before[axis]) as Point
  const norm = Math.hypot(...direction) || 1
  const remaining = BOWLINE_ROPE_LENGTH
    + (BOWLINE_FINISHED_ROPE_LENGTH - BOWLINE_ROPE_LENGTH) * trim - pathLength(prefix)
  const tail = (extent: number): Point[] => Array.from({ length: 49 }, (_, i) => {
    const u = i / 48
    const bend = (1 - trim) * Math.min(1, Math.max(0, remaining) / 4) * smoothMotion(u)
    return [tip[0] + direction[0] / norm * extent * u,
      tip[1] + direction[1] / norm * extent * u + bend * 1.4,
      tip[2] + direction[2] / norm * extent * u + bend * 2.7]
  })
  let low = 0, high = Math.max(remaining, 0)
  for (let i = 0; i < 22; i++) {
    const mid = (low + high) / 2
    if (pathLength(tail(mid)) < remaining) low = mid
    else high = mid
  }
  let points = samplePath([...prefix, ...tail((low + high) / 2).slice(1)], SAMPLES)
  for (let i = 0; i < 4; i++) {
    const missing = BOWLINE_ROPE_LENGTH
      + (BOWLINE_FINISHED_ROPE_LENGTH - BOWLINE_ROPE_LENGTH) * trim - pathLength(points)
    if (Math.abs(missing) < .0001) break
    const last = points.length - 1
    const delta = points[last].map((value, axis) => value - points[last - 1][axis]) as Point
    const magnitude = Math.hypot(...delta) || 1
    points[last] = points[last].map((value, axis) => value + delta[axis] / magnitude * missing) as Point
    points = samplePath(points, SAMPLES)
  }
  return points
}

export function buildBowlineFrames(plan: Plan): Frame[] {
  const make = (progress: number, stage: string, finished = false, tightness = 0, trim = 0): Frame => {
    const points = pose(progress, tightness, trim)
    return { points, tips: [points[0], points[points.length - 1]],
      scenario: { kind: 'hammock', stage, finished } }
  }
  const frames = [make(0, 'Corda junto ao punho')]
  const stops = [cuts[1], cuts[2], cuts[3], cuts[4], cuts[5], 1, 1]
  const captions = ['Passar a corda pelo punho', 'Formar o laço na parte firme',
    'Contornar o armador uma vez', 'Passar a ponta pelo laço',
    'Contornar a parte firme por trás', 'Voltar com a ponta pelo laço',
    'Apertar o lais de guia e ajustar a alça']
  for (let i = 0; i < stops.length; i++) {
    const from = i ? stops[i - 1] : 0
    const tension = i === 6 ? 1 : 0
    const next = make(stops[i], captions[i], false, tension)
    next.duration = i === 2 ? 5.5 : i === 6 ? 3.8 : 3.2
    next.motion = bakeMotion(frames[frames.length - 1], next, t =>
      pose(from + (stops[i] - from) * smoothMotion(t), i === 6 ? smoothMotion(t) : 0), 96, undefined, 0)
    frames.push(next)
  }
  if (plan.passos.at(-1)?.acao === 'finalizar') {
    const next = make(1, 'Lais de guia preso · excesso aparado', true, 1, 1)
    next.duration = 1.8
    next.motion = bakeMotion(frames[frames.length - 1], next,
      t => pose(1, 1, smoothMotion(t)), 96, undefined, 0)
    frames.push(next)
  }
  return frames
}
