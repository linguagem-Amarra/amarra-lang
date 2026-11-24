import { Quaternion, Vector3 } from 'three'

// Referência fixa e transporte paralelo: evita a troca abrupta de orientação
// das seções do tubo quando o tangente muda de componente dominante.
type SurfaceFrames = { tangents: Vector3[]; normals: Vector3[]; binormals: Vector3[]; rotation: Quaternion }

export function transportedFrames(points: Vector3[], reusable?: SurfaceFrames): SurfaceFrames {
  const result = reusable?.tangents.length === points.length ? reusable : {
    tangents: points.map(() => new Vector3()), normals: points.map(() => new Vector3()),
    binormals: points.map(() => new Vector3()), rotation: new Quaternion(),
  }
  const { tangents, normals, binormals, rotation } = result
  for (let i = 0; i < points.length; i++) tangents[i].subVectors(points[Math.min(points.length - 1, i + 1)], points[Math.max(0, i - 1)]).normalize()
  const seed = normals[0].set(0, 0, 1)
  seed.addScaledVector(tangents[0], -seed.dot(tangents[0]))
  if (seed.lengthSq() < 1e-8) seed.set(0, 1, 0).addScaledVector(tangents[0], -tangents[0].y)
  seed.normalize()
  binormals[0].crossVectors(tangents[0], seed).normalize()
  for (let i = 1; i < points.length; i++) {
    rotation.setFromUnitVectors(tangents[i - 1], tangents[i])
    const normal = normals[i].copy(normals[i - 1]).applyQuaternion(rotation)
    normal.addScaledVector(tangents[i], -normal.dot(tangents[i])).normalize()
    binormals[i].crossVectors(tangents[i], normal).normalize()
  }
  return result
}
