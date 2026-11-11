import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isDeepStrictEqual } from 'node:util'
import { Vector3 } from 'three'
import { buildFrames, initialFrame, interpolateFrame, SAMPLES, ROPE_LENGTH, ROPE_RADIUS } from '../src/geometry'
import type { Plan, Step } from '../src/types'
import { stepDuration } from '../src/types'
import { transportedFrames } from '../src/ropeSurface'
import { bakeMotion, sampleMotion } from '../src/ropeMotion'

test('reutilizar orientação da malha atualiza os vetores sem conservar dados da pose anterior', () => {
  const points = Array.from({ length: 25 }, (_, i) => new Vector3(Math.cos(i / 8), i / 12, Math.sin(i / 8)))
  const previous = transportedFrames(points), firstNormal = previous.normals[0]
  const moved = points.map(p => p.clone().applyAxisAngle(new Vector3(0, 1, 0), .6))
  const reused = transportedFrames(moved, previous), fresh = transportedFrames(moved)
  assert.equal(reused, previous); assert.equal(reused.normals[0], firstNormal)
  for (let i = 0; i < moved.length; i++) {
    assert.ok(reused.normals[i].distanceTo(fresh.normals[i]) < 1e-12)
    assert.ok(reused.binormals[i].distanceTo(fresh.binormals[i]) < 1e-12)
    assert.ok(Math.abs(reused.normals[i].dot(reused.tangents[i])) < 1e-12)
  }
})

function plan(actions: Step['acao'][]): Plan {
  return { ok: true, versao: 1, nome: 'teste', selecionado: 0, nos: [], variaveis: {}, pontas: ['a', 'b'],
    passos: actions.map((acao, id) => ({ id, acao, pontas: acao === 'cruzar' ? ['a', 'b'] : ['a'],
      valor: acao === 'enrolar' ? 2 : null, duracao: 2.6,
      origem: { linha: id + 1, coluna: 0, fimLinha: id + 1, fimColuna: 10 } })) }
}

test('nó simples transforma uma corda contínua e finalizar preserva a geometria', () => {
  const frames = buildFrames(plan(['cruzar', 'passar_baixo', 'apertar', 'finalizar']))
  assert.equal(frames.length, 5)
  for (const frame of frames) {
    assert.equal(frame.points.length, SAMPLES + 1)
    assert.ok(frame.points.flat().every(Number.isFinite))
    for (let i = 1; i < frame.points.length; i++) {
      assert.ok(Math.hypot(...frame.points[i].map((p, axis) => p - frame.points[i - 1][axis])) < .7)
    }
  }
  for (let i = 1; i < 4; i++) assert.notDeepEqual(frames[i].points, frames[i - 1].points)
  assert.deepEqual(frames[4].points, frames[3].points)
  assert.deepEqual(frames[4].tips, frames[3].tips)
  assert.equal(frames[4].motion, undefined)
  assert.equal(frames[4].via, undefined)
  assert.equal(frames[4].duration, undefined)
})

test('enrolar e passar_cima produzem movimentos próprios', () => {
  const source = plan(['cruzar', 'passar_cima', 'passar_baixo', 'enrolar', 'enrolar', 'apertar'])
  for (const step of source.passos) if (step.acao === 'enrolar') step.valor = 1
  const frames = buildFrames(source)
  for (let i = 1; i < frames.length; i++) assert.notDeepEqual(frames[i].points, frames[i - 1].points)
})

test('buscar na linha do tempo independe da ordem de reprodução', () => {
  const frames = buildFrames(plan(['cruzar', 'passar_baixo', 'apertar']))
  const first = interpolateFrame(frames, 1.37)
  interpolateFrame(frames, 3)
  // Evita gerar um diff enorme dos arrays de movimento quando a comparação falha.
  assert.ok(isDeepStrictEqual(interpolateFrame(frames, 1.37), first), 'buscar novamente deve preservar o frame')
  assert.ok(isDeepStrictEqual(interpolateFrame(frames, -10), frames[0]), 'progresso negativo deve retornar o frame inicial')
  assert.ok(isDeepStrictEqual(interpolateFrame(frames, 99), frames[3]), 'progresso excedente deve retornar o frame final')
  assert.deepEqual(interpolateFrame([initialFrame()], 0), initialFrame())
})

test('a escolha da ponta e a ordem do cruzamento alteram o movimento', () => {
  const a = plan(['cruzar', 'passar_baixo'])
  const b = structuredClone(a)
  b.passos[1].pontas = ['b']
  assert.ok(!isDeepStrictEqual(buildFrames(a)[2], buildFrames(b)[2]), 'trocar a ponta deve alterar a passagem')
  b.passos[0].pontas = ['b', 'a']
  assert.ok(!isDeepStrictEqual(buildFrames(a)[1], buildFrames(b)[1]), 'trocar a ordem deve alterar o cruzamento')
})

