import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import { BufferAttribute, CanvasTexture, CatmullRomCurve3, Color, Group, Mesh, PerspectiveCamera, RepeatWrapping, TubeGeometry, Vector3 } from 'three'
import type { Frame, Point } from './types'
import { interpolateFrame, ROPE_RADIUS } from './geometry'
import { transportedFrames } from './ropeSurface'
import type { KnotAnimationEngine } from './animation/KnotAnimationEngine'
import { knotStateAt } from './types'

const RINGS = 480
const SIDES = 16
const crossSection = Array.from({ length: SIDES + 1 }, (_, j) => [-Math.cos(j / SIDES * Math.PI * 2), Math.sin(j / SIDES * Math.PI * 2)])
type PlaybackListener = (position: number, pose: number, playing: boolean) => void
type TipLabels = [RefObject<HTMLSpanElement | null>, RefObject<HTMLSpanElement | null>]

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <div className="scene-fallback">Não foi possível iniciar o WebGL.<br />Verifique a aceleração gráfica do navegador. O editor e os diagnósticos continuam disponíveis.</div> : this.props.children
  }
}

function makeCurve(points: Point[]) {
  const curve = new CatmullRomCurve3(points.map(p => new Vector3(...p)), false, 'centripetal')
  curve.arcLengthDivisions = 800
  return curve
}

function braidTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#858585'
  ctx.fillRect(0, 0, 128, 128)
  for (let direction = -1; direction <= 1; direction += 2) {
    for (let i = -128; i < 256; i += 16) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i + direction * 128, 128)
      ctx.strokeStyle = direction === 1 ? '#d2d2d2' : '#333333'
      ctx.lineWidth = 5
      ctx.stroke()
      ctx.strokeStyle = '#a2a2a2'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(28, 2)
  texture.anisotropy = 8
  return texture
}

