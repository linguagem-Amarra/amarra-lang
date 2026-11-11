import { test } from 'node:test'
import assert from 'node:assert/strict'
import { KnotAnimationEngine } from '../src/animation/KnotAnimationEngine'
import type { Frame, Step } from '../src/types'

function engine() {
  const clock = new KnotAnimationEngine()
  const steps = [2, 4, 1].map((duracao, id) => ({ id, duracao, acao: 'apertar' })) as Step[]
  const frames = [0, 1, 2, 3].map(x => ({ points: [[x, 0, 0], [x + 1, 0, 0]], tips: [[x, 0, 0], [x + 1, 0, 0]] })) as Frame[]
  clock.configure(steps, frames)
  return clock
}
test('motor consome tempo real entre etapas de durações diferentes', () => {
  const clock = engine(); clock.play(); clock.advance(4)
  assert.equal(clock.position, 1.5); assert.equal(clock.elapsedSeconds, 4); assert.equal(clock.totalSeconds, 7)
  clock.advance(3); assert.equal(clock.position, 3); assert.equal(clock.playing, false)
  clock.play(); assert.equal(clock.position, 0); assert.equal(clock.playing, true)
})
test('pausa, reinício e navegação controlam a mesma posição da geometria', () => {
  const clock = engine(); clock.play(); clock.advance(1); clock.pause(); clock.advance(5)
  assert.equal(clock.position, .5)
  clock.next(); assert.equal(clock.position, 1)
  clock.previous(); assert.equal(clock.position, 0)
  clock.seek(2); assert.equal(clock.currentFrame()!.points[0][0], 2)
  clock.restart(); assert.equal(clock.position, 0); assert.equal(clock.playing, false)
})
test('velocidades de 0,25× e 2× alteram o avanço e rejeitam valores inválidos', () => {
  const clock = engine(); clock.setSpeed(.25); clock.play(); clock.advance(2); assert.equal(clock.position, .25)
  clock.restart(); clock.setSpeed(2); clock.play(); clock.advance(2); assert.equal(clock.position, 1.5)
  for (const speed of [0, 3, NaN]) assert.throws(() => clock.setSpeed(speed), RangeError)
})
test('sem continuação automática, para precisamente no limite e retoma a próxima etapa', () => {
  const clock = engine(); clock.autoAdvance = false; clock.play(); clock.advance(20)
  assert.equal(clock.position, 1); assert.equal(clock.playing, false)
  clock.play(); clock.advance(20); assert.equal(clock.position, 2)
  clock.seek(-3); assert.equal(clock.position, 0)
  clock.seek(99); assert.equal(clock.position, 3)
  clock.seek(NaN); assert.equal(clock.position, 0)
})