test('a passagem tem aproximação por trás, entrada na abertura e saída da ponta', () => {
  const frames = buildFrames(plan(['cruzar', 'passar_baixo', 'apertar']))
  const stages = frames[2].via!
  assert.equal(stages.length, 2)
  const behind = stages[0][SAMPLES]
  const through = stages[1][SAMPLES]
  assert.ok(behind[2] < -.25, 'a ponta deve ficar atrás da volta antes de entrar')
  assert.ok(through[2] > .4, 'a ponta deve atravessar para a frente')
  assert.ok(through[1] < -.5, 'a passagem deve ocorrer dentro da volta')
})

test('comprimento e folga entre trechos são preservados ao longo da animação simples', () => {
  const frames = buildFrames(plan(['cruzar', 'passar_baixo', 'apertar']))
  for (let tick = 0; tick <= 90; tick++) {
    const points = interpolateFrame(frames, tick / 30).points
    let length = 0
    for (let i = 1; i < points.length; i++) length += Math.hypot(...points[i].map((v, axis) => v - points[i - 1][axis]))
    assert.ok(Math.abs(length - ROPE_LENGTH) < ROPE_LENGTH * .015, `comprimento em ${tick / 30}: ${length}`)
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 7; j < points.length; j++) {
        const separation = Math.hypot(...points[i].map((v, axis) => v - points[j][axis]))
        assert.ok(separation >= ROPE_RADIUS * 2, `interpenetração em ${tick / 30}: ${i}/${j}`)
      }
    }
  }
})

test('não há salto de posição nos limites dos comandos e das fases de passagem', () => {
  const frames = buildFrames(plan(['cruzar', 'passar_baixo', 'apertar']))
  for (const boundary of [1, 1 + 1 / 3, 1 + 2 / 3, 2, 3]) {
    const before = interpolateFrame(frames, boundary - 1e-6)
    const at = interpolateFrame(frames, boundary)
    const after = interpolateFrame(frames, Math.min(3, boundary + 1e-6))
    for (const neighbor of [before, after]) {
      assert.ok(at.points.every((p, i) => Math.hypot(...p.map((v, axis) => v - neighbor.points[i][axis])) < 1e-4))
    }
  }
})

function reinforcedPlan(): Plan {
  const result = plan(['cruzar', 'passar_baixo', 'apertar', 'enrolar', 'enrolar', 'apertar', 'finalizar'])
  for (const step of result.passos) if (step.acao === 'enrolar') { step.pontas = ['b']; step.valor = 1 }
  return result
}

test('dois enrolamentos de uma volta preservam a mesma geometria de duas voltas juntas', () => {
  const repeated = reinforcedPlan()
  const batch = structuredClone(repeated)
  batch.passos.splice(4, 1)
  batch.passos[3].valor = 2
  const separateFrames = buildFrames(repeated)
  const batchFrames = buildFrames(batch)
  assert.deepEqual(separateFrames[5].points, batchFrames[4].points)
  assert.deepEqual(separateFrames[6].points, batchFrames[5].points)
  assert.notDeepEqual(separateFrames[4].points, separateFrames[5].points)
})

test('a curva contém uma volta, depois duas, e mantém as duas após apertar', () => {
  const frames = buildFrames(reinforcedPlan())
  // Mede somente as espiras, sem contar a curva livre que antecede a ponta.
  // O intervalo identifica o trecho material; o ângulo vem das posições 3D.
  for (const [index, expected] of [[4, 1], [5, 2], [6, 2]]) {
    const current = frames[index]
    const coil = current.reinforcement!.coil!
    const ordered = current.reinforcement!.tip === 'A' ? current.points : [...current.points].reverse()
    const origin = new Vector3(...coil.center), axis = new Vector3(...coil.axis)
    const normal = new Vector3(0, 0, 1).cross(axis).normalize()
    const binormal = axis.clone().cross(normal).normalize()
    let previous: number | null = null, angle = 0
    for (let i = Math.ceil(coil.start * SAMPLES); i <= Math.floor(coil.end * SAMPLES); i++) {
      const offset = new Vector3(...ordered[i]).sub(origin)
      const current = Math.atan2(offset.dot(binormal), offset.dot(normal))
      if (previous !== null) angle += Math.atan2(Math.sin(current - previous), Math.cos(current - previous))
      previous = current
    }
    assert.ok(Math.abs(Math.abs(angle / (2 * Math.PI)) - expected) < .12, `voltas no estado ${index}`)
  }
})