function Rope({ frames, progress, engine, onPlayback, tipLabels }: { frames: Frame[]; progress: number; engine?: KnotAnimationEngine; onPlayback?: PlaybackListener; tipLabels: TipLabels }) {
  const firstTip = useRef<Group>(null)
  const lastTip = useRef<Group>(null)
  const lastProgress = useRef(Number.NaN)
  const lastFrames = useRef<Frame[] | null>(null)
  const lastPoints = useRef<Point[] | null>(null)
  const publication = useRef({ time: 0, position: -1, pose: -1, playing: false })
  const scratch = useMemo(() => ({ curve: makeCurve(frames[0].points),
    centers: Array.from({ length: RINGS + 1 }, () => new Vector3()) }), [])
  const axesRef = useRef<ReturnType<typeof transportedFrames>>(undefined)
  const geometry = useMemo(() => {
    const geometry = new TubeGeometry(makeCurve(frames[0].points), RINGS, ROPE_RADIUS, SIDES, false)
    const blue = new Color('#64bcd5'), orange = new Color('#e5a45e')
    const colors = new Float32Array((RINGS + 1) * (SIDES + 1) * 3)
    for (let ring = 0; ring <= RINGS; ring++) {
      const color = blue.clone().lerp(orange, Math.max(0, Math.min(1, (ring / RINGS - .485) / .03)))
      for (let j = 0; j <= SIDES; j++) color.toArray(colors, (ring * (SIDES + 1) + j) * 3)
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3))
    return geometry
  }, [])
  const bump = useMemo(braidTexture, [])
  const knot = frames[0].knot
  const labels = knot?.labels ?? ['B', 'A']
  useEffect(() => {
    const colors = geometry.getAttribute('color') as BufferAttribute
    const blue = new Color('#64bcd5'), orange = new Color('#e5a45e'), body = new Color('#d5bf97')
    for (let ring = 0; ring <= RINGS; ring++) {
      const u = ring / RINGS
      const color = knot ? body.clone().lerp(knot.workingTip === 'B' ? blue : orange, Math.max(0, Math.min(1, (u - .95) / .015)))
        : blue.clone().lerp(orange, Math.max(0, Math.min(1, (u - .485) / .03)))
      for (let j = 0; j <= SIDES; j++) colors.setXYZ(ring * (SIDES + 1) + j, color.r, color.g, color.b)
    }
    colors.needsUpdate = true
  }, [geometry, knot?.id, knot?.workingTip])
  const up = useMemo(() => new Vector3(0, 1, 0), [])
  const labelPosition = useMemo(() => new Vector3(), [])
  useEffect(() => () => { geometry.dispose(); bump.dispose() }, [geometry, bump])

  useFrame(({ clock }, delta) => {
    // O relógio e a malha avançam no mesmo quadro; React publica só os controles.
    engine?.advance(delta)
    const position = Math.max(0, Math.min(frames.length - 1, engine?.posePosition ?? progress))
    if (engine && onPlayback) {
      const last = publication.current, time = clock.elapsedTime
      if (time - last.time >= 1 / 15 || engine.playing !== last.playing || Math.floor(engine.position) !== Math.floor(last.position)) {
        if (last.position !== engine.position || last.pose !== position || last.playing !== engine.playing) onPlayback(engine.position, position, engine.playing)
        publication.current = { time, position: engine.position, pose: position, playing: engine.playing }
      }
    }
    if (lastProgress.current === position && lastFrames.current === frames) return
    const state = interpolateFrame(frames, position)
    if (state.points === lastPoints.current) {
      lastProgress.current = position
      lastFrames.current = frames
      return
    }
    const curve = scratch.curve
    if (curve.points.length !== state.points.length) curve.points = state.points.map(p => new Vector3(...p))
    else for (let i = 0; i < state.points.length; i++) curve.points[i].set(...state.points[i])
    curve.updateArcLengths()
    const points = scratch.centers
    for (let i = 0; i <= RINGS; i++) curve.getPointAt(i / RINGS, points[i])
    const axes = transportedFrames(points, axesRef.current)
    axesRef.current = axes
    const positions = geometry.getAttribute('position') as BufferAttribute
    const normals = geometry.getAttribute('normal') as BufferAttribute
    for (let i = 0; i <= RINGS; i++) {
      for (let j = 0; j <= SIDES; j++) {
        const [cosine, sine] = crossSection[j]
        const nx = cosine * axes.normals[i].x + sine * axes.binormals[i].x
        const ny = cosine * axes.normals[i].y + sine * axes.binormals[i].y
        const nz = cosine * axes.normals[i].z + sine * axes.binormals[i].z
        const index = i * (SIDES + 1) + j
        normals.setXYZ(index, nx, ny, nz)
        positions.setXYZ(index, points[i].x + nx * ROPE_RADIUS, points[i].y + ny * ROPE_RADIUS, points[i].z + nz * ROPE_RADIUS)
      }
    }
    positions.needsUpdate = normals.needsUpdate = true
    if (firstTip.current && lastTip.current) {
      firstTip.current.position.copy(points[0])
      lastTip.current.position.copy(points[RINGS])
      firstTip.current.quaternion.setFromUnitVectors(up, curve.getTangentAt(0).negate())
      lastTip.current.quaternion.setFromUnitVectors(up, curve.getTangentAt(1))
    }
    lastProgress.current = position
    lastFrames.current = frames
    lastPoints.current = state.points
  })

  useFrame(({ camera, size }) => {
    for (const [index, ref] of [firstTip, lastTip].entries()) {
      const label = tipLabels[index].current
      if (!ref.current || !label) continue
      ref.current.localToWorld(labelPosition.set(0, .4, 0)).project(camera)
      label.style.visibility = labelPosition.z >= -1 && labelPosition.z <= 1 ? 'visible' : 'hidden'
      label.style.transform = `translate3d(${(labelPosition.x * .5 + .5) * size.width}px,${(-labelPosition.y * .5 + .5) * size.height}px,0) translate(-50%,-50%)`
    }
  })

  return <group position={[0, -.15, 0]}>
    <mesh geometry={geometry} frustumCulled={false} castShadow receiveShadow>
      <meshPhysicalMaterial vertexColors roughness={.83} metalness={0} bumpMap={bump}
        bumpScale={.009} sheen={.35} sheenRoughness={.8} />
    </mesh>
    {[firstTip, lastTip].map((ref, i) => <group ref={ref} key={i}>
      <mesh position={[0, .06, 0]} castShadow>
        <cylinderGeometry args={[ROPE_RADIUS * .88, ROPE_RADIUS * .96, .25, 20]} />
        <meshStandardMaterial color={labels[i] === 'B' ? '#bdd8df' : '#e4c096'} roughness={.35} metalness={.65} />
      </mesh>
    </group>)}
  </group>
}

