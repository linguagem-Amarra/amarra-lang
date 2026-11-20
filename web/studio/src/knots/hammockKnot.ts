import type { Frame, Plan, Point } from '../types'
import { smoothMotion } from '../types'
import { bakeMotion } from '../ropeMotion'
import { pathLength, samplePath } from '../ropeWinding'

export const HAMMOCK_POST: Point = [2.4, .5, 0]
export const HAMMOCK_PUNHO: Point = [-3.3, -.25, -.38]
export const HAMMOCK_LEFT_POST: Point = [-14.25, .5, 0]
export const HAMMOCK_LEFT_PUNHO: Point = [-12.75, -.25, -.38]
const SAMPLES = 768
const TAU = Math.PI * 2
// Todas as versões têm os mesmos vértices. No aperto, o cabo se encosta ao
// armador e as duas meias-voltas se fecham ao redor da parte firme.
function guide(tightness: number, anchor = false): Point[] {
  const path: Point[] = []
  const append = (point: Point) => { path.push(point) }
  const radius = .76 - .09 * tightness
  const standingY = HAMMOCK_POST[1] - radius
  const hitchRadius = .72 - .36 * tightness
  const pitch = 1.04 - .49 * tightness
  const hitchStart = anchor ? .55 : 1.08
  for (let i = 0; i <= 100; i++) {
    const u = i / 100
    append([HAMMOCK_PUNHO[0] + 5.7 * u, HAMMOCK_PUNHO[1] + (standingY - HAMMOCK_PUNHO[1]) * smoothMotion(u), -.38])
  }
  for (let i = 1; i <= 288; i++) {
    const u = i / 288, angle = -Math.PI / 2 + TAU * 2.5 * u
    append([HAMMOCK_POST[0] + radius * Math.cos(angle), HAMMOCK_POST[1] + radius * Math.sin(angle), -.38 + 1.0 * u])
  }
  for (let i = 1; i <= 56; i++) {
    const u = i / 56
    append([2.4 + (hitchStart - 2.4) * u,
      HAMMOCK_POST[1] + radius + (standingY + hitchRadius - HAMMOCK_POST[1] - radius) * smoothMotion(u)
      + (anchor ? 1.8 * Math.sin(Math.PI * u) ** 2 * (1 - .5 * Math.sin(Math.PI * u) ** 2) : 0),
      .62 - smoothMotion(u) + 5 * u * u * (1 - u) + .2 * Math.sin(Math.PI * u) ** 2
      - (anchor ? 2.4 * Math.sin(Math.PI * u) ** 2 : 0)])
  }
  for (let hitch = 0; hitch < 2; hitch++) {
    for (let i = 1; i <= 144; i++) {
      const u = i / 144, angle = TAU * u
      append([hitchStart - (hitch + u) * pitch,
        standingY + hitchRadius * Math.cos(angle), -.38 - hitchRadius * Math.sin(angle)])
    }
  }
  for (let i = 1; i <= 32; i++) {
    const u = i / 32
    append([hitchStart - 2 * pitch - .95 * u, standingY + hitchRadius + .28 * smoothMotion(u),
      -.38 - 3.5 * u * (1 - u) ** 2 + .22 * smoothMotion(u)])
  }
  return path
}
const path = guide(0)
const anchorPath = guide(0, true)
const standingEnd = 100
const turnEnd = standingEnd + 288
const approachEnd = turnEnd + 56
const hitchEnd = approachEnd + 288
const guideLength = pathLength(path)
export const HAMMOCK_ROPE_LENGTH = guideLength + 2.1
export const HAMMOCK_FINISHED_ROPE_LENGTH = pathLength(guide(1)) + 1.35
export const ANCHOR_ROPE_LENGTH = pathLength(anchorPath) + 2.1
export const ANCHOR_FINISHED_ROPE_LENGTH = pathLength(guide(1, true)) + 1.35
const marks = [0, standingEnd, turnEnd, approachEnd, approachEnd + 144, hitchEnd, path.length - 1]
const cumulative = [0]
for (let i = 1; i < path.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(...path[i].map((v, axis) => v - path[i - 1][axis])))
const cuts = marks.map(index => cumulative[index] / guideLength)
const anchorCumulative = [0]
for (let i = 1; i < anchorPath.length; i++) anchorCumulative.push(anchorCumulative[i - 1]
  + Math.hypot(...anchorPath[i].map((v, axis) => v - anchorPath[i - 1][axis])))
const anchorCuts = marks.map(index => anchorCumulative[index] / anchorCumulative[anchorCumulative.length - 1])

