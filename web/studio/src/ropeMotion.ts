import type { Frame, Point } from './types'
import { smoothMotion } from './types'

export type MotionTrack = { positions: Float32Array; samples: number; particles: number }

export function bakeMotion(start: Frame, end: Frame, evaluate: (t: number) => Point[], samples: number,
  repair?: (points: Point[]) => Point[], filterPasses = 1): MotionTrack {
  const particles = start.points.length
  const positions = new Float32Array((samples + 1) * particles * 3)
  for (let sample = 0; sample <= samples; sample++) {
    const points = sample === 0 ? start.points : sample === samples ? end.points : evaluate(sample / samples)
    for (let i = 0; i < particles; i++) positions.set(points[i], (sample * particles + i) * 3)
  }
  // Filtra pequenas mudanças de contato entre amostras, sem alterar as poses
  // inicial/final. A interpolação espacial não deve amplificar impulsos locais.
  const stride = particles * 3
  for (let pass = 0; pass < filterPasses; pass++) {
    const source = positions.slice()
    for (let sample = 1; sample < samples; sample++) {
      const edge = Math.min(1, sample / 4, (samples - sample) / 4)
      const strength = edge * edge * (3 - 2 * edge)
      for (let value = 0; value < stride; value++) {
        const read = (offset: number) => source[Math.max(0, Math.min(samples, sample + offset)) * stride + value]
        const filtered = (read(-2) + 4 * read(-1) + 6 * read(0) + 4 * read(1) + read(2)) / 16
        const index = sample * stride + value
        positions[index] = source[index] + (filtered - source[index]) * strength
      }
    }
  }
  if (repair) for (let sample = 1; sample < samples; sample++) {
    const points: Point[] = []
    for (let i = 0; i < particles; i++) {
      const offset = (sample * particles + i) * 3
      points.push([positions[offset], positions[offset + 1], positions[offset + 2]])
    }
    const repaired = repair(points)
    // A correção espacial precisa desaparecer nas bordas da trajetória;
    // caso contrário a última amostra reparada salta para a pose final.
    const strength = smoothMotion(Math.min(1, sample / 8, (samples - sample) / 8))
    for (let i = 0; i < particles; i++) {
      const point = points[i].map((v, axis) => v + (repaired[i][axis] - v) * strength)
      positions.set(point, (sample * particles + i) * 3)
    }
  }
  return { positions, samples, particles }
}

// A reprodução só interpola uma trajetória já calculada. Não executa um novo
// relaxamento da corda nem depende da ordem dos quadros ou da taxa de atualização.
export function sampleMotion(track: MotionTrack, fraction: number): Point[] {
  const at = Math.max(0, Math.min(track.samples, fraction * track.samples))
  const sample = Math.min(track.samples - 1, Math.floor(at))
  const t = at - sample
  const stride = track.particles * 3
  const read = (frame: number, value: number) => track.positions[Math.max(0, Math.min(track.samples, frame)) * stride + value]
  const output: Point[] = []
  for (let i = 0; i < track.particles; i++) {
    const point: Point = [0, 0, 0]
    for (let axis = 0; axis < 3; axis++) {
      const value = i * 3 + axis
      const a = read(sample, value), b = read(sample + 1, value)
      const before = sample === 0 ? b : read(sample - 1, value)
      const after = sample + 1 === track.samples ? a : read(sample + 2, value)
      point[axis] = .5 * (2 * a + (b - before) * t + (2 * before - 5 * a + 4 * b - after) * t * t
        + (-before + 3 * a - 3 * b + after) * t * t * t)
    }
    output.push(point)
  }
  return output
}
