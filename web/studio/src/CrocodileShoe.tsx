import { memo, useEffect, useMemo } from 'react'
import { BufferGeometry, CatmullRomCurve3, DoubleSide, Float32BufferAttribute, Vector3 } from 'three'
import { eyelets } from './knots/shoelaceBow'
import type { Point } from './types'

const leather = '#086449', jade = '#318565', sole = '#14382e', lining = '#132d29'
// Each station gives the lengthwise position, underside, crown, half-width and collar opening.
type Station = [number, number, number, number, number?]
const upper: Station[] = [
  [-2.90, -.54, .39, .07], [-2.79, -.55, .73, .55, .45], [-2.51, -.56, .86, .77, .92],
  [-2.04, -.56, .87, .83, 1.03], [-1.55, -.55, .99, .81, .87], [-1.22, -.55, 1.07, .80, .48],
  [-.94, -.55, 1.02, .80], [-.46, -.55, .87, .84], [.25, -.54, .60, .92],
  [.96, -.52, .37, .95], [1.59, -.50, .23, .82], [1.99, -.45, .13, .62], [2.25, -.37, -.02, .11],
]
const outsole: Station[] = upper.map(([x, bottom, , width]) => [x, bottom - .19, bottom + .19, width * 1.045])
const inside: Station[] = upper.slice(0, 7).map(([x, bottom, top, width, gap]) =>
  [x, bottom + .05, top - .10, width * .94, gap])
const tail: Station[] = [
  [-4.69, -.34, -.31, .025], [-4.40, -.45, -.33, .10], [-4.04, -.46, -.23, .18],
  [-3.65, -.44, -.10, .23], [-3.18, -.40, .10, .31], [-2.75, -.40, .25, .42],
]
const snout: Station[] = [
  [1.36, -.23, .24, .45], [1.73, -.18, .39, .68], [2.13, -.10, .47, .67],
  [2.54, -.07, .32, .55], [3.04, -.04, .24, .44], [3.59, -.02, .23, .33],
  [3.88, .01, .24, .27], [4.03, .06, .18, .07],
]
const jaw: Station[] = [
  [1.66, -.44, -.12, .48], [2.07, -.45, -.14, .59], [2.64, -.47, -.26, .49],
  [3.22, -.50, -.31, .39], [3.68, -.50, -.31, .30], [3.95, -.44, -.32, .10],
]
const gums: Station[] = jaw.map(([x, , top, w]) => [x, top - .085, top + .028, w * .94])

function surface([x, bottom, top, width]: Station, angle: number): Vector3 {
  const sin = Math.sin(angle), cos = Math.cos(angle)
  return new Vector3(x, (top + bottom + (top - bottom) * Math.sign(cos) * Math.abs(cos) ** .77) / 2,
    width * Math.sign(sin) * Math.abs(sin) ** .83)
}

