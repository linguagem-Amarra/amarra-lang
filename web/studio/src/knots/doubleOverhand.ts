import { CatmullRomCurve3, CubicBezierCurve3, CurvePath, Vector3 } from 'three'
import type { Frame, Plan, Point } from '../types'
import { passageProgress, smoothMotion } from '../types'
import { pathLength, samplePath } from '../ropeWinding'
import { bakeMotion } from '../ropeMotion'
import { getDoubleOverhandTimeline } from './doubleOverhandTimeline'

export const DOUBLE_OVERHAND_LENGTH = 17
export const DOUBLE_OVERHAND_SAMPLES = 384
const SCALE = .65
const LENGTH = DOUBLE_OVERHAND_LENGTH / SCALE
const TAU = 2 * Math.PI
const v = (p: Point) => new Vector3(...p)
const p = (v: Vector3) => v.toArray() as Point
const mix = (a: number, b: number, t: number) => a + (b - a) * t

function spline(controls: Point[]) {
  const curve = new CatmullRomCurve3(controls.map(v), false, 'centripetal')
  curve.arcLengthDivisions = 1024
  return curve
}

function loop(tension: number) {
  const loose: Point[] = [[0, 1, -.4], [1.2, .65, -.1], [1.2, -.5, 0], [1.2, -1.4, .1],
    [0, -1.65, .1], [-1.2, -1.3, .05], [-1.5, -.3, 0], [-1.1, .6, .15], [0, 1, .4]]
  // O ramo de retorno contorna o exterior das duas espiras. Levá-lo em linha
  // reta para dentro da hélice cortaria as voltas durante o aperto.
  const tight: Point[] = [[1.2, .95, -.4], [1.2, .5, -.1], [1.2, -.35, 0], [1.2, -.72, .1],
    [1.2, -.96, .52], [1.2, -.72, 1.03], [1.2, .2, 1.03], [1.35, .65, .88], [1.55, .65, .58]]
  const controls = loose.map((a, i): Point => {
    const point = a.map((x, axis) => mix(x, tight[i][axis], tension)) as Point
    if (i >= 4 && i <= 7) {
      // Arco radial: o retorno se acomoda atrás do barril sem atravessá-lo.
      const radius = mix(Math.hypot(1.2 - a[0], a[2]), Math.hypot(1.2 - tight[i][0], tight[i][2]), tension)
      const angle = mix(Math.atan2(a[2], 1.2 - a[0]), Math.atan2(tight[i][2], 1.2 - tight[i][0]), tension)
      point[0] = 1.2 - radius * Math.cos(angle)
      point[2] = radius * Math.sin(angle)
    }
    return point
  })
  const body = spline(controls.slice(0, 7))
  const begin = v(controls[6]), end = v(controls[8])
  const reach = begin.distanceTo(end)
  const exitDirection = end.clone().sub(v(controls[7])).normalize()
  const cap = new CubicBezierCurve3(begin, begin.clone().addScaledVector(body.getTangentAt(1), reach * .5),
    end.clone().addScaledVector(exitDirection, -reach * .4), end)
  const curve = new CurvePath<Vector3>()
  curve.add(body); curve.add(cap)
  curve.arcLengthDivisions = 1024
  return curve
}

function geometry(turns: number, dress = 0, tension = 0) {
  const mainCurve = loop(tension)
  const main = mainCurve.getSpacedPoints(240).map(p)
  const radius = mix(mix(.65, .62, dress), .60, tension)
  const pitch = mix(mix(.8, .72, dress), .45, tension)
  const top = mix(.5, .25, tension)
  const first = new Vector3(1.2 + radius, top, 0)
  const anchor = v(main[main.length - 1])
  const entryTangent = new Vector3(0, -pitch, -radius * TAU).normalize()
  const join = new CubicBezierCurve3(anchor, anchor.clone().addScaledVector(mainCurve.getTangentAt(1), mix(.7, .5, tension)),
    first.clone().addScaledVector(entryTangent, -.45), first).getPoints(64).map(p)
  const divisions = Math.max(1, Math.ceil(turns * 128))
  const coil = Array.from({ length: divisions + 1 }, (_, i): Point => {
    const turn = turns * i / divisions, angle = turn * TAU
    return [1.2 + radius * Math.cos(angle), top - pitch * turn, -radius * Math.sin(angle)]
  })
  const angle = turns * TAU
  const radial = new Vector3(Math.cos(angle), 0, -Math.sin(angle))
  const tangent = new Vector3(-radius * TAU * Math.sin(angle), -pitch, -radius * TAU * Math.cos(angle)).normalize()
  return { main, join, coil, radius, pitch, top, radial, tangent,
    core: [...main, ...join.slice(1), ...coil.slice(1)] }
}

