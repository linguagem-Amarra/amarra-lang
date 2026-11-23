import { CatmullRomCurve3, Vector3 } from 'three'
import { pathLength, samplePath } from '../ropeWinding'
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

// Parâmetros em unidades da cena, com uma amostra sempre na mesma posição
// material do cadarço. A porção entre os ilhoses fica fixa durante todo o nó.
const FREE_LENGTH = { A: 7.25, B: 9.00 }
const fixed = lacing()
const laceLength = FREE_LENGTH.A + FREE_LENGTH.B + pathLength(fixed)
export const eyeletFractions = [FREE_LENGTH.B / laceLength, 1 - FREE_LENGTH.A / laceLength]
const SEGMENTS = 224
const TAU = 2 * Math.PI
const durations = [0, 4.0, 4.2, 2.3, 3.6, 3.6, 3.2, 4.6, 3.0]
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const phase = (time: number, start: number, end: number) => smoothMotion((time - start) / (end - start))

function rotateAt(point: Point, pivot: Point, angle: number): Point {
  const x = point[0] - pivot[0], y = point[1] - pivot[1]
  return [pivot[0] + x * Math.cos(angle) - y * Math.sin(angle),
    pivot[1] + x * Math.sin(angle) + y * Math.cos(angle), point[2]]
}

// A forma uma volta em torno de B. A seção que sustenta a volta se mantém
// imóvel enquanto a ponta atravessa a abertura.
function basePath(time: number, side: number): Point[] {
  const tight = phase(time, 2.07, 2.89), turn = phase(time, 1.06, 1.89)
  const h = mix(.57, .18, tight), r = mix(.32, .135, tight)
  const span = mix(.33, .23, tight), along = -.28
  const eye: Point = [side * .58, 0, 0]
  const guides: Point[] = [eye, [side * .47, -.15, .66 * h]]
  for (let i = 0; i <= 24; i++) {
    const u = i / 24, angle = TAU * turn * smoothMotion(u)
    guides.push([side * span * (1 - 2 * u), along + (side > 0 ? r * Math.sin(angle) : 0),
      h + (side > 0 ? r * Math.cos(angle) : 0)])
  }
  const cross = side < 0 ? phase(time, .03, .80) : phase(time, .12, .93)
  return guides.map(p => rotateAt(p, eye, (1 - cross) * Math.PI * .73))
}

function bight(base: Point, side: number, time: number): Point[] {
  const cross = phase(time, side > 0 ? 5.05 : 5.27, side > 0 ? 5.68 : 5.92)
  const thread = phase(time, 6.06, 6.91), tight = phase(time, 7.08, 7.88)
  // O eixo da segunda meia-volta é a alça A dobrada. B a envolve no
  // sentido inverso ao primeiro nó, levando os dois ramos da dobra juntos.
  const span = mix(.28, .22, tight), r = mix(.27, .245, tight)
  const centerH = mix(.53, .42, tight), centerY = -.49
  const rail = (u: number, edge: number): Point => {
    const angle = -TAU * thread * smoothMotion(u)
    const x = side * span * (2 * u - 1)
    if (side > 0) return [x, centerY + edge * .077, centerH]
    const radius = r + edge * .072
    return [x, centerY + radius * Math.sin(angle), centerH + radius * Math.cos(angle)]
  }
  const guide: Point[] = [base]
  for (let i = 0; i <= 20; i++) guide.push(rail(i / 20, -1))
  const exit = rail(1, 0), front = rail(1, -1), back = rail(1, 1)
  // A folga da dobra alimenta a volta. Puxar as alças recupera largura
  // quando o miolo se acomoda sobre a língua.
  const reach = side > 0 ? mix(1.10, 1.23, tight) : 1.08 - .61 * thread + .68 * tight - .50 * Math.sin(Math.PI * thread)
  const width = side > 0 ? .34 : .29 - .12 * thread + .15 * tight
  for (let i = 1; i < 40; i++) {
    const theta = i / 40 * Math.PI, s = Math.sin(theta), c = Math.cos(theta)
    guide.push([exit[0] + side * reach * s, exit[1] + c * (front[1] - back[1]) / 2 - c * width * s + .22 * s,
      exit[2] + c * (front[2] - back[2]) / 2 + (.16 - .36 * tight) * s - (side < 0 ? .12 * thread * s : 0)])
  }
  for (let i = 20; i >= 0; i--) guide.push(rail(i / 20, 1))
  guide.push([base[0] - side * .035, base[1] + .16, base[2] + .09])
  // Girar em torno da pinça mantém o espaço interno das alças no cruzamento.
  return guide.map(p => rotateAt(p, base, (1 - cross) * Math.PI * .87))
}

