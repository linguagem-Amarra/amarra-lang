import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFrames, ROPE_RADIUS } from '../src/geometry'
import { validateKnotMotion } from '../src/animation/validateKnotMotion'
import { matchesHammock, registeredKnot } from '../src/knots/knotRegistry'
import { HAMMOCK_POST, HAMMOCK_ROPE_LENGTH } from '../src/knots/hammockKnot'
import type { Plan } from '../src/types'

function hammockPlan(): Plan {
  const actions: Plan['passos'][number]['acao'][] = ['passar_em', 'dar_volta', 'meia_volta', 'meia_volta', 'apertar', 'finalizar']
  return { ok: true, versao: 1, nome: 'outro nome', selecionado: 0, nos: [], variaveis: {},
    cenario: { tipo: 'rede' }, pontas: ['parte_firme', 'ponta_trabalho'],
    passos: actions.map((acao, id) => ({ id, acao,
      pontas: id === 0 ? ['punho'] : id === 1 ? ['gancho'] : id === 2 || id === 3 ? ['parte_firme'] : [],
      valor: id === 1 ? 2 : null, duracao: 1,
      origem: { linha: id + 1, coluna: 0, fimLinha: id + 1, fimColuna: 20 },
    })) }
}

test('registro da rede exige suporte, duas voltas e duas meias-voltas', () => {
  const plan = hammockPlan()
  assert.ok(matchesHammock(plan))
  assert.equal(registeredKnot(plan)?.id, 'hammock-round-turn')
  plan.passos[1].valor = 1
  assert.equal(matchesHammock(plan), false)
})

test('rede termina ligada ao armador e sem salto ao finalizar', () => {
  const frames = buildFrames(hammockPlan())
  assert.equal(frames.length, 7)
  assert.equal(frames[0].scenario?.kind, 'hammock')
  assert.deepEqual(frames[6].points, frames[5].points)
  const aroundPost = frames[5].points.filter(([x, y]) =>
    Math.hypot(x - HAMMOCK_POST[0], y - HAMMOCK_POST[1]) < .9)
  assert.ok(aroundPost.length > 30)
  assert.ok(aroundPost.every(([x, y]) => Math.hypot(x - HAMMOCK_POST[0], y - HAMMOCK_POST[1]) > .63))
  const loosePost = frames[4].points.filter(([x, y]) =>
    Math.hypot(x - HAMMOCK_POST[0], y - HAMMOCK_POST[1]) < .9)
  const averageRadius = (points: typeof aroundPost) => points.reduce((sum, [x, y]) =>
    sum + Math.hypot(x - HAMMOCK_POST[0], y - HAMMOCK_POST[1]), 0) / points.length
  assert.ok(averageRadius(aroundPost) < averageRadius(loosePost) - .04, 'o aperto deve encostar as voltas ao armador')
  assert.ok(Math.max(...frames[5].points.map(point => point[1])) < 2, 'a ponta livre não deve subir acima da rede')
})

test('animação da rede preserva comprimento, folga e raio de curvatura', () => {
  const result = validateKnotMotion(buildFrames(hammockPlan()), ROPE_RADIUS, HAMMOCK_ROPE_LENGTH)
  assert.ok(result.poses > 1000)
  assert.ok(result.minimumSeparation > 2 * ROPE_RADIUS)
  assert.ok(result.minimumCurvatureRadius > ROPE_RADIUS)
  assert.ok(result.maximumLengthError < HAMMOCK_ROPE_LENGTH * .005)
})
