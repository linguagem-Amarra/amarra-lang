import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CatmullRomCurve3, Vector3 } from 'three'
import { buildFrames, interpolateFrame, ROPE_RADIUS } from '../src/geometry'
import { matchesDoubleOverhand, registeredKnot } from '../src/knots/knotRegistry'
import { doubleOverhandGuides, DOUBLE_OVERHAND_LENGTH, DOUBLE_OVERHAND_SAMPLES } from '../src/knots/doubleOverhand'
import { minimumRopeSeparation, segmentDistance } from '../src/animation/RopeValidation'
import { pathLength } from '../src/ropeWinding'
import type { Plan, Point } from '../src/types'

export function doublePlan(): Plan {
  return { ok: true, versao: 1, nome: 'qualquer nome', selecionado: 0, nos: [], variaveis: {}, pontas: ['firme', 'trabalho'],
    passos: ['cruzar', 'passar_baixo', 'passar_baixo', 'apertar', 'finalizar'].map((acao, id) => ({
      id, acao: acao as Plan['passos'][number]['acao'], pontas: id === 0 ? ['firme', 'trabalho'] : id < 3 ? ['trabalho'] : [],
      valor: null, duracao: 1, origem: { linha: id + 1, coluna: 0, fimLinha: id + 1, fimColuna: 10 } })) }
}
const frames = buildFrames(doublePlan())
const distance = (a: number[], b: number[]) => Math.hypot(...a.map((x, i) => x - b[i]))

test('registro reconhece ações e ponta, independentemente do nome', () => {
  assert.equal(registeredKnot(doublePlan())?.id, 'double-overhand')
  const renamed = doublePlan(); renamed.nome = 'Windsor'; assert.ok(matchesDoubleOverhand(renamed))
  const noFinish = doublePlan(); noFinish.passos.pop(); assert.ok(matchesDoubleOverhand(noFinish))
  for (const mutate of [
    (p: Plan) => { p.passos[2].pontas = ['firme'] },
    (p: Plan) => { p.passos[2].acao = 'passar_cima' },
    (p: Plan) => { p.passos.splice(2, 0, { ...p.passos[3] }) },
    (p: Plan) => { p.passos.splice(2, 1) },
  ]) { const plan = doublePlan(); mutate(plan); assert.equal(matchesDoubleOverhand(plan), false) }
})

test('uma única corda inicia estendida e permanece contínua, com comprimento constante', () => {
  assert.equal(frames.length, 6)
  const initial = frames[0].points
  assert.ok(initial[0][0] < initial.at(-1)![0])
  assert.ok(Math.max(...initial.map(p => p[1])) - Math.min(...initial.map(p => p[1])) < .1)
  for (let i = 0; i <= 200; i++) {
    const points = interpolateFrame(frames, i / 40).points
    assert.equal(points.length, DOUBLE_OVERHAND_SAMPLES + 1)
    assert.ok(points.flat().every(Number.isFinite))
    assert.ok(Math.abs(pathLength(points) - DOUBLE_OVERHAND_LENGTH) < .02)
    for (let j = 1; j < points.length; j++) assert.ok(distance(points[j], points[j - 1]) < .05)
  }
})

test('a ponta atravessa o interior do mesmo laço duas vezes antes de qualquer aperto', () => {
  for (const [middle, passes] of [[1.44, 1], [2.44, 2]]) {
    const before = interpolateFrame(frames, middle - .05), at = interpolateFrame(frames, middle), after = interpolateFrame(frames, middle + .05)
    assert.ok(before.points.at(-1)![2] > .5)
    assert.ok(after.points.at(-1)![2] < -.5)
    const tip = at.points.at(-1)!
    // Interior livre do laço: longe do ramo direito e das curvas superior/inferior.
    assert.ok(tip[0] > -.8 && tip[0] < .5 && tip[1] > -1 && tip[1] < .4)
    assert.ok(Math.abs(tip[2]) < 1e-5)
    assert.equal(before.knot!.passes, passes - 1)
    assert.equal(after.knot!.passes, passes)
    assert.equal(after.knot!.tightness, 0)
  }
  assert.equal(interpolateFrame(frames, 3.29).knot!.tightness, 0)
  assert.ok(interpolateFrame(frames, 3.6).knot!.tightness! > 0)
  assert.equal(frames[4].knot!.tightness, 1)
})

test('segmentos não vizinhos mantêm espaço para o diâmetro durante toda a trajetória', () => {
  for (let i = 0; i <= 240; i++) {
    const progress = i / 60
    const minimum = minimumRopeSeparation(interpolateFrame(frames, progress).points)
    assert.ok(minimum > 2 * ROPE_RADIUS, `contato indevido em ${progress}: ${minimum}`)
  }
})

test('a curva renderizada preserva a separação e não dobra o tubo sobre sua própria espessura', () => {
  for (let i = 0; i <= 240; i++) {
    const progress = i / 60
    const curve = new CatmullRomCurve3(interpolateFrame(frames, progress).points.map(p => new Vector3(...p)), false, 'centripetal')
    curve.arcLengthDivisions = 800
    const points = curve.getSpacedPoints(480)
    assert.ok(minimumRopeSeparation(points.map(p => p.toArray() as Point)) > 2 * ROPE_RADIUS, `contato na malha em ${progress}`)
    for (let j = 1; j < points.length - 1; j++) {
      const a = points[j].clone().sub(points[j - 1]), b = points[j + 1].clone().sub(points[j])
      const chord = points[j + 1].clone().sub(points[j - 1]), cross = a.clone().cross(b).length()
      if (cross < 1e-10) continue
      const radius = a.length() * b.length() * chord.length() / (2 * cross)
      assert.ok(radius > ROPE_RADIUS, `dobra mais fechada que a espessura em ${progress}: ${radius}`)
    }
  }
})