// Curva livre em U: duas pernas retas e uma semicircunferência. Ao contrário
// de uma Bézier muito comprida, seu raio não colapsa ao acomodar a sobra.
function freeTail(exit: Point, tangent: Vector3, radial: Vector3, length: number): Point[] {
  const gap = Math.min(1.35, Math.max(.45, (length - .25) * 2 / Math.PI * .9))
  const delta = radial.clone().multiplyScalar(gap).add(new Vector3(0, -.35, 0))
  const axial = delta.dot(tangent)
  const across = delta.clone().addScaledVector(tangent, -axial)
  const radius = across.length() / 2
  const normal = across.normalize()
  const leg = (length + axial - Math.PI * radius) / 2
  if (leg < Math.max(0, axial)) throw new Error('Comprimento insuficiente para conduzir a ponta pela abertura.')
  const origin = v(exit)
  const a = origin.clone().addScaledVector(tangent, leg)
  const center = a.clone().addScaledVector(normal, radius)
  const result: Point[] = []
  for (let i = 0; i <= 24; i++) result.push(p(origin.clone().addScaledVector(tangent, leg * i / 24)))
  for (let i = 1; i <= 64; i++) {
    const angle = Math.PI * i / 64
    result.push(p(center.clone().addScaledVector(normal, -radius * Math.cos(angle))
      .addScaledVector(tangent, radius * Math.sin(angle))))
  }
  const end = center.clone().addScaledVector(normal, radius)
  const tip = origin.clone().add(delta)
  for (let i = 1; i <= 24; i++) result.push(p(end.clone().lerp(tip, i / 24)))
  return result
}

function assemble(core: Point[], tail: Point[], standing: number): Point[] {
  const start = v(core[0])
  const direction = v(core[1]).sub(start)
  const extent = pathLength(core)
  if (direction.lengthSq() < 1e-14) direction.set(1, 0, 0)
  direction.normalize().lerp(new Vector3(1, 0, 0), 1 - smoothMotion(extent / .5)).normalize()
  const entry = start.clone().add(new Vector3(-1.2, 0, 0))
  const neck = new CubicBezierCurve3(entry, entry.clone().add(new Vector3(.5, 0, 0)),
    start.clone().addScaledVector(direction, -.5), start).getPoints(48).map(p)
  const straightLength = standing - pathLength(neck)
  const raw = [p(entry.clone().add(new Vector3(-straightLength, 0, 0))), ...neck, ...core.slice(1), ...tail.slice(1)]
  return samplePath(raw.map(point => point.map(x => x * SCALE) as Point), DOUBLE_OVERHAND_SAMPLES)
}

function orientBarrel(points: Point[], tension: number): Point[] {
  const angle = Math.PI / 2 * tension
  const cosine = Math.cos(angle), sine = Math.sin(angle)
  return points.map(([x, y, z]): Point => [
    1.2 + (x - 1.2) * cosine - (y + .2) * sine,
    -.2 + (x - 1.2) * sine + (y + .2) * cosine,
    z,
  ])
}

/** Guias completas antes da escala da cena, também usadas para validar as poses. */
export function doubleOverhandGuides(turns: number, dress = 0, tension = 0) {
  const shape = geometry(turns, dress, tension)
  const coreLength = pathLength(shape.core)
  const available = 2.5
  let tail = freeTail(shape.core[shape.core.length - 1], shape.tangent, shape.radial, available)
  if (tension) {
    const exit = v(tail[0])
    const tip = new Vector3(1.2, -2.4, -.4)
    const straight = new CubicBezierCurve3(exit, exit.clone().addScaledVector(shape.tangent, .6),
      tip.clone().add(new Vector3(0, .6, 0)), tip).getSpacedPoints(112).map(p)
    const source = samplePath(tail, 112)
    tail = source.map((a, i) => p(v(a).lerp(v(straight[i]), tension)))
  }
  const standing = LENGTH - coreLength - pathLength(tail)
  return { loop: orientBarrel(shape.main, tension), connector: orientBarrel(shape.join, tension),
    coils: orientBarrel(shape.coil, tension), tail: orientBarrel(tail, tension), standing }
}

export function doubleOverhandPose(turns: number, dress = 0, tension = 0): Point[] {
  const guides = doubleOverhandGuides(turns, dress, tension)
  const core = [...guides.loop, ...guides.connector.slice(1), ...guides.coils.slice(1)]
  return assemble(core, guides.tail, guides.standing)
}

