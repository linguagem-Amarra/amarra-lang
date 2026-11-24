import { buildFrames, ROPE_RADIUS } from './geometry'
import { validateKnotMotion, type MotionValidation } from './animation/validateKnotMotion'
import type { Frame, Plan } from './types'

const runner = self as unknown as {
  onmessage: ((event: MessageEvent<Plan>) => void) | null
  postMessage: (message: { frames?: Frame[]; error?: string; validation?: MotionValidation }, transfer?: Transferable[]) => void
}

runner.onmessage = event => {
  try {
    const frames = buildFrames(event.data)
    const validation = frames[0].knot ? validateKnotMotion(frames, ROPE_RADIUS, frames[0].knot.length) : undefined
    const buffers = new Set<ArrayBuffer>()
    for (const frame of frames) if (frame.motion) buffers.add(frame.motion.positions.buffer as ArrayBuffer)
    runner.postMessage({ frames, validation }, [...buffers])
  } catch (error) {
    runner.postMessage({ error: error instanceof Error ? error.message : 'Não foi possível calcular a trajetória.' })
  }
}
