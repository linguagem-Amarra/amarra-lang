import type { Point } from '../types'

const clamp = (x: number) => Math.max(0, Math.min(1, x))

/** Distância entre os segmentos fechados AB e CD, incluindo seus interiores. */
export function segmentDistance(a: Point, b: Point, c: Point, d: Point) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
  const vx = d[0] - c[0], vy = d[1] - c[1], vz = d[2] - c[2]
  const wx = a[0] - c[0], wy = a[1] - c[1], wz = a[2] - c[2]
  const aa = ux * ux + uy * uy + uz * uz, bb = ux * vx + uy * vy + uz * vz
  const cc = vx * vx + vy * vy + vz * vz, dd = ux * wx + uy * wy + uz * wz, ee = vx * wx + vy * wy + vz * wz
  const determinant = aa * cc - bb * bb
  let s = aa < 1e-14 ? 0 : determinant > 1e-14 ? clamp((bb * ee - cc * dd) / determinant) : 0
  let t = cc < 1e-14 ? 0 : (bb * s + ee) / cc
  if (cc < 1e-14) s = aa > 1e-14 ? clamp(-dd / aa) : 0
  else if (t < 0) { t = 0; s = aa > 1e-14 ? clamp(-dd / aa) : 0 }
  else if (t > 1) { t = 1; s = aa > 1e-14 ? clamp((bb - dd) / aa) : 0 }
  return Math.hypot(wx + s * ux - t * vx, wy + s * uy - t * vy, wz + s * uz - t * vz)
}

/** Descarta apenas vizinhos materiais, e verifica contatos entre segmentos. */
export function minimumRopeSeparation(points: Point[], materialGap = .45) {
  const lengths = new Float64Array(points.length)
  const bounds = new Float64Array((points.length - 1) * 6)
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    lengths[i] = lengths[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    for (let axis = 0; axis < 3; axis++) {
      bounds[(i - 1) * 6 + axis] = Math.min(a[axis], b[axis])
      bounds[(i - 1) * 6 + axis + 3] = Math.max(a[axis], b[axis])
    }
  }
  let minimumSquared = Infinity
  for (let i = 0; i < points.length - 1; i++) for (let j = i + 2; j < points.length - 1; j++) {
    if (lengths[j] - lengths[i + 1] < materialGap) continue
    const left = i * 6, right = j * 6
    const x = Math.max(0, bounds[left] - bounds[right + 3], bounds[right] - bounds[left + 3])
    const y = Math.max(0, bounds[left + 1] - bounds[right + 4], bounds[right + 1] - bounds[left + 4])
    const z = Math.max(0, bounds[left + 2] - bounds[right + 5], bounds[right + 2] - bounds[left + 5])
    if (x * x + y * y + z * z >= minimumSquared) continue
    const distance = segmentDistance(points[i], points[i + 1], points[j], points[j + 1])
    minimumSquared = Math.min(minimumSquared, distance * distance)
  }
  return Math.sqrt(minimumSquared)
}
