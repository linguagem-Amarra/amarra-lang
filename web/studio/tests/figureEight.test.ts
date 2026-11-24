import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFrames, ROPE_RADIUS } from '../src/geometry'
import { validateKnotMotion } from '../src/animation/validateKnotMotion'
import { matchesFigureEight, registeredKnot } from '../src/knots/knotRegistry'
import { FIGURE_EIGHT_LENGTH } from '../src/knots/figureEight'
import type { Plan, Point } from '../src/types'

function figureEightPlan(): Plan {
  return { ok: true, versao: 1, nome: 'qualquer nome', selecionado: 0, nos: [], variaveis: {},
    pontas: ['firme', 'trabalho'],
    passos: ['cruzar', 'passar_baixo', 'passar_cima', 'apertar', 'finalizar'].map((acao, id) => ({
      id, acao: acao as Plan['passos'][number]['acao'], pontas: id === 0 ? ['firme', 'trabalho'] : id < 3 ? ['trabalho'] : [],
      valor: null, duracao: 1, origem: { linha: id + 1, coluna: 0, fimLinha: id + 1, fimColuna: 10 },
    })) }
}

type Crossing = { first: number; second: number; over: number; sign: number }
function projectedCrossings(points: Point[]): Crossing[] {
  const result: Crossing[] = []
  for (let i = 0; i < points.length - 1; i++) for (let j = i + 10; j < points.length - 1; j++) {
    const [a, b, c, d] = [points[i], points[i + 1], points[j], points[j + 1]]
    const ux = b[0] - a[0], uy = b[1] - a[1], vx = d[0] - c[0], vy = d[1] - c[1]
    const determinant = ux * vy - uy * vx
    if (Math.abs(determinant) < 1e-9) continue
    const wx = c[0] - a[0], wy = c[1] - a[1]
    const s = (wx * vy - wy * vx) / determinant
    const t = (wx * uy - wy * ux) / determinant
    if (s < 0 || s > 1 || t < 0 || t > 1) continue
    const over = Math.sign(a[2] + s * (b[2] - a[2]) - c[2] - t * (d[2] - c[2]))
    result.push({ first: i + s, second: j + t, over, sign: over * Math.sign(determinant) })
  }
  return result
}

test('registro identifica o nó em oito pela sequência resolvida', () => {
  const plan = figureEightPlan()
  assert.ok(matchesFigureEight(plan))
  assert.equal(registeredKnot(plan)?.id, 'figure-eight')
  plan.passos[2].pontas = ['firme']
  assert.equal(matchesFigureEight(plan), false)
})

test('nó em oito termina com quatro cruzamentos alternados e sem salto ao finalizar', () => {
  const frames = buildFrames(figureEightPlan())
  assert.equal(frames.length, 6)
  assert.equal(frames[0].knot?.id, 'figure-eight')
  assert.deepEqual(frames[5].points, frames[4].points)
  const crossings = projectedCrossings(frames[4].points)
  assert.equal(crossings.length, 4)
  assert.equal(crossings.reduce((sum, crossing) => sum + crossing.sign, 0), 0)
  const encounters = crossings.flatMap(crossing => [
    { at: crossing.first, over: crossing.over }, { at: crossing.second, over: -crossing.over },
  ]).sort((a, b) => a.at - b.at)
  for (let i = 1; i < encounters.length; i++) assert.equal(encounters[i].over, -encounters[i - 1].over)
})

test('a trajetória inteira conserva comprimento, curvatura e folga entre trechos', () => {
  const validation = validateKnotMotion(buildFrames(figureEightPlan()), ROPE_RADIUS, FIGURE_EIGHT_LENGTH)
  assert.ok(validation.poses > 500)
  assert.ok(validation.minimumSeparation > 2 * ROPE_RADIUS)
  assert.ok(validation.minimumCurvatureRadius > ROPE_RADIUS)
  assert.ok(validation.maximumLengthError < FIGURE_EIGHT_LENGTH * .005)
})
