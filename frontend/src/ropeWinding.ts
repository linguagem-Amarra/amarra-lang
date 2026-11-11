import { Vector3 } from 'three'
import type { Point } from './types'
import { smoothMotion } from './types'

const TAU = Math.PI * 2
const vector = (p: Point) => new Vector3(...p)
const point = (v: Vector3) => v.toArray() as Point
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

export function pathLength(points: Point[]) {
  return points.slice(1).reduce((length, p, i) => length + distance(p, points[i]), 0)
}

// Amostragem material: a distância desde a ponta de apoio identifica cada
// ponto da corda. Acrescentar uma volta não desloca o ramo que já está pronto.
export function samplePath(path: Point[], divisions: number): Point[] {
  const lengths = [0]
  for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + distance(path[i - 1], path[i]))
  let segment = 1
  return Array.from({ length: divisions + 1 }, (_, i) => {
    const at = lengths[lengths.length - 1] * i / divisions
    while (segment < path.length - 1 && lengths[segment] < at) segment++
    const span = lengths[segment] - lengths[segment - 1]
    return point(vector(path[segment - 1]).lerp(vector(path[segment]), span > 1e-10 ? (at - lengths[segment - 1]) / span : 0))
  })
}

function bezier(a: Vector3, b: Vector3, c: Vector3, d: Vector3, divisions = 64): Point[] {
  return Array.from({ length: divisions + 1 }, (_, i) => {
    const t = i / divisions, u = 1 - t
    return point(a.clone().multiplyScalar(u ** 3).addScaledVector(b, 3 * u * u * t)
      .addScaledVector(c, 3 * u * t * t).addScaledVector(d, t ** 3))
  })
}

export type WindingGuide = {
  prefix: Point[]; sourceTail: Point[]; root: number
  center: Vector3; axis: Vector3; normal: Vector3; binormal: Vector3
  radius: number; pitch: number; pull: number
  joinLift: number
  previousTail?: Point[]
}

function joinPath(guide: WindingGuide, prefix: Point[], radius: number, pitch: number) {
  const first = guide.center.clone().addScaledVector(guide.normal, radius)
  const tangent = guide.binormal.clone().multiplyScalar(TAU * radius).addScaledVector(guide.axis, pitch).normalize()
  const anchor = vector(prefix[prefix.length - 1])
  const direction = anchor.clone().sub(vector(prefix[prefix.length - 2])).normalize()
  return bezier(anchor, anchor.clone().addScaledVector(direction, .4), first.clone().addScaledVector(tangent, -.4), first)
    .map((p, i, points): Point => [p[0], p[1], p[2] + guide.joinLift * Math.sin(Math.PI * i / (points.length - 1)) ** 2])
}

export function createWindingGuide(base: Point[], right: boolean, plannedTurns = 2): WindingGuide {
  const ordered = right ? base : [...base].reverse()
  const radial = (p: Point) => Math.hypot(p[0], p[1] + .35)
  let root = 0
  while (root < ordered.length / 2 && radial(ordered[root]) > .9) root++
  let start = Math.floor((ordered.length - 1) * .55)
  for (let i = start; i < ordered.length - 8; i++) if (radial(ordered[i]) < .85) start = i
  const support = vector(ordered[root])
  const axis = vector(ordered[0]).sub(support).normalize()
  const center = support.clone().addScaledVector(axis, .75)
  const normal = vector(ordered[start]).sub(center)
  normal.addScaledVector(axis, -normal.dot(axis)).normalize()
  const guide: WindingGuide = { prefix: ordered.slice(0, start + 1), sourceTail: ordered.slice(start), root,
    center, axis, normal, binormal: axis.clone().cross(normal).normalize(), joinLift: 0,
    radius: plannedTurns > 2 ? .30 : .44, pitch: plannedTurns > 2 ? .30 : .44,
    pull: plannedTurns > 2 ? .25 : .5 }
  let best = -Infinity, selected = 0
  for (const lift of [0, -.5, .5, -1, 1]) {
    guide.joinLift = lift
    let clearance = Infinity
    for (const tension of [0, 1]) for (const p of joinPath(guide, guide.prefix,
      guide.radius * (1 - tension) + Math.max(.28, guide.radius - .1) * tension,
      guide.pitch * (1 - tension) + Math.max(.27, guide.pitch - .14) * tension)) {
      for (const obstacle of guide.prefix.slice(0, -7)) clearance = Math.min(clearance, distance(p, obstacle))
    }
    if (clearance > best) { best = clearance; selected = lift }
    if (clearance >= .28) break
  }
  guide.joinLift = selected
  return guide
}