test('limites das etapas não saltam e busca reversa não modifica a pose', () => {
  for (const boundary of [1, 2, 3, 3.3, 4]) {
    const before = interpolateFrame(frames, boundary - .0001).points
    const after = interpolateFrame(frames, boundary + .0001).points
    for (let i = 0; i < before.length; i++) assert.ok(distance(before[i], after[i]) < .001)
  }
  const sought = interpolateFrame(frames, 2.43).points
  interpolateFrame(frames, 5); interpolateFrame(frames, .1)
  assert.deepEqual(interpolateFrame(frames, 2.43).points, sought)
  assert.deepEqual(frames[5].points, frames[4].points)
  assert.deepEqual(interpolateFrame(frames, 4.8).points, frames[4].points)
})

test('o laço diminui progressivamente no aperto, preservando as duas passagens', () => {
  let previous = Infinity, loose = 0
  for (let i = 0; i <= 28; i++) {
    const frame = interpolateFrame(frames, 3.3 + .7 * i / 28)
    const loop = doubleOverhandGuides(2, 1, frame.knot!.tightness).loop
    // Diâmetro espacial, independente da rotação que alinha o barril.
    let diameter = 0
    for (let a = 0; a < loop.length; a++) for (let b = a + 1; b < loop.length; b++) diameter = Math.max(diameter, distance(loop[a], loop[b]))
    if (i === 0) loose = diameter
    assert.ok(diameter <= previous + .002, `o laço cresceu durante o aperto: ${diameter}/${previous}`)
    assert.equal(frame.knot!.passes, 2)
    previous = diameter
  }
  assert.ok(previous < loose * .75)
})

test('aperto preserva os cinco cruzamentos orientados do nó simples duplo', () => {
  // Vista oblíqua evita a projeção degenerada dos dois ramos alinhados do barril.
  const points = frames[4].points.map(([x, y, z]) => [x, (y - z) / Math.SQRT2, (y + z) / Math.SQRT2]), signs: number[] = []
  for (let i = 0; i < points.length - 1; i++) for (let j = i + 12; j < points.length - 1; j++) {
    const a = points[i], b = points[i + 1], c = points[j], d = points[j + 1]
    const ux = b[0] - a[0], uy = b[1] - a[1], vx = d[0] - c[0], vy = d[1] - c[1]
    const wx = c[0] - a[0], wy = c[1] - a[1], determinant = ux * vy - uy * vx
    if (Math.abs(determinant) < 1e-12) continue
    const s = (wx * vy - wy * vx) / determinant, t = (wx * uy - wy * ux) / determinant
    if (s <= 0 || s >= 1 || t <= 0 || t >= 1) continue
    const depth = a[2] + s * (b[2] - a[2]) - c[2] - t * (d[2] - c[2])
    assert.ok(Math.abs(depth) > 2 * ROPE_RADIUS)
    signs.push(Math.sign(determinant * depth))
  }
  assert.equal(signs.length, 5)
  assert.equal(new Set(signs).size, 1)
  // Corpo compacto e ponta curta, sem transformar a corda inteira no miolo.
  const body = frames[4].points.filter(p => p[0] > -.1 && p[0] < 1.3)
  assert.ok(Math.max(...body.map(p => p[1])) - Math.min(...body.map(p => p[1])) < 1.2)
  assert.ok(frames[4].points.at(-1)![0] > 1.5)
})

test('as duas espiras terminam em um barril com as extremidades alinhadas', () => {
  const points = frames[4].points, start = points[0], end = points.at(-1)!
  assert.ok(start[0] < 0 && end[0] > 2)
  assert.ok(Math.abs(start[1] - end[1]) < 1e-6)
  assert.ok(Math.abs(start[2] - end[2]) < 1e-6)
  const coils = doubleOverhandGuides(2, 1, 1).coils
  let angle = 0
  for (let i = 1; i < coils.length; i++) {
    const a = Math.atan2(-coils[i - 1][2], coils[i - 1][1] + .2)
    const b = Math.atan2(-coils[i][2], coils[i][1] + .2)
    angle += Math.atan2(Math.sin(b - a), Math.cos(b - a))
  }
  assert.ok(Math.abs(angle - 4 * Math.PI) < 1e-6)
})

test('cada passagem faz uma pausa observável antes do próximo comando', () => {
  for (const step of [1, 2]) {
    const settled = interpolateFrame(frames, step + .91).points
    assert.deepEqual(interpolateFrame(frames, step + .98).points, settled)
    assert.equal(interpolateFrame(frames, step + .91).knot!.passes, step)
  }
})

test('trocar a ponta de trabalho mantém identificação A/B sincronizada', () => {
  const plan = doublePlan(); plan.passos[1].pontas = ['firme']; plan.passos[2].pontas = ['firme']
  const other = buildFrames(plan)
  assert.deepEqual(other[0].knot!.labels, ['B', 'A'])
  assert.deepEqual(other[2].tips[0], other[2].points.at(-1))
  for (let i = 0; i < other[2].points.length; i++) {
    assert.equal(other[2].points[i][0], frames[2].points[i][0])
    assert.equal(other[2].points[i][2], -frames[2].points[i][2])
  }
})

test('distância entre segmentos considera interiores, paralelos e pontos degenerados', () => {
  assert.equal(segmentDistance([-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0]), 0)
  assert.equal(segmentDistance([0, 0, 0], [2, 0, 0], [1, 0, 3], [3, 0, 3]), 3)
  assert.equal(segmentDistance([0, 0, 0], [0, 0, 0], [1, -1, 0], [1, 1, 0]), 1)
  assert.equal(segmentDistance([0, 0, 0], [1, 0, 0], [2, 2, 0], [2, 2, 0]), Math.sqrt(5))
})