test('reforço conserva comprimento, separação e continuidade durante voltas e aperto', () => {
  const frames = buildFrames(reinforcedPlan())
  for (let tick = 0; tick <= 90; tick++) {
    const points = interpolateFrame(frames, 3 + tick / 30).points
    let length = 0
    for (let i = 1; i < points.length; i++) length += Math.hypot(...points[i].map((v, axis) => v - points[i - 1][axis]))
    assert.ok(Math.abs(length - ROPE_LENGTH) < ROPE_LENGTH * .015)
    for (let i = 0; i < points.length; i++) for (let j = i + 7; j < points.length; j++) {
      assert.ok(Math.hypot(...points[i].map((v, axis) => v - points[j][axis])) >= ROPE_RADIUS * 2)
    }
  }
  for (const boundary of [3, 3.2, 3.4, 3.6, 3.8, 4, 4.25, 4.5, 4.75, 5, 5 + 1 / 3, 5 + 2 / 3, 6]) {
    const at = interpolateFrame(frames, boundary).points
    for (const t of [boundary - 1e-6, boundary + 1e-6]) {
      const near = interpolateFrame(frames, t).points
      assert.ok(at.every((p, i) => Math.hypot(...p.map((v, axis) => v - near[i][axis])) < 1e-4))
    }
  }
})

test('reprodução a 60 fps não contém disparos ou trancos nas voltas e no aperto', () => {
  const source = reinforcedPlan()
  const frames = buildFrames(source)
  for (let step = 3; step <= 6; step++) {
    const count = Math.ceil(stepDuration(source.passos[step], frames[step + 1]) * 60)
    let previous = interpolateFrame(frames, step).points
    let lastVelocity: number[][] | null = null
    for (let tick = 1; tick <= count; tick++) {
      const current = interpolateFrame(frames, step + tick / count).points
      const velocities = current.map((p, i) => p.map((v, axis) => v - previous[i][axis]))
      assert.ok(velocities.every(v => Math.hypot(...v) < .07), `salto no movimento ${step}, quadro ${tick}`)
      if (lastVelocity) {
        const before: number[][] = lastVelocity
        assert.ok(velocities.every((v, i) => Math.hypot(...v.map((n, axis) => n - before[i][axis])) < .025),
          `tranco no movimento ${step}, quadro ${tick}`)
      }
      lastVelocity = velocities
      previous = current
    }
  }
})

test('finalizar mantém o nó imóvel e não herda o movimento de apertar', () => {
  const frames = buildFrames(reinforcedPlan())
  assert.ok(frames[6].motion)
  assert.equal(frames[7].motion, undefined)
  assert.equal(frames[7].via, undefined)
  assert.equal(frames[7].duration, undefined)
  for (let tick = 0; tick <= 60; tick++) {
    assert.deepEqual(interpolateFrame(frames, 6 + tick / 60).points, frames[6].points)
  }
})

test('reforço usa a cauda livre sem recolher o ramo de apoio nem deslocar o nó de base', () => {
  const frames = buildFrames(reinforcedPlan())
  const support = frames[3].tips[0]
  for (let tick = 0; tick <= 80; tick++) {
    const current = interpolateFrame(frames, 3 + tick / 40)
    assert.ok(Math.hypot(...current.tips[0].map((v, axis) => v - support[axis])) < 1e-5,
      `o apoio recuou em ${3 + tick / 40}`)
  }
  for (let i = SAMPLES / 2; i <= SAMPLES; i++) {
    assert.ok(Math.hypot(...frames[4].points[i].map((v, axis) => v - frames[5].points[i][axis])) < .005,
      `a segunda volta deslocou o nó de base no ponto ${i}`)
  }
  const [a, b] = frames[6].tips
  assert.ok(Math.hypot(...a.map((v, axis) => v - b[axis])) > 3,
    'as pontas precisam continuar distintas e visíveis após apertar')
})

test('a seção da malha não gira ao mudar o eixo dominante do tangente', () => {
  const points = (epsilon: number) => Array.from({ length: 40 }, (_, i) =>
    new Vector3(i * (.44 + epsilon), i * (.44 - epsilon), i * .78))
  const before = transportedFrames(points(-1e-6))
  const after = transportedFrames(points(1e-6))
  for (let i = 0; i < 40; i++) {
    assert.ok(before.normals[i].dot(after.normals[i]) > .999999)
    assert.ok(Math.abs(after.normals[i].dot(after.tangents[i])) < 1e-6)
    assert.ok(Math.abs(after.binormals[i].dot(after.tangents[i])) < 1e-6)
  }
})

function windsorPlan(): Plan {
  return plan(['cruzar', 'passar_cima', 'passar_baixo', 'enrolar', 'apertar', 'finalizar'])
}