export function windingPath(guide: WindingGuide, turns: number, tension: number, length: number) {
  const { axis, normal, binormal, center } = guide
  const radius = guide.radius * (1 - tension) + Math.max(.28, guide.radius - .1) * tension
  const pitch = guide.pitch * (1 - tension) + Math.max(.27, guide.pitch - .14) * tension
  const prefix = guide.prefix.map((p, i) => {
    const u = Math.max(0, 1 - i / Math.max(1, guide.root))
    return point(vector(p).addScaledVector(axis, .9 * guide.pull * tension * u * u * (3 - 2 * u)))
  })
  const join = joinPath(guide, prefix, radius, pitch)
  const beforeCoil = [...prefix, ...join.slice(1)]
  const coilStart = pathLength(beforeCoil)
  const divisions = Math.max(1, Math.ceil(turns * 128))
  const coil = Array.from({ length: divisions + 1 }, (_, i) => {
    const turn = turns * i / divisions, angle = turn * TAU
    return point(center.clone().addScaledVector(axis, turn * pitch)
      .addScaledVector(normal, radius * Math.cos(angle)).addScaledVector(binormal, radius * Math.sin(angle)))
  })
  const fixed = [...beforeCoil, ...coil.slice(1)]
  const coilEnd = pathLength(fixed)
  const angle = turns * TAU
  const radial = normal.clone().multiplyScalar(Math.cos(angle)).addScaledVector(binormal, Math.sin(angle))
  const tangent = normal.clone().multiplyScalar(-Math.sin(angle)).addScaledVector(binormal, Math.cos(angle))
    .multiplyScalar(TAU * radius).addScaledVector(axis, pitch).normalize()
  const exit = vector(coil[coil.length - 1])
  const available = length - coilEnd
  const tipRadius = 1.6 + guide.pull * tension + .24 * Math.max(0, available - 3)
  const tip = center.clone().addScaledVector(axis, turns * pitch + .65).addScaledVector(radial, tipRadius)
  const tail = (handle: number) => bezier(exit, exit.clone().addScaledVector(tangent, handle),
    tip.clone().addScaledVector(tangent, handle), tip, 128)
  if (available < pathLength(tail(.12))) throw new RangeError('Não há corda suficiente para estas voltas. Reduza a quantidade de enrolamentos.')
  let lo = .12, hi = length
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (pathLength(tail(mid)) > available) hi = mid
    else lo = mid
  }
  const path = [...fixed, ...tail((lo + hi) / 2).slice(1)]
  return { path, free: path.slice(prefix.length - 1), prefix,
    coil: { start: coilStart / length, end: coilEnd / length, center: point(center), axis: point(axis) } }
}

