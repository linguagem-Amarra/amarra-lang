import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildFrames } from '../src/geometry'
import { KnotAnimationEngine } from '../src/animation/KnotAnimationEngine'
import { TheatreKnotController } from '../src/animation/TheatreKnotController'
import { readTimeline, timelineState } from '../src/knots/doubleOverhandTimeline'
import type { Plan } from '../src/types'

const plan: Plan = { ok: true, versao: 1, nome: 'teste', selecionado: 0, nos: [], variaveis: {}, pontas: ['a', 'b'],
  passos: ['cruzar', 'passar_baixo', 'passar_baixo', 'apertar', 'finalizar'].map((acao, id) => ({
    id, acao: acao as Plan['passos'][number]['acao'], pontas: id === 0 ? ['a', 'b'] : ['b'], valor: null, duracao: 1,
    origem: { linha: id + 1, coluna: 0, fimLinha: id + 1, fimColuna: 1 },
  })) }
const frames = buildFrames(plan)
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`)

test('o motor do nó usa o relógio e os parâmetros reais do Theatre', async () => {
  const engine = new KnotAnimationEngine(); engine.configure(plan.passos, frames); await engine.ready
  try {
    assert.equal(engine.usesTheatre, true)
    engine.play(); engine.advance(7); close(engine.position, 1)
    engine.advance(4); close(engine.position, 1.5); close(engine.posePosition, 1.5)
    assert.equal(engine.currentFrame()!.knot!.passes, 1)
    engine.advance(12); close(engine.position, 3)
    engine.advance(2.7); close(engine.position, 3.3)
    engine.advance(7.3); close(engine.position, 5); assert.equal(engine.playing, false)
    engine.play(); close(engine.position, 0); assert.equal(engine.playing, true)
  } finally { engine.dispose() }
})

test('pausa, busca, velocidade e parada entre etapas preservam o playhead Theatre', async () => {
  const engine = new KnotAnimationEngine(); engine.configure(plan.passos, frames); await engine.ready
  try {
    engine.setSpeed(.25); engine.play(); engine.advance(7); close(engine.position, .25)
    engine.pause(); engine.advance(10); close(engine.position, .25)
    engine.setSpeed(2); engine.play(); engine.advance(1.75); close(engine.position, .75)
    engine.next(); close(engine.position, 1); engine.previous(); close(engine.position, 0)
    engine.autoAdvance = false; engine.play(); engine.advance(40); close(engine.position, 1); assert.equal(engine.playing, false)
    engine.play(); engine.advance(40); close(engine.position, 2)
    engine.restart(); close(engine.position, 0)
    engine.seek(2.43); const pose = engine.currentFrame()!.points
    engine.seek(4); engine.seek(2.43); assert.deepEqual(engine.currentFrame()!.points, pose)
  } finally { engine.dispose() }
})

test('playheads de dois visualizadores são independentes e descarte interrompe reprodução', async () => {
  const a = new TheatreKnotController(), b = new TheatreKnotController(); await Promise.all([a.ready, b.ready])
  try {
    a.play(33, 1); a.advance(3.5)
    close(a.seconds, 3.5); close(b.seconds, 0)
    close(a.posePosition(.1), .5) // valor sequenciado, e não a fração recebida
    a.dispose(); a.advance(10); close(a.seconds, 3.5); assert.equal(a.playing, false)
  } finally { a.dispose(); b.dispose() }
})

test('trocar velocidade e continuação durante a reprodução não reinicia o tempo', async () => {
  const engine = new KnotAnimationEngine(); engine.configure(plan.passos, frames); await engine.ready
  try {
    engine.play(); engine.advance(1); close(engine.elapsedSeconds, 1)
    engine.setSpeed(2); engine.advance(1); close(engine.elapsedSeconds, 3)
    engine.autoAdvance = false; engine.advance(10); close(engine.position, 1); assert.equal(engine.playing, false)
    engine.autoAdvance = true; engine.play(); engine.advance(2); close(engine.position, 1.5)
  } finally { engine.dispose() }
})

test('busca e pausa solicitadas antes de carregar o projeto não iniciam reprodução atrasada', async () => {
  const controller = new TheatreKnotController()
  controller.seek(12); controller.play(33, 1); controller.pause()
  await controller.ready
  try { close(controller.seconds, 12); controller.advance(5); close(controller.seconds, 12); assert.equal(controller.playing, false) }
  finally { controller.dispose() }
})

test('o relógio Theatre conserva o tempo com quadros de durações diferentes', async () => {
  const a = new TheatreKnotController(), b = new TheatreKnotController(); await Promise.all([a.ready, b.ready])
  try {
    a.play(33, 1); b.play(33, 1)
    a.advance(8)
    for (let i = 0; i < 480; i++) b.advance(8 / 480)
    close(a.seconds, b.seconds); close(a.values.firstPass, b.values.firstPass)
  } finally { a.dispose(); b.dispose() }
})

test('estado Theatre rejeita saltos, etapas sobrepostas e valores que ultrapassam a construção', () => {
  assert.deepEqual(readTimeline().durations, [7, 8, 8, 9, 1])
  for (const change of [
    (s: typeof timelineState) => { s.definitionVersion = '0.3.0' },
    (s: typeof timelineState) => { s.sheetsById.Knot.sequence.tracksByObject.Construction.trackData.loop.keyframes[1].value = 2 },
    (s: typeof timelineState) => { s.sheetsById.Knot.sequence.tracksByObject.Construction.trackData.loop.keyframes[0].connectedRight = false },
    (s: typeof timelineState) => { s.sheetsById.Knot.sequence.tracksByObject.Construction.trackData.secondPass.keyframes[0].position = 14 },
    (s: typeof timelineState) => { s.sheetsById.Knot.sequence.length = 32 },
    (s: typeof timelineState) => { Object.assign(s.sheetsById.Knot.sequence.tracksByObject.Construction.trackData.loop.keyframes[0], { type: 'hold' }) },
  ]) { const state = structuredClone(timelineState); change(state); assert.throws(() => readTimeline(state)) }
  const source = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
  assert.ok(source.includes('import.meta.env.DEV'))
})