export function doubleOverhandFormation(fraction: number): Point[] {
  const u = smoothMotion(fraction)
  const shape = geometry(0)
  const curve = loop(0)
  const reveal = smoothMotion(Math.min(1, u / .75))
  const core = Array.from({ length: 241 }, (_, i) => p(curve.getPointAt(reveal * i / 240)))
  if (u > .75) {
    const join = spline(shape.join)
    const reveal = smoothMotion((u - .75) / .25)
    for (let i = 1; i <= 64; i++) core.push(p(join.getPointAt(reveal * i / 64)))
  }
  const available = 2.5
  const ready = freeTail(shape.core[shape.core.length - 1], shape.tangent, shape.radial, available)
  const anchor = v(core[core.length - 1])
  const from = u < .75 ? curve.getTangentAt(reveal) : spline(shape.join).getTangentAt(smoothMotion((u - .75) / .25))
  if (u < .1) from.lerp(new Vector3(1, 0, 0), 1 - smoothMotion(u / .1)).normalize()
  let tail = Array.from({ length: 113 }, (_, i) => p(anchor.clone().addScaledVector(from, available * i / 112)))
  if (u > .9) {
    const source = samplePath(ready, 112)
    const shift = anchor.clone().sub(v(ready[0]))
    const weight = smoothMotion((u - .9) / .1)
    tail = tail.map((a, i) => p(v(a).lerp(v(source[i]).add(shift), weight)))
  }
  tail = tail.map((a, i): Point => [a[0], a[1], a[2] + .5 * Math.sin(Math.PI * u) ** 2 * smoothMotion(i / (tail.length - 1))])
  const points = assemble(core, tail, LENGTH - pathLength(core) - pathLength(tail))
  if (u < .1) for (let i = 0; i < points.length; i++) points[i][1] += .025 * (1 - u / .1) * Math.sin(i / DOUBLE_OVERHAND_SAMPLES * Math.PI * 2)
  return points
}

export function buildDoubleOverhandFrames(plan: Plan): Frame[] {
  const working = plan.passos[1].pontas[0] === plan.pontas[0] ? 'A' : 'B'
  // `cruzar a b` coloca a primeira ponta sobre a segunda. A guia canônica
  // tem a ponta móvel por cima; espelhá-la conserva todos os cruzamentos.
  const depth = plan.passos[0].pontas[0] === plan.passos[1].pontas[0] ? 1 : -1
  const orient = (points: Point[]) => points.map(([x, y, z]): Point => [x, y, depth * z])
  const pose = (turns: number, dress = 0, tension = 0) => orient(doubleOverhandPose(turns, dress, tension))
  const formation = (fraction: number) => orient(doubleOverhandFormation(fraction))
  const make = (points: Point[], phase: NonNullable<Frame['knot']>['phase'], stage: string, passes: number, tightness = 0): Frame => ({ points,
    tips: working === 'B' ? [points[0], points[points.length - 1]] : [points[points.length - 1], points[0]],
    knot: { id: 'double-overhand', phase, stage, passes, tightness,
      labels: [working === 'B' ? 'A' : 'B', working], workingTip: working, length: DOUBLE_OVERHAND_LENGTH, focus: [.65, -.2, 0] } })
  const frames = [make(formation(0), 'initial', 'Corda estendida', 0)]
  const poses = [make(formation(1), 'loop', 'Formar o laço', 0),
    make(pose(1), 'first-pass', 'Primeira passagem pela abertura', 1),
    make(pose(2), 'second-pass', 'Segunda passagem pela mesma abertura', 2),
    make(pose(2, 1, 1), 'tighten', 'Apertar gradualmente', 2, 1)]
  const { durations, dressingFraction } = getDoubleOverhandTimeline()
  for (let i = 0; i < poses.length; i++) {
    const next = poses[i]
    next.duration = durations[i]
    next.motion = bakeMotion(frames[frames.length - 1], next, t => {
      if (i === 0) return formation(t)
      if (i === 1) return pose(passageProgress(t))
      if (i === 2) return pose(1 + passageProgress(t))
      return t < dressingFraction ? pose(2, smoothMotion(t / dressingFraction))
        : pose(2, 1, smoothMotion((t - dressingFraction) / (1 - dressingFraction)))
    }, 160, undefined, 0)
    frames.push(next)
  }
  frames.push(make(frames[4].points, 'finished', 'Nó simples duplo finalizado', 2, 1))
  frames[5].duration = durations[4]
  return frames.slice(0, plan.passos.length + 1)
}
