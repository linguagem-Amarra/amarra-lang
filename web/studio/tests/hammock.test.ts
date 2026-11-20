import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFrames, ROPE_RADIUS } from '../src/geometry'
import { validateKnotMotion } from '../src/animation/validateKnotMotion'
import { minimumRopeSeparation } from '../src/animation/RopeValidation'
import { pathLength } from '../src/ropeWinding'
import { sampleMotion } from '../src/ropeMotion'
import { matchesBowline, matchesHammock, registeredKnot } from '../src/knots/knotRegistry'
import { BOWLINE_FINISHED_ROPE_LENGTH, BOWLINE_ROPE_LENGTH } from '../src/knots/hammockBowline'
import { HAMMOCK_FINISHED_ROPE_LENGTH, HAMMOCK_POST, HAMMOCK_ROPE_LENGTH } from '../src/knots/hammockKnot'
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

function bowlinePlan(): Plan {
  const plan = hammockPlan()
  const actions: Plan['passos'][number]['acao'][] = ['passar_em', 'cruzar', 'dar_volta',
    'passar_em', 'meia_volta', 'passar_em', 'apertar', 'finalizar']
  plan.passos = actions.map((acao, id) => ({ ...plan.passos[0], id, acao,
    pontas: id === 0 ? ['punho'] : id === 1 ? ['parte_firme', 'ponta_trabalho']
      : id === 2 ? ['gancho'] : id === 3 || id === 5 ? ['laco']
        : id === 4 ? ['parte_firme'] : [],
    valor: id === 2 ? 1 : null }))
  return plan
}

test('registro da rede exige suporte, duas voltas e duas meias-voltas', () => {
  const plan = hammockPlan()
  assert.ok(matchesHammock(plan))
  assert.equal(registeredKnot(plan)?.id, 'hammock-round-turn')
  plan.passos[1].valor = 1
  assert.equal(matchesHammock(plan), false)
})

test('lais de guia forma uma alça fixa com uma só volta no armador', () => {
  const plan = bowlinePlan()
  assert.ok(matchesBowline(plan))
  assert.equal(registeredKnot(plan)?.id, 'hammock-bowline')
  const bowline = buildFrames(plan), round = buildFrames(hammockPlan())
  assert.equal(bowline.length, 9)
  assert.ok(Math.abs(pathLength(bowline[8].points) - BOWLINE_FINISHED_ROPE_LENGTH) < .005)
  const nearPost = (points: typeof bowline[7]['points']) => points.filter(([x, y]) =>
    Math.hypot(x - HAMMOCK_POST[0], y - HAMMOCK_POST[1]) < 1.2)
  assert.ok(nearPost(bowline[7].points).length < nearPost(round[5].points).length * .8)
  assert.ok(bowline[7].points.some(([x, y]) => x < -.3 && y > .15),
    'o laço pequeno deve ficar visível junto à parte firme')
  assert.ok(Math.abs(pathLength(bowline[7].points) - BOWLINE_ROPE_LENGTH) < .005)
  assert.ok(minimumRopeSeparation(bowline[7].points, ROPE_RADIUS * 3.75) > 2 * ROPE_RADIUS)
  assert.ok(bowline.slice(1).every(frame => frame.motion), 'cada passagem deve ter movimento próprio')
})

test('rede termina ligada ao armador com a ponta livre aparada', () => {
  const frames = buildFrames(hammockPlan())
  assert.equal(frames.length, 7)
  assert.equal(frames[0].scenario?.kind, 'hammock')
  assert.ok(frames[6].motion)
  assert.ok(Math.abs(pathLength(frames[6].points) - HAMMOCK_FINISHED_ROPE_LENGTH) < .005)
  assert.ok(Math.abs(pathLength(sampleMotion(frames[6].motion, 0)) - HAMMOCK_ROPE_LENGTH) < .005)
  assert.ok(Math.abs(pathLength(sampleMotion(frames[6].motion, 1)) - HAMMOCK_FINISHED_ROPE_LENGTH) < .005)
  let previousLength = HAMMOCK_ROPE_LENGTH + .01
  for (const fraction of [0, .25, .5, .75, 1]) {
    const points = sampleMotion(frames[6].motion, fraction)
    const length = pathLength(points)
    assert.ok(length <= previousLength, 'o excesso deve diminuir durante a finalização')
    assert.ok(minimumRopeSeparation(points, ROPE_RADIUS * 3.75) > 2 * ROPE_RADIUS)
    previousLength = length
  }
  assert.ok(Math.hypot(...frames[6].tips[1].map((value, axis) => value - frames[5].points[0][axis])) < 6)
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
  const result = validateKnotMotion(buildFrames(hammockPlan()).slice(0, 6), ROPE_RADIUS, HAMMOCK_ROPE_LENGTH)
  assert.ok(result.poses > 1000)
  assert.ok(result.minimumSeparation > 2 * ROPE_RADIUS)
  assert.ok(result.minimumCurvatureRadius > ROPE_RADIUS)
  assert.ok(result.maximumLengthError < HAMMOCK_ROPE_LENGTH * .005)
})