function pose(u: number, tightness = 0, trim = 0, anchor = false): Point[] {
  const currentPath = tightness ? guide(tightness, anchor) : anchor ? anchorPath : path
  const distances = tightness ? [0] : anchor ? anchorCumulative : cumulative
  if (tightness) for (let i = 1; i < currentPath.length; i++) {
    distances.push(distances[i - 1] + Math.hypot(...currentPath[i].map((v, axis) => v - currentPath[i - 1][axis])))
  }
  const target = Math.max(0, Math.min(1, u)) * distances[distances.length - 1]
  let end = 1
  while (end < distances.length - 1 && distances[end] < target) end++
  const part = (target - distances[end - 1]) / Math.max(1e-9, distances[end] - distances[end - 1])
  const tip = currentPath[end - 1].map((value, axis) => value + (currentPath[end][axis] - value) * part) as Point
  const prefix = [...currentPath.slice(0, end), tip]
  const before = prefix[prefix.length - 2]
  const delta = target < 1e-7 ? [1, 0, 0] as Point : tip.map((value, axis) => value - before[axis]) as Point
  const norm = Math.hypot(...delta) || 1
  const axis = delta.map(v => v / norm) as Point
  const fullLength = anchor ? ANCHOR_ROPE_LENGTH : HAMMOCK_ROPE_LENGTH
  const finishedLength = anchor ? ANCHOR_FINISHED_ROPE_LENGTH : HAMMOCK_FINISHED_ROPE_LENGTH
  const visibleLength = fullLength + (finishedLength - fullLength) * trim
  const remaining = visibleLength - pathLength(prefix)
  const radial: Point = [0, tip[1] + .26, tip[2] + .38]
  const radialLength = Math.hypot(radial[1], radial[2]) || 1
  const boundaries = anchor ? anchorCuts : cuts
  const push = (1 - tightness) * 1.5 * smoothMotion(Math.max(0, Math.min(1,
    (u - boundaries[1]) / (boundaries[2] - boundaries[1]))))
  const tail = (extent: number): Point[] => Array.from({ length: 65 }, (_, i) => {
    const s = i / 64
    const distance = ((1 - tightness) * extent + tightness * (2.7 - 1.85 * trim)) * s
    return tip.map((value, coordinate) => value + axis[coordinate] * distance
      + radial[coordinate] / radialLength * push * distance * distance / (1 + distance)
      + (coordinate === 1 ? -tightness * extent * Math.sin(Math.PI * s) ** 2 : 0)
      + (coordinate === 2 ? tightness * .72 * smoothMotion(s) : 0)) as Point
  })
  let low = 0, high = remaining
  for (let i = 0; i < 26; i++) {
    const mid = (low + high) / 2
    if (pathLength(tail(mid)) < remaining) low = mid
    else high = mid
  }
  let points = samplePath([...prefix, ...tail((low + high) / 2).slice(1)], SAMPLES)
  for (let pass = 0; pass < 4; pass++) {
    const missing = visibleLength - pathLength(points)
    if (Math.abs(missing) < .0001) break
    const last = points.length - 1
    const direction = points[last].map((value, coordinate) => value - points[last - 1][coordinate]) as Point
    const norm = Math.hypot(...direction)
    points[last] = points[last].map((value, coordinate) => value + direction[coordinate] / norm * missing) as Point
    points = samplePath(points, SAMPLES)
  }
  return points
}

function buildFrames(plan: Plan, anchor: boolean): Frame[] {
  const make = (u: number, stage: string, finished = false, tightness = 0): Frame => {
    const points = pose(u, tightness, 0, anchor)
    return { points, tips: [points[0], points[points.length - 1]],
      scenario: { kind: 'hammock', stage, finished } }
  }
  const boundaries = anchor ? anchorCuts : cuts
  const stops = [boundaries[1], boundaries[2], boundaries[4], boundaries[5], 1]
  const captions = anchor
    ? ['Passar a corda pelo punho', 'Duas voltas no armador',
      'Passar sob a volta e formar a primeira meia-volta', 'Segunda meia-volta na parte firme', 'Acomodar e apertar']
    : ['Passar a corda pelo punho', 'Duas voltas no armador',
      'Primeira meia-volta na parte firme', 'Segunda meia-volta na parte firme', 'Acomodar e apertar']
  const frames = [make(0, 'Corda junto ao punho')]
  for (let i = 0; i < stops.length; i++) {
    const from = i ? stops[i - 1] : 0
    const next = make(stops[i], captions[i], false, i === stops.length - 1 ? 1 : 0)
    next.duration = i === 1 ? 5.5 : i === 2 || i === 3 ? 4 : 2.8
    next.motion = bakeMotion(frames[frames.length - 1], next,
      t => { const eased = smoothMotion(t); return pose(from + (stops[i] - from) * eased,
        i === stops.length - 1 ? eased : 0, 0, anchor) },
      anchor && i === 2 ? 384 : 96, undefined, 0)
    frames.push(next)
  }
  if (plan.passos.at(-1)?.acao === 'finalizar') {
    const next = make(1, anchor ? 'Nó de âncora preso · excesso aparado' : 'Excesso aparado · rede presa aos dois armadores', true, 1)
    next.points = pose(1, 1, 1, anchor)
    next.tips = [next.points[0], next.points[next.points.length - 1]]
    next.duration = 1.8
    next.motion = bakeMotion(frames[frames.length - 1], next,
      t => pose(1, 1, smoothMotion(t), anchor), 96, undefined, 0)
    frames.push(next)
  }
  return frames
}

export function buildHammockFrames(plan: Plan): Frame[] { return buildFrames(plan, false) }
export function buildAnchorHitchFrames(plan: Plan): Frame[] { return buildFrames(plan, true) }
