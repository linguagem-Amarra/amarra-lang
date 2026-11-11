import { CatmullRomCurve3, Vector3 } from 'three'
import type { Frame, Point } from './types'

export const CONSTRUCTION_SAMPLES = 192
const SAMPLES = CONSTRUCTION_SAMPLES
export const ROPE_RADIUS = .12
export const CONSTRUCTION_LENGTH = 15.5
const ROPE_LENGTH = CONSTRUCTION_LENGTH
const SEGMENT = ROPE_LENGTH / SAMPLES
const clone = (points: Point[]) => points.map(p => [...p] as Point)
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function curve(points: Point[]) {
  const result = new CatmullRomCurve3(points.map(p => new Vector3(...p)), false, 'centripetal')
  result.arcLengthDivisions = 1200
  return result
}

// O comprimento liberado pelo miolo reaparece nas caudas livres ao apertar.
function sample(controls: Point[], free: 'both' | 'start' | 'end' = 'both'): Point[] {
  const original = clone(controls)
  const ends = free === 'both' ? [0, controls.length - 1] : [free === 'start' ? 0 : controls.length - 1]
  const candidates = (scale: number) => {
    const points = clone(original)
    for (const index of ends) {
      const anchor = original[index === 0 ? 1 : index - 1]
      points[index] = anchor.map((v, axis) => v + (original[index][axis] - v) * scale) as Point
    }
    return points
  }
  let lo = .025, hi = 15
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (curve(candidates(mid)).getLength() > ROPE_LENGTH) hi = mid
    else lo = mid
  }
  return curve(candidates((lo + hi) / 2)).getSpacedPoints(SAMPLES).map(p => p.toArray() as Point)
}

function frame(points: Point[], via?: Point[][]): Frame {
  return { points, tips: [points[points.length - 1], points[0]], ...(via ? { via } : {}) }
}

// Restrições locais de comprimento e separação entre trechos não vizinhos.
// O modelo permanece cinemático: não resolve tensão, atrito ou colisão contínua.
export function constrain(points: Point[], iterations = 12): Point[] {
  const result = clone(points)
  const clearance = ROPE_RADIUS * 2.35
  const skip = Math.ceil(clearance / SEGMENT) + 1
  for (let pass = 0; pass < iterations; pass++) {
    // A regularização da curvatura evita vincos no material ao fechar a volta.
    const smooth = result.map((p, i): Point => i === 0 || i === SAMPLES ? [...p]
      : p.map((v, axis) => v * .7 + (result[i - 1][axis] + result[i + 1][axis]) * .15) as Point)
    const directions = smooth.slice(1).map((p, i): Point => {
      const length = distance(p, smooth[i])
      return length < 1e-8 ? [SEGMENT, 0, 0] : p.map((v, axis) => (v - smooth[i][axis]) * SEGMENT / length) as Point
    })
    // Integra segmentos de mesmo comprimento a partir de um ponto material.
    // As pontas ficam livres para absorver o comprimento, sem esticar a corda.
    const center = SAMPLES / 2
    for (let i = center; i < SAMPLES; i++) result[i + 1] = result[i].map((v, axis) => v + directions[i][axis]) as Point
    for (let i = center - 1; i >= 0; i--) result[i] = result[i + 1].map((v, axis) => v - directions[i][axis]) as Point
    {
      for (let i = 0; i <= SAMPLES; i++) {
        for (let j = i + skip; j <= SAMPLES; j++) {
          const a = result[i], b = result[j]
          if (Math.abs(a[0] - b[0]) >= clearance || Math.abs(a[1] - b[1]) >= clearance || Math.abs(a[2] - b[2]) >= clearance) continue
          const length = distance(a, b)
          if (length >= clearance) continue
          const direction: Point = length < 1e-8 ? [0, 0, 1] : a.map((v, axis) => (v - b[axis]) / length) as Point
          const correction = (clearance - length) * .5
          for (let axis = 0; axis < 3; axis++) {
            a[axis] += direction[axis] * correction
            b[axis] -= direction[axis] * correction
          }
        }
      }
    }
  }
  return result
}

export function initialFrame(): Frame {
  return frame(sample([[-3.6, 1.5, 0], [-2.7, .5, 0], [-1.7, -1.55, 0],
    [0, -2.05, 0], [1.7, -1.55, 0], [2.7, .5, 0], [3.6, 1.5, 0]]))
}

// Preserva a mesma volta durante a passagem. A ponta contorna o ramo parado,
// desce atrás da volta, atravessa sua abertura e finalmente é puxada para fora.
const standing: Point[] = [
  [3.2, 1.4, -.32], [1.5, .8, -.32], [0, .25, -.32],
  [-.85, -.4, -.12], [-.95, -1.15, 0], [0, -1.45, 0],
  [.95, -1.15, 0], [.85, -.4, .12], [0, .25, .32],
]

function reflect(points: Point[], side: number, depth: number): Point[] {
  const reflected = points.map(([x, y, z]): Point => [x * side, y, z * depth])
  return side < 0 ? reflected.reverse() : reflected
}

export function crossed(orientation: number): Frame {
  return frame(sample([...standing, [-1.5, .8, .32], [-3.2, 1.4, .32]])
    .map(([x, y, z]): Point => [x, y, z * orientation]))
}

export function thread(side: number, depth: number): Frame {
  const turn: Point[] = [[-.65, .65, .32], [-.95, .65, -.4], [-.5, 0, -.5], [0, -.7, -.5]]
  const through: Point[] = [...turn, [0, -.8, .15], [0, -.8, .65]]
  const pulled: Point[] = [...through, [-.8, -.35, .6], [-2.8, 1.15, .5]]
  const via = [turn, through].map(tail => reflect(sample([...standing, ...tail], 'start'), side, depth))
  return frame(reflect(sample([...standing, ...pulled]), side, depth), via)
}

export function tighten(current: Frame): Frame {
  const controls = current.points.filter((_, i) => i % 8 === 0).map((p): Point => {
    const center = Math.exp(-(p[0] ** 2 + (p[1] + .35) ** 2) / 4)
    const factor = 1 - .65 * center
    return [p[0] * factor, -.35 + (p[1] + .35) * factor, p[2]]
  })
  return frame(sample(controls))
}
