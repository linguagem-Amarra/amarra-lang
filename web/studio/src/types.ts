import type { MotionTrack } from './ropeMotion'
import { getDoubleOverhandTimeline } from './knots/doubleOverhandTimeline'

export type Point = [number, number, number]
export type Source = { linha: number; coluna: number; fimLinha: number; fimColuna: number }
export type Step = {
  id: number; acao: 'cruzar' | 'passar_baixo' | 'passar_cima' | 'enrolar' | 'apertar' | 'finalizar'
  pontas: string[]; valor: number | string | boolean | null; origem: Source; duracao: number
}
export type Diagnostic = { fase: string; mensagem: string; linha: number; coluna: number }
export type Plan = {
  animacao?: { id: string; nome: string; pontaTrabalho: string; passagens: number; versao: number }
  ok: true; versao: number; nome: string; selecionado: number
  nos: { id: number; nome: string }[]; pontas: string[]; passos: Step[]
  variaveis: Record<string, { tipo: string; valor: unknown }>
}
export type Example = { id: string; nome: string; descricao: string; numero: string; codigo: string }
export type Reinforcement = {
  coil?: { start: number; end: number; center: Point; axis: Point }
  tip: 'A' | 'B'; fromTurns: number; turns: number; tension: number; approach?: boolean; approachEnd?: number; focus?: Point
}
export type Frame = {
  knot?: { id: string; stage: string; passes: number; tightness: number; labels: ['A' | 'B', 'A' | 'B'];
    phase: 'initial' | 'loop' | 'first-pass' | 'second-pass' | 'tighten' | 'finished';
    workingTip: 'A' | 'B'; length: number; focus: Point }
  construction?: Frame
  reserve?: [number, number]
  points: Point[]; tips: [Point, Point]; via?: Point[][]; reinforcement?: Reinforcement; motion?: MotionTrack; duration?: number
}

export const actionNames: Record<Step['acao'], string> = {
  cruzar: 'Cruzar as pontas', passar_baixo: 'Passar por baixo', passar_cima: 'Passar por cima',
  enrolar: 'Enrolar a ponta', apertar: 'Apertar o nó', finalizar: 'Finalizar',
}

export function smoothMotion(t: number) {
  const u = Math.max(0, Math.min(1, t))
  return u * u * u * (10 + u * (-15 + 6 * u))
}

// Reserva o fim de cada passagem para observar a ponta já fora da abertura.
export function passageProgress(fraction: number) {
  return smoothMotion(fraction / .88)
}

export function windingProgress(fraction: number, reinforcement: Reinforcement) {
  const preparation = reinforcement.approach ? (reinforcement.approachEnd ?? .4) : 0
  return smoothMotion(Math.max(0, (fraction - preparation) / (1 - preparation)))
}

export function stepDuration(step: Step, target?: Frame) {
  return target?.duration ?? step.duracao
}

export function knotStateAt(knot: Frame['knot'], fraction: number): Frame['knot'] {
  if (!knot) return undefined
  const current = { ...knot }
  if (knot.phase === 'first-pass' || knot.phase === 'second-pass') {
    const base = knot.phase === 'first-pass' ? 0 : 1
    current.passes = base + (passageProgress(fraction) >= .5 ? 1 : 0)
  }
  if (knot.phase === 'tighten') {
    const split = getDoubleOverhandTimeline().dressingFraction
    current.tightness = fraction < split ? 0 : smoothMotion((fraction - split) / (1 - split))
    current.stage = fraction < split ? 'Organizar as duas passagens' : 'Apertar gradualmente'
  }
  return current
}

export function stepName(step: Step, target?: Frame) {
  return target?.knot ? target.knot.phase === 'tighten' ? 'Organizar e apertar' : target.knot.stage : actionNames[step.acao]
}

export function motionCaption(step: Step, target: Frame, fraction: number) {
  if (target.knot) return knotStateAt(target.knot, fraction)!.stage
  const reinforcement = target.reinforcement
  if (step.acao === 'enrolar' && reinforcement) {
    if (reinforcement.approach && fraction < (reinforcement.approachEnd ?? .4)) return `Volta ${reinforcement.fromTurns + 1} · posicionar ponta`
    const t = windingProgress(fraction, reinforcement)
    const turns = reinforcement.fromTurns + (reinforcement.turns - reinforcement.fromTurns) * t
    const turn = Math.min(reinforcement.turns, Math.floor(turns) + 1)
    return `Volta ${turn} · ${turns % 1 < .5 ? 'contornar o ramo' : 'fechar enrolamento'}`
  }
  if (step.acao === 'apertar' && reinforcement) return `Acomodar ${reinforcement.turns} ${reinforcement.turns === 1 ? 'volta' : 'voltas'} e apertar`
  if (step.acao === 'finalizar' && reinforcement) return `${reinforcement.turns} ${reinforcement.turns === 1 ? 'volta de reforço concluída' : 'voltas de reforço concluídas'}`
  if ((step.acao === 'passar_baixo' || step.acao === 'passar_cima') && target.via) {
    return fraction < 1 / 3 ? 'Contornar o ramo' : fraction < 2 / 3 ? 'Passar pela abertura' : 'Puxar a ponta para fora'
  }
  return actionNames[step.acao]
}

export function describe(step: Step) {
  const ponta = step.pontas[0]?.replaceAll('_', ' ')
  switch (step.acao) {
    case 'cruzar': return `${ponta} sobre ${step.pontas[1].replaceAll('_', ' ')}.`
    case 'passar_baixo': return `Leve a ${ponta} por baixo do cruzamento.`
    case 'passar_cima': return `Leve a ${ponta} por cima do cruzamento.`
    case 'enrolar': return `${step.valor} ${step.valor === 1 ? 'volta' : 'voltas'} com a ${ponta}.`
    case 'apertar': return 'Puxe as pontas para aproximar as voltas.'
    case 'finalizar': return String(step.valor)
  }
}
