import { CatmullRomCurve3, Vector3 } from 'three'
import { bakeMotion } from '../ropeMotion'
import { smoothMotion, type Frame, type Plan, type Point } from '../types'

export function matchesShoelace(plan: Plan) {
  const steps = plan.passos.at(-1)?.acao === 'finalizar' ? plan.passos.slice(0, -1) : plan.passos
  if (steps.map(step => step.acao).join(',') !== 'cruzar,passar_baixo,apertar,enrolar,enrolar,cruzar,passar_baixo,apertar') return false
  const [a, b] = steps[0].pontas
  return steps[1].pontas[0] === a && steps[3].pontas[0] === a && steps[3].valor === 1
    && steps[4].pontas[0] === b && steps[4].valor === 1 && steps[6].pontas[0] === b
    && steps[5].pontas[0] === b && steps[5].pontas[1] === a
}

// Coordinates on the sloping tongue: across the shoe, toward the toe, above the leather.
function onTongue([across, along, lift]: Point): Point {
  return [-.86 + along, 1.02 - .36 * along + lift, across]
}

export const eyelets = Array.from({ length: 4 }, (_, row) =>
  [-1, 1].map(side => onTongue([side * (.58 - row * .035), row * .38, 0])))

function trace(points: Point[], segments: number) {
  return new CatmullRomCurve3(points.map(p => new Vector3(...p))).getPoints(segments).map(p => p.toArray() as Point)
}

// Follow one lace all the way down through the eyelets and back up the other side.
function lacing() {
  const half = (side: number): Point[] => {
    const path: Point[] = []
    for (let row = 0; row < eyelets.length; row++) {
      path.push(eyelets[row][side])
      if (row === eyelets.length - 1) break
      const along = (row + .5) * .38 + (side ? .02 : -.02)
      path.push(onTongue([0, along, side ? .21 : .075]))
      side = 1 - side
    }
    return path
  }
  return trace([...half(0), onTongue([0, 1.22, .09]), ...half(1).reverse()], 120)
}

const stages = [
  ['Pontas nos ilhoses', ''],
  ['Cruzar as pontas', 'Coloque a ponta A sobre a ponta B.'],
  ['Passar a ponta A por baixo', 'Leve A por trás de B e passe a ponta pela abertura.'],
  ['Ajustar o primeiro nó', 'Puxe as pontas para os lados, junto à língua do tênis.'],
  ['Formar a alça A', 'Dobre a ponta A de volta em direção ao nó.'],
  ['Formar a alça B', 'Faça a mesma dobra com a ponta B.'],
  ['Cruzar as duas alças', 'Coloque a alça B sobre a alça A.'],
  ['Passar a alça B por baixo', 'Passe a dobra de B inteira pela abertura entre as alças.'],
  ['Apertar o laço', 'Puxe pelas duas alças, deixando as pontas livres.'],
]

// Each branch has matching landmarks from its eyelet to its aglet in every pose.
function branch(stage: number, side: number): Point[] {
  const at = (width: number, along: number, up: number): Point => [side * width, along, up]
  const eye = at(.58, 0, 0)
  if (stage === 0) return [eye, at(.72, -.03, .08), at(.87, -.09, .13), at(1.04, -.15, .12),
    at(1.32, -.22, .05), at(1.59, -.33, -.14), at(1.88, -.47, -.42), at(2.12, -.59, -.69),
    at(2.36, -.73, -.96), at(2.58, -.82, -1.14), at(2.82, -.93, -1.29)]
  const upper = side > 0 ? .18 : 0
  const base = stage === 1 ? [eye, at(.35, -.06, .24 + upper), at(0, -.17, .38 + upper), at(-.31, -.23, .52)]
    : [eye, at(.32, -.11, .15 + upper), at(0, -.19 + side * .085, .19 + upper),
      at(-.20, -.23 + side * .11, stage === 2 ? .52 : .24)]
  const folded = stage >= (side > 0 ? 4 : 5)
  if (!folded) {
    const raised = stage < 3 ? .57 : 0
    return [...base, at(-.53, -.24, .36 + raised), at(-.88, -.23, .39 + raised), at(-1.24, -.21, .36 + raised),
      at(-1.60, -.22, .23 + raised), at(-1.95, -.29, .03 + raised), at(-2.28, -.42, -.25 + raised),
      at(-2.58, -.53, -.54 + raised)]
  }
  // Carry the doubled strand through the second crossing. The aglet stays outside.
  const crossed = stage >= 6
  const spread = stage >= 8 ? 1.46 : stage === 7 ? 1.02 : crossed ? .78 : 1.12
  const direction = crossed ? 1 : -1
  const over = side < 0 && stage === 6 ? .52 : 0
  const rise = stage === 8 ? .02 : .30
  const slant = side * (crossed ? 1.02 : .55)
  return [...base,
    at(direction * .18, -.28 + side * .08, .39 + over),
    at(direction * spread * .61, -.70 + slant * .68, .63 + rise + over),
    at(direction * spread, -.39 + slant, .49 + rise + over),
    at(direction * spread * .76, -.01 + slant * .70, .32 + rise + over),
    at(direction * .17, -.12 + side * .11, .26 + over),
    at(-.65, .28 - side * .18, .29),
    at(-1.36, .70 - side * .42, -.18)]
}

export function buildShoelaceFrames(plan: Plan): Frame[] {
  const fixed = lacing()
  const pose = (from: number, to: number, fraction: number) => {
    const t = smoothMotion(fraction)
    const free = (side: number) => {
      const start = branch(from, side)
      return trace(branch(to, side).map((end, i) => {
        const p = end.map((v, axis) => start[i][axis] + (v - start[i][axis]) * t) as Point
        const arc = Math.sin(Math.PI * t)
        if (to === 1) {
          const reach = Math.abs(end[0] - start[i][0]) / 2
          p[1] += side * reach * arc * .65
          p[2] += reach * arc * .88
        }
        // Turn both bights around the knot so their loops remain open as they exchange sides.
        if (to === 6) p[1] += (end[0] - start[i][0]) * .55 * arc
        // Feed the aglet or the folded bight back through the open crossing before pulling outward.
        if ((to === 2 && side > 0) || (to === 7 && side < 0)) {
          const weight = to === 2 ? smoothMotion((i - 5) / 5) : Math.max(0, 1 - Math.abs(i - 6) / 3)
          p[0] += (.09 - p[0]) * arc * weight
          p[1] += .53 * arc * weight
          p[2] += (.31 - p[2]) * arc * weight
        }
        return onTongue(p)
      }), 84)
    }
    return [...free(-1).reverse().slice(0, -1), ...fixed, ...free(1).slice(1)]
  }
  const frames: Frame[] = []
  for (const [i, [stage, instruction]] of stages.entries()) {
    const points = pose(i, i, 1)
    const next: Frame = { points, tips: [points.at(-1)!, points[0]],
      scenario: { kind: 'shoelace', stage, instruction, finished: false } }
    if (i) next.motion = bakeMotion(frames[i - 1], next, t => pose(i - 1, i, t), 32)
    frames.push(next)
  }
  if (plan.passos.at(-1)?.acao === 'finalizar') {
    const { points, tips } = frames.at(-1)!
    frames.push({ points, tips, scenario: { kind: 'shoelace', stage: 'Tênis amarrado', finished: true } })
  }
  return frames
}