function clearTail(prefix: Point[], raw: Point[], length: number, strength: number, previous: Point[]): Point[] {
  const points = samplePath(raw, 192).map(vector)
  const obstacles = prefix.slice(0, -7).map(vector)
  const history = samplePath(previous, 192).map(vector)
  const spacing = length / 192
  const skip = Math.ceil(.42 / spacing)
  const spread = Math.ceil(.25 / spacing)
  for (let pass = 0; pass < 40; pass++) {
    const offsets = points.map(() => new Vector3())
    const weights = points.map(() => 0)
    let contact = false
    const push = (index: number, normal: Vector3, amount: number) => {
      contact = true
      for (let k = Math.max(1, index - spread); k <= Math.min(192, index + spread); k++) {
        const weight = Math.exp(-(((k - index) / Math.max(1, spread * .55)) ** 2))
        offsets[k].addScaledVector(normal, amount * weight)
        weights[k] += weight
      }
    }
    for (let i = 1; i < points.length; i++) {
      let nearest = .33, normal: Vector3 | null = null
      for (const obstacle of obstacles) {
        const dx = points[i].x - obstacle.x, dy = points[i].y - obstacle.y, dz = points[i].z - obstacle.z
        if (Math.abs(dx) >= nearest || Math.abs(dy) >= nearest || Math.abs(dz) >= nearest) continue
        const d = Math.hypot(dx, dy, dz)
        if (d < nearest) {
          nearest = d
          const direction = history[i].clone().sub(obstacle)
          normal = direction.lengthSq() > 1e-8 ? direction.normalize() : new Vector3(0, 0, 1)
        }
      }
      if (normal) push(i, normal, (.33 - nearest) * .85)
      for (let j = i + skip; j < points.length; j++) {
        const dx = points[i].x - points[j].x, dy = points[i].y - points[j].y, dz = points[i].z - points[j].z
        if (Math.abs(dx) >= .33 || Math.abs(dy) >= .33 || Math.abs(dz) >= .33) continue
        const d = Math.hypot(dx, dy, dz)
        if (d >= .33) continue
        const direction = history[i].clone().sub(history[j])
        const normal = direction.lengthSq() > 1e-8 ? direction.normalize() : new Vector3(0, 0, 1)
        push(i, normal, (.33 - d) * .45)
        push(j, normal.clone().negate(), (.33 - d) * .45)
      }
    }
    if (!contact) break
    for (let i = 1; i < points.length; i++) if (weights[i]) {
      points[i].addScaledVector(offsets[i], smoothMotion(i / 6) / weights[i] * strength)
    }
  }
  // Contatos acrescentam comprimento local. A sobra sai apenas pela ponta
  // livre: reescalar a cauda inteira colocaria os contatos de volta no miolo.
  const output = [point(points[0])]
  let remaining = length
  for (let i = 1; i < points.length; i++) {
    const span = points[i].distanceTo(points[i - 1])
    if (span >= remaining) {
      output.push(point(points[i - 1].clone().lerp(points[i], remaining / span)))
      return output
    }
    output.push(point(points[i]))
    remaining -= span
  }
  if (remaining > 1e-6) {
    const last = points[points.length - 1]
    output.push(point(last.clone().addScaledVector(last.clone().sub(points[points.length - 2]).normalize(), remaining)))
  }
  return output
}

// A cauda mantém uma única curva ampla durante a aproximação. O ramo de
// apoio e o miolo ficam fixos; somente o trecho livre acomoda seu comprimento.
export function approachWinding(guide: WindingGuide, target: Point[], fraction: number) {
  const source = samplePath(guide.sourceTail, 192)
  const destination = samplePath(target, 192)
  const length = pathLength(source) * (1 - fraction) + pathLength(destination) * fraction
  const anchor = vector(source[0])
  let free = source.map((p, i) => {
    const v = i / 192
    const position = vector(p).lerp(vector(destination[i]), fraction)
    position.z += 3 * Math.sin(Math.PI * fraction) ** 2 * smoothMotion(v / .45)
    return point(position)
  })
  const scale = length / pathLength(free)
  free = free.map(p => point(vector(p).sub(anchor).multiplyScalar(scale).add(anchor)))
  free = clearTail(guide.prefix, free, length,
    smoothMotion(Math.min(1, fraction / .1, (1 - fraction) / .1)), guide.previousTail ?? source)
  guide.previousTail = free
  return [...guide.prefix.slice(0, -1), ...free]
}