function Shell({ stations, color }: { stations: Station[]; color: string }) {
  const geometry = useMemo(() => {
    const positions: number[] = [], indices: number[] = []
    const rings = 40, slices = stations.length * 5
    for (let i = 0; i <= rings; i++) {
      const line = new CatmullRomCurve3(stations.map(s => {
        const gap = s[4] ?? 0
        return surface(s, gap + (2 * Math.PI - 2 * gap) * i / rings)
      }))
      for (const p of line.getPoints(slices)) positions.push(p.x, p.y, p.z)
      if (!i) continue
      for (let j = 0; j < slices; j++) {
        const a = (i - 1) * (slices + 1) + j, b = a + slices + 1
        indices.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
    for (const end of [0, slices]) {
      for (let i = 1; i < rings - 1; i++) {
        const b = i * (slices + 1) + end, c = b + slices + 1
        indices.push(end, end ? c : b, end ? b : c)
      }
    }
    const mesh = new BufferGeometry()
    mesh.setAttribute('position', new Float32BufferAttribute(positions, 3))
    mesh.setIndex(indices)
    mesh.computeVertexNormals()
    return mesh
  }, [stations])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} castShadow receiveShadow>
    <meshPhysicalMaterial color={color} side={DoubleSide} roughness={.44} clearcoat={.26} />
  </mesh>
}

function Oval({ at, size, color, tilt = 0 }: { at: Point; size: Point; color: string; tilt?: number }) {
  return <mesh position={at} scale={size} rotation={[0, 0, tilt]} castShadow receiveShadow>
    <sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial color={color} roughness={.42} />
  </mesh>
}

function Cord({ path, radius, color }: { path: Point[]; radius: number; color: string }) {
  const curve = useMemo(() => new CatmullRomCurve3(path.map(p => new Vector3(...p))), [path])
  return <mesh castShadow><tubeGeometry args={[curve, path.length * 5, radius, 8, false]} />
    <meshStandardMaterial color={color} roughness={.55} /></mesh>
}

export const CrocodileShoe = memo(function CrocodileShoe() {
  return <group position={[0, -.15, 0]}>
    <Shell stations={outsole} color={sole} /><Shell stations={upper} color={leather} />
    <Shell stations={inside} color={lining} />
    <Oval at={[-2.02, -.10, 0]} size={[.85, .13, .69]} color={lining} />
    <Oval at={[-.49, .79, 0]} size={[.95, .16, .61]} color={jade} tilt={-.34} />
    <Shell stations={tail} color={jade} />
    <Shell stations={jaw} color={jade} /><Shell stations={gums} color="#833f40" />
    <Shell stations={snout} color={jade} />
    {eyelets.flat().map((p, i) => <mesh key={i} position={p} rotation={[-Math.PI / 2, .31, 0]}>
      <torusGeometry args={[.094, .026, 8, 22]} /><meshStandardMaterial color="#c5a761" metalness={.65} roughness={.36} />
    </mesh>)}
    {[-1, 1].map(s => <group key={s}>
      <Cord path={upper.slice(0, 7).map(row => surface(row, s * (row[4] ?? 0)).toArray() as Point)} radius={.055} color="#297e60" />
      <Cord path={upper.map(row => surface(row, s * 2.30).toArray() as Point)} radius={.026} color="#53967a" />
      <Cord path={[[-1.44, .63, s * .66], [-1.24, .30, s * .80], [-1.13, -.15, s * .79],
        [-.55, -.14, s * .85], [.11, .04, s * .89], [.46, .24, s * .76]]} radius={.025} color="#489172" />
      {[-2.05, .96].map(x => <group key={x}>
        <Cord path={[[x, -.20, s * .66], [x - .16, -.26, s * .92], [x - .28, -.48, s * 1.10],
          [x - .07, -.61, s * 1.21]]} radius={.14} color={jade} />
        <Oval at={[x, -.61, s * 1.24]} size={[.25, .115, .20]} color={jade} />
        {[-1, 0, 1].map(toe => <Cord key={toe} path={[[x + toe * .11, -.60, s * 1.24],
          [x + .14 + toe * .14, -.65, s * (1.36 - toe * .05)],
          [x + .24 + toe * .17, -.67, s * (1.43 - toe * .105)]]} radius={.044} color="#488e65" />)}
      </group>)}
      <Oval at={[2.26, .31, s * .44]} size={[.30, .22, .19]} color={leather} />
      <Oval at={[2.34, .34, s * .55]} size={[.17, .15, .12]} color="#dfb867" />
      <Oval at={[2.39, .35, s * .639]} size={[.054, .112, .035]} color="#142f28" />
      <Oval at={[2.41, .40, s * .662]} size={[.026, .031, .015]} color="#fff7d4" />
      <Oval at={[3.79, .216, s * .13]} size={[.085, .027, .051]} color={sole} />
      <Cord path={[[2.37, .43, s * .32], [2.57, .31, s * .32], [2.80, .22, s * .27],
        [3.16, .19, s * .22], [3.46, .19, s * .17]]} radius={.025} color="#459074" />
      {Array.from({ length: 6 }, (_, i) => <Oval key={i}
        at={[2.55 + i * .20, .135 - Math.min(i, 3) * .012, s * (.527 - i * .045)]}
        size={[.045, .024, .029]} color="#22694f" />)}
      {Array.from({ length: 9 }, (_, i) => {
        const x = 2.42 + i * .169, z = s * (.415 - i * .023)
        return <group key={i}>
          <mesh position={[x, -.076 + i * .009, z]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[.058, .16, 9]} /><meshStandardMaterial color="#f6e9bd" />
          </mesh>
          <mesh position={[x + .072, -.235 - Math.min(i, 4) * .012, z]}>
            <coneGeometry args={[.044, .115, 9]} /><meshStandardMaterial color="#eddfa9" />
          </mesh>
        </group>
      })}
    </group>)}
    {tail.slice(1, -1).map(([x, , top], i) => <mesh key={x} position={[x, top + .03, 0]} scale={[1.35, 1, .62]}>
      <coneGeometry args={[.08 + i * .017, .13 + i * .031, 4]} /><meshStandardMaterial color={leather} />
    </mesh>)}
  </group>
})
