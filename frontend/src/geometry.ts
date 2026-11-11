import { Vector3 } from 'three'
import type { Frame, Plan, Point } from './types'
import { knotStateAt, smoothMotion, windingProgress } from './types'
import { bakeMotion, sampleMotion } from './ropeMotion'
import { registeredKnot } from './knots/knotRegistry'
import { approachWinding, createWindingGuide, pathLength, samplePath, windingPath, type WindingGuide } from './ropeWinding'
import { CONSTRUCTION_LENGTH, CONSTRUCTION_SAMPLES, crossed, thread, tighten, constrain, initialFrame as constructionFrame } from './ropeConstruction'
export { ROPE_RADIUS, constrain } from './ropeConstruction'

export const SAMPLES = 384
export const ROPE_LENGTH = 26
const TAU = Math.PI * 2
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const blend = (a: Point, b: Point, t: number): Point => a.map((n, i) => mix(n, b[i], t)) as Point

function frame(points: Point[], via?: Point[][]): Frame {
  return { points, tips: [points[points.length - 1], points[0]], ...(via ? { via } : {}) }
}

function sampleRope(path: Point[]): Point[] {
  let points = samplePath(path, SAMPLES)
  // A discretização encurta curvas acentuadas. Repõe esse pequeno saldo na
  // ponta livre e reamostra, sem reescalar o miolo nem mover o apoio.
  for (let pass = 0; pass < 3; pass++) {
    const missing = ROPE_LENGTH - pathLength(points)
    if (missing < .00001) break
    const last = points.length - 1
    const tip = new Vector3(...points[last])
    tip.addScaledVector(tip.clone().sub(new Vector3(...points[last - 1])).normalize(), missing)
    points[last] = tip.toArray() as Point
    points = samplePath(points, SAMPLES)
  }
  return points
}

// Mantém o núcleo da construção na escala original e reserva corda livre
// nas duas caudas desde o início, antes de qualquer enrolamento.
function releaseReserve(construction: Frame, reserve: [number, number] = [.5, .5]): Frame {
  const expand = (points: Point[]) => {
    const path = points.map(p => [...p] as Point)
    const ends = [0, path.length - 1]
    const weights = ends.map((index, end) => reserve[end] * smoothMotion((Math.hypot(points[index][0], points[index][1] + .35, points[index][2]) - 1.5) / 1.5))
    const total = weights[0] + weights[1]
    for (const [end, index] of ends.entries()) {
      const neighbor = points[index === 0 ? 1 : index - 1]
      const tip = new Vector3(...points[index])
      tip.addScaledVector(tip.clone().sub(new Vector3(...neighbor)).normalize(),
        (ROPE_LENGTH - CONSTRUCTION_LENGTH) * (total > 1e-8 ? weights[end] / total : .5))
      path[index] = tip.toArray() as Point
    }
    return samplePath(path, SAMPLES)
  }
  return { ...frame(expand(construction.points), construction.via?.map(expand)), construction, reserve }
}

export function initialFrame(reserve?: [number, number]): Frame {
  return releaseReserve(constructionFrame(), reserve)
}

type WindingState = {
  base: Frame; tip: string; right: boolean; turns: number; tension: number; plannedTurns: number; guide?: WindingGuide
}

function windingPose(state: WindingState, turns: number, tension = state.tension): Frame {
  const guide = state.guide ??= createWindingGuide(state.base.points, state.right, state.plannedTurns)
  const shape = windingPath(guide, turns, tension, ROPE_LENGTH)
  const points = sampleRope(shape.path)
  return { ...frame(state.right ? points : points.reverse()), reinforcement: {
    tip: state.right ? 'A' : 'B', fromTurns: state.turns, turns, tension,
    focus: guide.center.toArray() as Point, coil: shape.coil,
  } }
}

function wind(state: WindingState, turns: number, previous: Frame, samples: number): Frame {
  if (!state.guide) {
    for (let attempt = 0; ; attempt++) {
      state.guide = createWindingGuide(state.base.points, state.right, state.plannedTurns)
      try {
        windingPath(state.guide, state.plannedTurns, 0, ROPE_LENGTH)
        windingPath(state.guide, state.plannedTurns, 1, ROPE_LENGTH)
        break
      } catch (error) {
        if (!(error instanceof RangeError) || attempt >= 3) throw error
        const core = state.base.construction
        if (!core) throw error
        state.base = releaseReserve(frame(constrain(tighten(core).points, 14)), state.base.reserve)
      }
    }
  }
  const guide = state.guide
  const next = windingPose(state, state.turns + turns)
  const preparationTime = state.turns === 0 ? 14 : 0
  next.duration = preparationTime + turns * 9
  next.reinforcement!.approach = state.turns === 0
  next.reinforcement!.approachEnd = preparationTime / next.duration
  const ready = windingPath(guide, state.turns, state.tension, ROPE_LENGTH)
  next.motion = bakeMotion(previous, next, t => {
    if (preparationTime && t < next.reinforcement!.approachEnd!) {
      const u = smoothMotion(t / next.reinforcement!.approachEnd!)
      const path = approachWinding(guide, ready.free, u)
      const points = sampleRope(path)
      return state.right ? points : points.reverse()
    }
    return windingPose(state, state.turns + turns * windingProgress(t, next.reinforcement!)).points
  }, preparationTime ? Math.max(samples, 256) : samples, points => {
    // A filtragem temporal absorve mudanças de contato. Seu saldo de
    // comprimento também é devolvido apenas à ponta que está trabalhando.
    const ordered = state.right ? points : [...points].reverse()
    const corrected = sampleRope(ordered)
    return state.right ? corrected : corrected.reverse()
  })
  return next
}

