import type { Plan } from '../types'
import { buildDoubleOverhandFrames } from './doubleOverhand'

export function matchesDoubleOverhand(plan: Plan): boolean {
  const steps = plan.passos[plan.passos.length - 1]?.acao === 'finalizar' ? plan.passos.slice(0, -1) : plan.passos
  if (steps.map(step => step.acao).join(',') !== 'cruzar,passar_baixo,passar_baixo,apertar') return false
  const tip = steps[1].pontas[0]
  return !!tip && steps[1].pontas.length === 1 && steps[2].pontas.length === 1 && steps[2].pontas[0] === tip && steps[0].pontas.includes(tip)
}

const definitions = [{ id: 'double-overhand', name: 'Nó simples duplo', matches: matchesDoubleOverhand,
  build: buildDoubleOverhandFrames }]

export function registeredKnot(plan: Plan) {
  return definitions.find(definition => (!plan.animacao || plan.animacao.id === definition.id) && definition.matches(plan))
}