test('Windsor conserva comprimento e separação durante o enrolamento e o aperto', () => {
  const frames = buildFrames(windsorPlan())
  for (let tick = 0; tick <= 90; tick++) {
    const progress = 3 + tick / 30
    const points = interpolateFrame(frames, progress).points
    const length = points.slice(1).reduce((sum, p, i) => sum + Math.hypot(...p.map((v, axis) => v - points[i][axis])), 0)
    assert.ok(Math.abs(length - ROPE_LENGTH) < ROPE_LENGTH * .015, `comprimento em ${progress}: ${length}`)
    for (let i = 0; i < points.length; i++) for (let j = i + 7; j < points.length; j++) {
      const separation = Math.hypot(...points[i].map((v, axis) => v - points[j][axis]))
      assert.ok(separation >= ROPE_RADIUS * 2, `interpenetração em ${progress}: ${i}/${j}`)
    }
  }
  for (const fraction of [0, .1, .5, .9, 1]) {
    assert.deepEqual(interpolateFrame(frames, 5 + fraction).points, frames[5].points)
  }
})

test('o aperto dos três exemplos desacelera sem tranco até a pose final', () => {
  const sources = [plan(['cruzar', 'passar_baixo', 'apertar', 'finalizar']), reinforcedPlan(), windsorPlan()]
  for (const source of sources) {
    const frames = buildFrames(source)
    const step = source.passos.map(s => s.acao).lastIndexOf('apertar')
    const count = Math.ceil(stepDuration(source.passos[step], frames[step + 1]) * 60)
    let previous = interpolateFrame(frames, step).points
    let lastVelocity = previous.map(() => [0, 0, 0])
    for (let tick = 1; tick <= count; tick++) {
      const current = interpolateFrame(frames, step + tick / count).points
      const velocities = current.map((p, i) => p.map((v, axis) => v - previous[i][axis]))
      const speed = Math.max(...velocities.map(v => Math.hypot(...v)))
      const acceleration = Math.max(...velocities.map((v, i) => Math.hypot(...v.map((n, axis) => n - lastVelocity[i][axis]))))
      assert.ok(speed < .06, `salto no aperto de ${source.passos.length} movimentos, quadro ${tick}: ${speed}`)
      assert.ok(acceleration < .015, `tranco no aperto, quadro ${tick}: ${acceleration}`)
      if (tick === count) assert.ok(speed < .001, `o aperto deve terminar em repouso: ${speed}`)
      previous = current
      lastVelocity = velocities
    }
  }
})

test('acomodar a base do Windsor independe de agrupar ou separar as voltas', () => {
  const batch = windsorPlan()
  const repeated = structuredClone(batch)
  repeated.passos[3].valor = 1
  repeated.passos.splice(4, 0, { ...repeated.passos[3], id: 99 })
  const a = buildFrames(batch), b = buildFrames(repeated)
  assert.deepEqual(a[4].points, b[5].points)
  assert.deepEqual(a[5].points, b[6].points)
})

test('a trajetória reparada começa e termina em repouso nas poses exatas', () => {
  const pose = (x: number) => ({ points: [[x, 0, 0] as [number, number, number]], tips: [[x, 0, 0], [x, 0, 0]] as [[number, number, number], [number, number, number]] })
  const start = pose(0), end = pose(1)
  const track = bakeMotion(start, end, t => pose(t).points, 32, points => points.map(([x, y, z]) => [x, y + .4, z]))
  assert.deepEqual(sampleMotion(track, 0), start.points)
  assert.deepEqual(sampleMotion(track, 1), end.points)
  for (const edge of [0, 1]) {
    const near = sampleMotion(track, edge === 0 ? 1e-5 : 1 - 1e-5)[0]
    assert.ok(Math.hypot(near[0] - edge, near[1], near[2]) < 1e-7)
  }
})

test('enrolamento que excede o comprimento disponível gera diagnóstico', () => {
  const source = windsorPlan()
  source.passos[3].valor = 12
  assert.throws(() => buildFrames(source), /Não há corda suficiente/)
})

test('três voltas após cruzar podem ser compiladas e apertadas', () => {
  const source = plan(['cruzar', 'enrolar', 'enrolar', 'enrolar', 'apertar', 'finalizar'])
  for (const step of source.passos) if (step.acao === 'enrolar') step.valor = 1
  const frames = buildFrames(source)
  assert.equal(frames[4].reinforcement?.turns, 3)
  assert.equal(frames[5].reinforcement?.turns, 3)
  assert.ok(frames[5].points.flat().every(Number.isFinite))
  const length = frames[5].points.slice(1).reduce((sum, p, i) => sum + Math.hypot(...p.map((v, axis) => v - frames[5].points[i][axis])), 0)
  assert.ok(Math.abs(length - ROPE_LENGTH) < ROPE_LENGTH * .015)
})