function tightenReinforcement(state: WindingState, previous: Frame, samples: number): Frame {
  const next = windingPose(state, state.turns, 1)
  next.duration = 3.6
  next.motion = bakeMotion(previous, next, t => windingPose(state, state.turns,
    mix(state.tension, 1, smoothMotion(t))).points, samples, undefined, 0)
  return next
}

export function buildFrames(plan: Plan): Frame[] {
  const knot = registeredKnot(plan)
  if (knot) return knot.build(plan)
  const firstWinding = plan.passos.find(s => s.acao === 'enrolar')
  const reserve: [number, number] = firstWinding?.pontas[0] === plan.pontas[0] ? [.05, .95] : [.5, .5]
  const frames = [initialFrame(reserve)]
  let threaded = false
  let orientation = 1
  let winding: WindingState | null = null
  const motionBudget = Math.max(16, Math.min(96, Math.floor(3072 / Math.max(1,
    plan.passos.filter(s => s.acao === 'enrolar' || s.acao === 'apertar').length))))
  for (const [stepIndex, step] of plan.passos.entries()) {
    const previous = frames[frames.length - 1]
    if (step.acao === 'finalizar') {
      const fixed: Frame = { ...previous }
      delete fixed.motion
      delete fixed.via
      delete fixed.duration
      if (fixed.reinforcement) fixed.reinforcement = { ...fixed.reinforcement,
        fromTurns: fixed.reinforcement.turns, approach: false,
      }
      frames.push(fixed)
      continue
    }
    const base = previous.construction ?? { points: previous.points, tips: previous.tips }
    let next = previous
    switch (step.acao) {
      case 'cruzar':
        winding = null
        orientation = step.pontas[0] === plan.pontas[0] ? 1 : -1
        next = threaded ? frame(base.points.map(([x, y, z], i): Point =>
          [x, y, z + Math.sin(i / CONSTRUCTION_SAMPLES * TAU) * .32 * orientation])) : crossed(orientation)
        break
      case 'passar_baixo':
      case 'passar_cima': {
        winding = null
        const side = step.pontas[0] === plan.pontas[0] ? 1 : -1
        const depth = (step.acao === 'passar_baixo' ? 1 : -1) * orientation
        if (!threaded) next = thread(side, depth)
        else next = frame(base.points.map((p, i): Point => {
          const u = side === 1 ? i / CONSTRUCTION_SAMPLES : 1 - i / CONSTRUCTION_SAMPLES
          const influence = Math.max(0, (u - .6) / .4)
          return [p[0], p[1] - .25 * influence, p[2] + depth * .6 * Math.sin(Math.PI * influence)]
        }))
        threaded = true
        break
      }
      case 'enrolar':
        if (!winding || winding.tip !== step.pontas[0]) {
          let plannedTurns = 0
          for (const upcoming of plan.passos.slice(stepIndex)) {
            if (upcoming.acao === 'apertar') continue
            if (upcoming.acao !== 'enrolar' || upcoming.pontas[0] !== step.pontas[0]) break
            plannedTurns += Number(upcoming.valor)
          }
          winding = { base: previous, tip: step.pontas[0], right: step.pontas[0] === plan.pontas[0],
            turns: 0, tension: 0, plannedTurns }
        }
        next = wind(winding, Number(step.valor), previous, motionBudget)
        winding.turns += Number(step.valor)
        break
      case 'apertar':
        next = winding ? tightenReinforcement(winding, previous, motionBudget) : tighten(base)
        if (winding) winding.tension = 1
        break
    }
    if (next !== previous && !next.motion) next = releaseReserve(frame(constrain(next.points, 14), next.via?.map(p => constrain(p, 14))), reserve)
    frames.push(next)
  }
  return frames
}

export function interpolateFrame(frames: Frame[], progress: number): Frame {
  const bounded = Math.max(0, Math.min(frames.length - 1, progress))
  if (Number.isInteger(bounded)) return frames[bounded]
  const index = Math.floor(bounded)
  const target = frames[index + 1]
  if (target.points === frames[index].points) return target
  if (target.motion) {
    const result = frame(sampleMotion(target.motion, bounded - index))
    const knot = knotStateAt(target.knot, bounded - index)
    if (knot?.labels[0] === 'A') result.tips = [result.points[0], result.points[result.points.length - 1]]
    return { ...result, knot, reinforcement: target.reinforcement ? { ...target.reinforcement,
      turns: mix(target.reinforcement.fromTurns, target.reinforcement.turns,
        windingProgress(bounded - index, target.reinforcement)),
    } : undefined }
  }
  const source = frames[index].construction ?? frames[index]
  const destination = target.construction ?? target
  const poses = [source.points, ...(destination.via ?? []), destination.points]
  const position = (bounded - index) * (poses.length - 1)
  const part = Math.min(poses.length - 2, Math.floor(position))
  const t = position - part
  const eased = t * t * (3 - 2 * t)
  const raw = poses[part].map((p, i) => blend(p, poses[part + 1][i], eased))
  const solved = constrain(raw)
  const ramp = Math.min(1, t * 8, (1 - t) * 8)
  const strength = ramp * ramp * (3 - 2 * ramp)
  const fraction = bounded - index
  const windingFraction = target.reinforcement?.approach ? Math.max(0, (fraction - .2) / .8) : fraction
  return { ...releaseReserve(frame(raw.map((p, i) => blend(p, solved[i], strength))), target.reserve ?? frames[index].reserve),
    ...(target.reinforcement ? { reinforcement: { ...target.reinforcement,
      turns: mix(target.reinforcement.fromTurns, target.reinforcement.turns, windingFraction),
    } } : {}),
  }
}
