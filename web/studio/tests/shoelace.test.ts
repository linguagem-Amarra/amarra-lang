import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildShoelaceFrames, eyelets } from '../src/knots/shoelaceBow'
import { interpolateFrame } from '../src/geometry'
import { pathLength } from '../src/ropeWinding'
import type { Plan, Point } from '../src/types'

const plan: Plan = { ok: true, versao: 1, nome: '', selecionado: 0, nos: [], variaveis: {}, pontas: ['a', 'b'],
  passos: [{ id: 0, acao: 'finalizar', pontas: [], duracao: 1, valor: '', origem: { linha: 1, fimLinha: 1, coluna: 0, fimColuna: 1 } }] }
const frames = buildShoelaceFrames(plan)
const rest = frames[0].points
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const [left, right] = eyelets[0].map(eye => rest.findIndex(p => distance(p, eye) < 1e-6))

test('os ilhoses seguram o trançado e cada ponta conserva seu comprimento durante a amarração', () => {
  assert.ok(left > 0 && right > left)
  const lengths = (p: Point[]) => [pathLength(p.slice(0, left + 1)), pathLength(p.slice(right))]
  const reference = lengths(rest)
  for (let tick = 0; tick <= 8 * 120; tick++) {
    const p = interpolateFrame(frames, tick / 120).points
    for (let j = left; j <= right; j++) assert.ok(distance(p[j], rest[j]) < 1e-5)
    lengths(p).forEach((n, side) => assert.ok(Math.abs(n / reference[side] - 1) < .02))
  }
  assert.equal(frames.at(-1)!.points, frames.at(-2)!.points)
})

test('A entra sob B pela ponteira; B passa dobrada enquanto a alça A fica parada', () => {
  let agletUnder = false
  const support = frames[6].points.slice(right)
  for (let tick = 0; tick <= 96; tick++) {
    const p = interpolateFrame(frames, 1 + tick / 96).points
    const tip = p.at(-1)!
    if (Math.abs(tip[2]) < .10 && Math.abs(tip[0] + 1.14) < .16 && tip[1] < 1.51) agletUnder = true
    for (let j = 0; j <= left; j++) assert.ok(distance(p[j], frames[1].points[j]) < 1e-5)
    const bow = interpolateFrame(frames, 6 + tick / 96).points
    for (let j = 0; j < support.length; j++) assert.ok(distance(bow[right + j], support[j]) < 1e-5)
  }
  assert.ok(agletUnder)
  const extent = (p: Point[]) => Math.max(...p.map(v => v[2])) - Math.min(...p.map(v => v[2]))
  assert.ok(extent(frames[8].points.slice(0, left)) > extent(frames[7].points.slice(0, left)))
})
