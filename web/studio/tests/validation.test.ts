import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFrames } from '../src/geometry'
import { validateKnotMotion } from '../src/animation/validateKnotMotion'
import { minimumRopeSeparation, segmentDistance } from '../src/animation/RopeValidation'
import type { Frame, Plan, Point } from '../src/types'

test('validação compara a poda espacial com busca exaustiva entre segmentos', () => {
  const points: Point[] = Array.from({ length: 35 }, (_, i) => [Math.cos(i * .35), i * .025, Math.sin(i * .35)])
  const lengths = [0]
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(...points[i].map((x, axis) => x - points[i - 1][axis])))
  let expected = Infinity
  for (let i = 0; i < points.length - 1; i++) for (let j = i + 2; j < points.length - 1; j++) {
    if (lengths[j] - lengths[i + 1] >= .45) expected = Math.min(expected, segmentDistance(points[i], points[i + 1], points[j], points[j + 1]))
  }
  assert.ok(Math.abs(minimumRopeSeparation(points) - expected) < 1e-10)
})

test('trajetória do nó é inspecionada antes de ser publicada e caches inválidos são rejeitados', () => {
  const plan: Plan = { ok: true, versao: 1, nome: 'validação', selecionado: 0, nos: [], variaveis: {}, pontas: ['a', 'b'],
    passos: ['cruzar', 'passar_baixo', 'passar_baixo', 'apertar', 'finalizar'].map((acao, id) => ({
      id, acao: acao as Plan['passos'][number]['acao'], pontas: id === 0 ? ['a', 'b'] : ['b'], valor: null, duracao: 1,
      origem: { linha: 1, coluna: 0, fimLinha: 1, fimColuna: 1 },
    })) }
  const frames = buildFrames(plan), report = validateKnotMotion(frames, .12, 17)
  assert.ok(report.poses > 640)
  assert.ok(report.minimumSeparation > .245)
  assert.ok(report.minimumCurvatureRadius > .12)
  const position = frames[2].motion!.positions[30]
  frames[2].motion!.positions[30] = NaN
  assert.throws(() => validateKnotMotion(frames, .12, 17), /Linha central inválida|Salto entre etapas/)
  frames[2].motion!.positions[30] = position
  const coordinate = frames[4].points[0][0]
  frames[4].points[0][0] = NaN
  assert.throws(() => validateKnotMotion(frames, .12, 17), /Linha central inválida/)
  frames[4].points[0][0] = coordinate
})

test('autocontato, comprimento incorreto e falta de trajetória bloqueiam a geometria', () => {
  const frame = (points: Point[]): Frame => ({ points, tips: [points[0], points.at(-1)!] })
  assert.throws(() => validateKnotMotion([frame([[-2, -2, 0], [2, 2, 0], [2, -2, 0], [-2, 2, 0]])], .12, 14), /margem|espessura/)
  assert.throws(() => validateKnotMotion([frame([[0, 0, 0], [1, 0, 0]])], .12, 17), /Comprimento/)
  assert.throws(() => validateKnotMotion([frame([[0, 0, 0], [17, 0, 0]]), frame([[0, 0, 0], [Math.sqrt(288), 1, 0]])], .12, 17), /trajetória contínua/)
})
