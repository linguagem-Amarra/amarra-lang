import type { Frame, Plan, Point } from '../types'
import { smoothMotion } from '../types'
import { bakeMotion } from '../ropeMotion'
import { pathLength, samplePath } from '../ropeWinding'

export const HAMMOCK_POST: Point = [2.4, .5, 0]
export const HAMMOCK_PUNHO: Point = [-3.3, -.25, -.38]
const SAMPLES = 768
const RADIUS = .76
const TAU = Math.PI * 2
const path: Point[] = []
const append = (point: Point) => { path.push(point) }

// Parte firme: sai do punho, aproxima-se do armador e dá uma volta redonda.
for (let i = 0; i <= 100; i++) append([HAMMOCK_PUNHO[0] + 5.7 * i / 100, -.26, -.38])
const standingEnd = path.length - 1
for (let i = 1; i <= 288; i++) {
  const u = i / 288, angle = -Math.PI / 2 + TAU * 2.5 * u
  append([HAMMOCK_POST[0] + RADIUS * Math.cos(angle), HAMMOCK_POST[1] + RADIUS * Math.sin(angle), -.38 + 1.0 * u])
}
const turnEnd = path.length - 1
// A ponta volta na direção do ramo firme, acima dele.
for (let i = 1; i <= 56; i++) {
  const u = i / 56
  append([2.4 - 1.32 * u, 1.26 - .8 * smoothMotion(u),
    .62 - smoothMotion(u) + 5 * u * u * (1 - u) + .2 * Math.sin(Math.PI * u) ** 2])
}
const approachEnd = path.length - 1
// Cada meia-volta circunda o ramo firme uma vez, com avanço ao longo do seu eixo.
for (let hitch = 0; hitch < 2; hitch++) {
  for (let i = 1; i <= 144; i++) {
    const u = i / 144, angle = TAU * u
    append([1.08 - hitch * 1.04 - 1.04 * u,
      -.26 + .72 * Math.cos(angle), -.38 - .72 * Math.sin(angle)])
  }
}
const hitchEnd = path.length - 1
for (let i = 1; i <= 32; i++) {
  const u = i / 32
  append([-1 - .95 * u, .46 + .28 * smoothMotion(u),
    -.38 - 3.5 * u * (1 - u) ** 2 + .22 * smoothMotion(u)])
}
const guideLength = pathLength(path)
export const HAMMOCK_ROPE_LENGTH = guideLength + 2.1
const marks = [0, standingEnd, turnEnd, approachEnd, approachEnd + 144, hitchEnd, path.length - 1]
const cumulative = [0]
for (let i = 1; i < path.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(...path[i].map((v, axis) => v - path[i - 1][axis])))
const cuts = marks.map(index => cumulative[index] / guideLength)

function pose(u: number): Point[] {
  const target = Math.max(0, Math.min(1, u)) * guideLength
  let end = 1
  while (end < cumulative.length - 1 && cumulative[end] < target) end++
  const part = (target - cumulative[end - 1]) / Math.max(1e-9, cumulative[end] - cumulative[end - 1])
  const tip = path[end - 1].map((value, axis) => value + (path[end][axis] - value) * part) as Point
  const prefix = [...path.slice(0, end), tip]
  const before = prefix[prefix.length - 2]
  const delta = target < 1e-7 ? [1, 0, 0] as Point : tip.map((value, axis) => value - before[axis]) as Point
  const norm = Math.hypot(...delta) || 1
  const axis = delta.map(v => v / norm) as Point
  const remaining = HAMMOCK_ROPE_LENGTH - pathLength(prefix)
  const radial: Point = [0, tip[1] + .26, tip[2] + .38]
  const radialLength = Math.hypot(radial[1], radial[2]) || 1
  const push = 1.5 * smoothMotion(Math.max(0, Math.min(1, (u - cuts[1]) / (cuts[2] - cuts[1]))))
  const tail = (extent: number): Point[] => Array.from({ length: 65 }, (_, i) => {
    const s = i / 64
    const distance = extent * s
    return tip.map((value, coordinate) => value + axis[coordinate] * distance
      + radial[coordinate] / radialLength * push * distance * distance / (1 + distance)) as Point
  })
  let low = 0, high = remaining
  for (let i = 0; i < 26; i++) {
    const mid = (low + high) / 2
    if (pathLength(tail(mid)) < remaining) low = mid
    else high = mid
  }
  let points = samplePath([...prefix, ...tail((low + high) / 2).slice(1)], SAMPLES)
  for (let pass = 0; pass < 4; pass++) {
    const missing = HAMMOCK_ROPE_LENGTH - pathLength(points)
    if (Math.abs(missing) < .0001) break
    const last = points.length - 1
    const direction = points[last].map((value, coordinate) => value - points[last - 1][coordinate]) as Point
    const norm = Math.hypot(...direction)
    points[last] = points[last].map((value, coordinate) => value + direction[coordinate] / norm * missing) as Point
    points = samplePath(points, SAMPLES)
  }
  return points
}

export function buildHammockFrames(plan: Plan): Frame[] {
  const make = (u: number, stage: string, finished = false): Frame => {
    const points = pose(u)
    return { points, tips: [points[0], points[points.length - 1]],
      scenario: { kind: 'hammock', stage, finished } }
  }
  const stops = [cuts[1], cuts[2], cuts[4], cuts[5], 1]
  const captions = ['Passar a corda pelo punho', 'Duas voltas no armador',
    'Primeira meia-volta na parte firme', 'Segunda meia-volta na parte firme', 'Acomodar e apertar']
  const frames = [make(0, 'Corda junto ao punho')]
  for (let i = 0; i < stops.length; i++) {
    const from = i ? stops[i - 1] : 0
    const next = make(stops[i], captions[i])
    next.duration = i === 1 ? 5.5 : i === 2 || i === 3 ? 4 : 2.8
    next.motion = bakeMotion(frames[frames.length - 1], next,
      t => pose(from + (stops[i] - from) * smoothMotion(t)), 96, undefined, 0)
    frames.push(next)
  }
  if (plan.passos.at(-1)?.acao === 'finalizar') {
    const next = make(1, 'Rede presa ao armador', true)
    next.points = frames[frames.length - 1].points
    next.tips = frames[frames.length - 1].tips
    next.duration = 1.8
    frames.push(next)
  }
  return frames
}
