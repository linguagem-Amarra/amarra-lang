import { CatmullRomCurve3, Vector3 } from 'three'
import type { Frame, Point } from '../types'
import { sampleMotion } from '../ropeMotion'
import { minimumRopeSeparation } from './RopeValidation'

export type MotionValidation = { poses: number; minimumSeparation: number; minimumCurvatureRadius: number; maximumLengthError: number }

/** Validação amostrada e adaptativa, executada antes de publicar o cache do nó. */
export function validateKnotMotion(frames: Frame[], radius: number, length: number): MotionValidation {
  if (!frames.length || !(radius > 0) || !(length > 0)) throw new Error('Dimensões da corda inválidas.')
  const count = frames[0].points.length
  const clearance = 2 * radius + .005
  const report: MotionValidation = { poses: 0, minimumSeparation: Infinity, minimumCurvatureRadius: Infinity, maximumLengthError: 0 }
  const inspect = (points: Point[], step: number, fraction: number) => {
    const where = `etapa ${step}, posição ${fraction.toFixed(4)}`
    if (points.length !== count || count < 2 || points.some(p => p.length !== 3 || p.some(x => !Number.isFinite(x)))) throw new Error(`Linha central inválida na ${where}.`)
    const curve = new CatmullRomCurve3(points.map(p => new Vector3(...p)), false, 'centripetal')
    curve.arcLengthDivisions = 800
    const rendered = curve.getSpacedPoints(480)
    const gap = minimumRopeSeparation(rendered.map(p => p.toArray() as Point), radius * 3.75)
    let measuredLength = 0, curvature = Infinity
    for (let i = 1; i < rendered.length; i++) {
      measuredLength += rendered[i].distanceTo(rendered[i - 1])
      if (i === rendered.length - 1) continue
      const a = rendered[i].clone().sub(rendered[i - 1]), b = rendered[i + 1].clone().sub(rendered[i])
      const cross = a.clone().cross(b).length()
      if (cross > 1e-10) curvature = Math.min(curvature, a.length() * b.length() * rendered[i + 1].distanceTo(rendered[i - 1]) / (2 * cross))
    }
    const error = Math.abs(measuredLength - length)
    if (gap < clearance) throw new Error(`Trechos da corda se aproximam além da margem na ${where}.`)
    if (curvature < radius) throw new Error(`Dobra menor que a espessura da corda na ${where}.`)
    if (error > length * .005) throw new Error(`Comprimento da corda varia mais de 0,5% na ${where}.`)
    report.poses++
    report.minimumSeparation = Math.min(report.minimumSeparation, gap)
    report.minimumCurvatureRadius = Math.min(report.minimumCurvatureRadius, curvature)
    report.maximumLengthError = Math.max(report.maximumLengthError, error)
    return { points, gap, curvature }
  }
  inspect(frames[0].points, 0, 0)
  for (let step = 1; step < frames.length; step++) {
    const frame = frames[step], source = frames[step - 1]
    inspect(frame.points, step, 1)
    const track = frame.motion
    if (!track) {
      if (frame.points !== source.points && frame.points.some((p, i) => p.some((x, axis) => Math.abs(x - source.points[i]?.[axis]) > 1e-6))) throw new Error(`Falta trajetória contínua na etapa ${step}.`)
      continue
    }
    if (!Number.isInteger(track.samples) || track.samples < 1 || track.particles !== count || track.positions.length !== (track.samples + 1) * count * 3) throw new Error(`Cache incompleto na etapa ${step}.`)
    for (const [fraction, expected] of [[0, source.points], [1, frame.points]] as const) {
      const actual = sampleMotion(track, fraction)
      if (expected.length !== count || actual.some((p, i) => p.some((x, axis) => Math.abs(x - expected[i][axis]) > 1e-5))) throw new Error(`Salto entre etapas na etapa ${step}.`)
    }
    const evaluate = (fraction: number) => inspect(sampleMotion(track, fraction), step, fraction)
    type Pose = ReturnType<typeof evaluate>
    const refine = (a: number, b: number, left: Pose, right: Pose, depth: number) => {
      let travel = 0
      for (let i = 0; i < count; i++) travel = Math.max(travel, Math.hypot(...left.points[i].map((x, axis) => x - right.points[i][axis])))
      const nearContact = Math.min(left.gap, right.gap) < clearance + radius * .3 || Math.min(left.curvature, right.curvature) < radius * 1.2
      if (depth >= 3 || (travel < radius * .5 && (!nearContact || depth > 0))) return
      const middle = (a + b) / 2, pose = evaluate(middle)
      refine(a, middle, left, pose, depth + 1); refine(middle, b, pose, right, depth + 1)
    }
    let previous = evaluate(0)
    for (let sample = 1; sample <= track.samples; sample++) {
      const current = evaluate(sample / track.samples)
      refine((sample - 1) / track.samples, sample / track.samples, previous, current, 0)
      previous = current
    }
  }
  return report
}