// A ponteira entra primeiro no vão entre B e a língua. A folga que volta
// em direção ao nó forma uma barriga no lado livre; seu tamanho vem do
// comprimento disponível entre a última volta e a ponteira.
function threadAglet(path: Point[], start: number, time: number) {
  const grip = phase(time, 1.01, 1.43) * (1 - phase(time, 1.62, 1.95))
  if (!grip) return path
  const loose = samplePath(path.slice(start), 80)
  const goal = onTongue([-.035, mix(-.80, .17, phase(time, 1.35, 1.68)), .26])
  const tip = loose.at(-1)!
  const budget = pathLength(path.slice(start))
  const bend = (slack: number) => loose.map((p, i): Point => {
    const u = i / (loose.length - 1), pull = grip * smoothMotion(u)
    return [p[0] + (goal[0] - tip[0]) * pull,
      Math.max(-.735, p[1] + (goal[1] - tip[1]) * pull),
      p[2] + (goal[2] - tip[2]) * pull - slack * Math.sin(Math.PI * u) ** 2]
  })
  let low = 0, high = budget
  for (let i = 0; i < 16; i++) {
    const mid = (low + high) / 2
    if (pathLength(bend(mid)) < budget) low = mid
    else high = mid
  }
  return [...path.slice(0, start), ...bend((low + high) / 2)]
}

// As duas ponteiras começam ao alcance das mãos. A folga pende do lado
// de fora de cada ilhós e é recolhida quando o primeiro nó é ajustado.
function drapeAtEyelet(path: Point[], side: number, extra: number) {
  if (extra < .001) return path
  const segment = samplePath(path.slice(0, 3), 32)
  const span = pathLength(path.slice(0, 3)) + extra
  const sag = (reach: number) => segment.map(([x, y, width], i): Point => {
    const u = i / 32, arch = Math.sin(Math.PI * u)
    const z = width + side * reach * arch
    return [x + reach * arch * (.32 + .38 * Math.cos(Math.PI * u)),
      y - Math.min(1.65, reach) * arch * phase(Math.abs(z), .62, 1.45), z]
  })
  let low = 0, high = span / 2 + .5
  for (let i = 0; i < 16; i++) {
    const mid = (low + high) / 2
    if (pathLength(sag(mid)) < span) low = mid
    else high = mid
  }
  return [...sag((low + high) / 2), ...path.slice(3)]
}

