import type { Plan } from '../types'
import { buildDoubleOverhandFrames } from './doubleOverhand'
import { buildFigureEightFrames } from './figureEight'
import { buildHammockFrames } from './hammockKnot'

export function matchesHammock(plan: Plan): boolean {
  const steps = plan.passos[plan.passos.length - 1]?.acao === 'finalizar' ? plan.passos.slice(0, -1) : plan.passos
  return plan.cenario?.tipo === 'rede' && steps.map(step => step.acao).join(',') === 'passar_em,dar_volta,meia_volta,meia_volta,apertar'
    && steps[0].pontas[0] === 'punho' && steps[1].pontas[0] === 'gancho' && steps[1].valor === 2
    && steps[2].pontas[0] === 'parte_firme' && steps[3].pontas[0] === 'parte_firme'
}

export function matchesDoubleOverhand(plan: Plan): boolean {
  const steps = plan.passos[plan.passos.length - 1]?.acao === 'finalizar' ? plan.passos.slice(0, -1) : plan.passos
  if (steps.map(step => step.acao).join(',') !== 'cruzar,passar_baixo,passar_baixo,apertar') return false
  const tip = steps[1].pontas[0]
  return !!tip && steps[1].pontas.length === 1 && steps[2].pontas.length === 1 && steps[2].pontas[0] === tip && steps[0].pontas.includes(tip)
}

export function matchesFigureEight(plan: Plan): boolean {
  const steps = plan.passos[plan.passos.length - 1]?.acao === 'finalizar' ? plan.passos.slice(0, -1) : plan.passos
  if (steps.map(step => step.acao).join(',') !== 'cruzar,passar_baixo,passar_cima,apertar') return false
  const tip = steps[1].pontas[0]
  return !!tip && steps[2].pontas[0] === tip && steps[0].pontas.includes(tip)
}

const definitions = [{ id: 'double-overhand', name: 'Nó simples duplo', matches: matchesDoubleOverhand,
  build: buildDoubleOverhandFrames }, { id: 'figure-eight', name: 'Nó em oito', matches: matchesFigureEight,
  build: buildFigureEightFrames }, { id: 'hammock-round-turn', name: 'Volta redonda e duas meias-voltas',
  matches: matchesHammock, build: buildHammockFrames }]

export function registeredKnot(plan: Plan) {
  return definitions.find(definition => (!plan.animacao || plan.animacao.id === definition.id) && definition.matches(plan))
}