function Stage({ frames, progress, cameraKey, detail, showGrid, engine, onPlayback, tipLabels }: {
  frames: Frame[]; progress: number; cameraKey: number; detail: boolean; showGrid: boolean; engine?: KnotAnimationEngine; onPlayback?: PlaybackListener; tipLabels: TipLabels
}) {
  const { camera, size } = useThree()
  const manual = useRef(false)
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null)
  const desired = useRef(new Vector3())
  const target = useMemo(() => new Vector3(), [])
  const knot = frames[0].knot
  const initialCenter = useMemo(() => knot ? new Vector3(
    (Math.min(...frames[0].points.map(p => p[0])) + Math.max(...frames[0].points.map(p => p[0]))) / 2,
    (Math.min(...frames[0].points.map(p => p[1])) + Math.max(...frames[0].points.map(p => p[1]))) / 2, 0) : new Vector3(0, -.3, 0), [frames])
  const firstReinforcement = useMemo(() => frames.findIndex(f => f.reinforcement), [frames])
  const reinforcementFocus = useMemo(() => [...frames].reverse().find(f => f.reinforcement)?.reinforcement?.focus, [frames])
  const floorDepth = useMemo(() => {
    let depth = -1.15
    for (const frame of frames) {
      for (const p of frame.points) depth = Math.min(depth, p[2] - .8)
      if (frame.motion) for (let i = 2; i < frame.motion.positions.length; i += 3) {
        depth = Math.min(depth, frame.motion.positions[i] - .8)
      }
    }
    return depth
  }, [frames])
  const fullDistance = useMemo(() => {
    const points = frames[0].points
    const width = knot ? Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0])) : Math.max(...points.map(p => Math.abs(p[0]))) * 2
    const height = Math.max(...points.map(p => Math.abs(p[1]))) * 2 + 2
    const tangent = Math.tan(42 * Math.PI / 360)
    return Math.max(height / (2 * tangent), width / (2 * tangent * size.width / size.height)) * 1.12
  }, [frames, size.width, size.height])

  useEffect(() => {
    manual.current = false
    camera.position.set(initialCenter.x, initialCenter.y + 1.15, fullDistance)
    camera.lookAt(initialCenter)
    controls.current?.target.copy(initialCenter)
    controls.current?.update()
  }, [camera, frames, fullDistance, cameraKey, detail, initialCenter])

  useFrame((_, delta) => {
    if (manual.current) return
    const position = Math.max(0, Math.min(frames.length - 1, engine?.posePosition ?? progress))
    // Enquadra o laço antes da primeira passagem; a câmera fica estável nas duas.
    const focus = detail ? Math.min(1, Math.max(0, position / (knot ? .9 : 1.6))) : 0
    const tracking = detail && firstReinforcement > 0 ? Math.min(1, Math.max(0, position - firstReinforcement + 1)) : 0
    target.copy(initialCenter)
    if (knot) target.lerp(new Vector3(...knot.focus), focus)
    if (reinforcementFocus) target.lerp(new Vector3(...reinforcementFocus), tracking)
    const at = Math.min(frames.length - 1, Math.floor(position))
    const currentKnot = position === at ? frames[at].knot : knotStateAt(frames[at + 1].knot, position - at)
    const detailDistance = knot ? 6.5 - 1.7 * (currentKnot?.tightness ?? 0) : Math.min(fullDistance * .5, 10)
    const distance = fullDistance * (1 - focus) + detailDistance * focus
    desired.current.set(target.x, target.y + 1.15, target.z + distance)
    const speed = 1 - Math.exp(-delta * 5)
    camera.position.lerp(desired.current, speed)
    controls.current?.target.lerp(target, speed)
    if (camera instanceof PerspectiveCamera) camera.lookAt(controls.current?.target ?? target)
    controls.current?.update()
  })

  return <>
    <color attach="background" args={['#192429']} />
    <ambientLight intensity={.65} />
    <hemisphereLight args={['#e6f1ff', '#7b6550', 1.5]} />
    <directionalLight position={[-3, 5, 7]} intensity={3} color="#fff2db" castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12}
      shadow-camera-top={8} shadow-camera-bottom={-8} shadow-bias={-.0004} shadow-normalBias={.025} />
    <directionalLight position={[4, -1, 3]} intensity={1} color="#bddfff" />
    <Rope frames={frames} progress={progress} engine={engine} onPlayback={onPlayback} tipLabels={tipLabels} />
    <mesh position={[0, 0, floorDepth]}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="#233237" roughness={.94} metalness={0} />
    </mesh>
    <mesh position={[0, 0, floorDepth + .01]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <shadowMaterial transparent opacity={.22} />
    </mesh>
    {showGrid && <Grid position={[0, 0, floorDepth + .02]} rotation={[Math.PI / 2, 0, 0]}
      args={[30, 30]} cellSize={.5} cellThickness={.35} cellColor="#34484d"
      sectionSize={2.5} sectionThickness={.55} sectionColor="#52656a" fadeDistance={20} fadeStrength={2} />}
    <OrbitControls ref={controls} makeDefault target={[0, -.3, 0]} minDistance={3.5} maxDistance={28}
      enableDamping dampingFactor={.09} onStart={() => { manual.current = true }} />
  </>
}

export function RopeScene({ frames, progress, cameraKey, showGrid, detail = true, engine, onPlayback }: {
  frames: Frame[]; progress: number; cameraKey: number; showGrid: boolean; detail?: boolean; engine?: KnotAnimationEngine; onPlayback?: PlaybackListener
}) {
  const firstLabel = useRef<HTMLSpanElement>(null), lastLabel = useRef<HTMLSpanElement>(null)
  const tipLabels = useMemo<TipLabels>(() => [firstLabel, lastLabel], [])
  const labels = frames[0].knot?.labels ?? ['B', 'A']
  return <SceneBoundary><Suspense fallback={<div className="scene-fallback">Preparando a cena…</div>}>
    <div style={{ height: '100%', position: 'relative' }}>
    <Canvas shadows="soft" camera={{ position: [0, .85, 12], fov: 42 }} dpr={[1, 1.75]}
      gl={{ antialias: true }} aria-label="Visualização 3D interativa da corda">
      <Stage frames={frames} progress={progress} cameraKey={cameraKey} detail={detail} showGrid={showGrid} engine={engine} onPlayback={onPlayback} tipLabels={tipLabels} />
    </Canvas>
    <div className="rope-label-overlay" aria-hidden="true">{tipLabels.map((ref, i) => <span ref={ref} key={i}
      className={`rope-tip-label ${labels[i] === 'B' ? 'tip-blue' : 'tip-orange'}`}>{labels[i]}</span>)}</div>
    </div>
  </Suspense></SceneBoundary>
}