function freeBranch(time: number, side: number): Point[] {
  const base = basePath(time, side)
  const root = base.at(-1)!
  const foldStart = side > 0 ? 3 : 4
  const fold = phase(time, foldStart + .06, foldStart + .91)
  let guide = base
  if (fold > 0) {
    const loop = trace(bight(root, side, time), 120)
    const length = (loop.length - 1) * fold, end = Math.floor(length)
    guide = [...base, ...loop.slice(1, end + 1)]
    if (end < loop.length - 1) guide.push(loop[end].map((n, axis) => mix(n, loop[end + 1][axis], length - end)) as Point)
  }

  const budget = FREE_LENGTH[side > 0 ? 'A' : 'B']
  const bare = guide.map(onTongue)
  const slack = Math.max(0, budget - pathLength(bare) - (side > 0 ? 1.9 : 1.25)) * (1 - phase(time, 2.05, 2.93))
  const path = drapeAtEyelet(bare, side, slack)
  const baseEnd = base.length - 1 + path.length - bare.length
  let remaining = budget - pathLength(path)
  const end = new Vector3(...path.at(-1)!)
  // Uma tangente média evita chicotadas na ponteira ao avançar a dobra.
  let behind = path.length - 2
  while (behind > 0 && end.distanceTo(new Vector3(...path[behind])) < .14) behind--
  const tangent = end.clone().sub(new Vector3(...path[behind])).normalize()
  const cross = side < 0 ? phase(time, .03, .80) : phase(time, .12, .93)
  const heading = (side > 0 ? Math.PI : 0) + (1 - cross) * Math.PI * .73 - side * .88 * fold
  const curveSign = -side
  let previous = end
  for (let t = .05; remaining > 1e-8; t += .05) {
    const lead = .36 * (1 - Math.exp(-t / .36)), run = t - lead
    const angle = curveSign * Math.min(run * .39, 2.5)
    const arc = Math.abs(angle) < .0001 ? run : run * Math.sin(angle / 2) / (angle / 2)
    const next = end.clone().addScaledVector(tangent, lead)
    next.z += arc * Math.cos(heading + angle / 2)
    next.x += arc * Math.sin(heading + angle / 2)
    const overShoe = 1 - phase(Math.abs(next.z), .61, 1.28)
    const support = mix(-.735, Math.min(1.05, 1.05 - .36 * (next.x + .86)), overShoe)
    next.y = Math.max(support, next.y - .17 * run - .14 * run * run)
    const step = previous.distanceTo(next)
    if (step > remaining) next.lerp(previous, 1 - remaining / step)
    path.push(next.toArray() as Point)
    previous = next
    remaining -= step
  }
  return samplePath(side > 0 ? threadAglet(path, baseEnd, time) : path, SEGMENTS)
}

export function buildShoelaceFrames(plan: Plan): Frame[] {
  const pose = (time: number) => [...freeBranch(time, -1).reverse().slice(0, -1), ...fixed, ...freeBranch(time, 1).slice(1)]
  const frames: Frame[] = []
  for (const [i, [stage, instruction]] of stages.entries()) {
    const points = pose(i)
    const next: Frame = { points, tips: [points.at(-1)!, points[0]], duration: durations[i],
      scenario: { kind: 'shoelace', stage, instruction, finished: false } }
    if (i) {
      // Distribui o tempo pela distância percorrida no gesto. A ponteira e a
      // dobra desaceleram à entrada e à saída, inclusive ao dobrar uma ponta longa.
      let previous = frames[i - 1].points
      const travel = [0]
      for (let j = 1; j <= 96; j++) {
        const current = pose(i - 1 + j / 96)
        let distance = 0
        for (const [k, p] of current.entries()) {
          const q = previous[k]
          distance = Math.max(distance, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))
        }
        travel.push(travel[j - 1] + distance)
        previous = current
      }
      next.motion = bakeMotion(frames[i - 1], next, t => {
        const at = travel.at(-1)! * phase(t, .025, .94)
        const j = travel.findIndex((d, k) => k > 0 && d >= at)
        const f = (at - travel[j - 1]) / Math.max(1e-8, travel[j] - travel[j - 1])
        return pose(i - 1 + (j - 1 + f) / 96)
      }, 96, undefined, 0)
    }
    frames.push(next)
  }
  if (plan.passos.at(-1)?.acao === 'finalizar') {
    const { points, tips } = frames.at(-1)!
    frames.push({ points, tips, scenario: { kind: 'shoelace', stage: 'Tênis amarrado', finished: true } })
  }
  return frames
}
