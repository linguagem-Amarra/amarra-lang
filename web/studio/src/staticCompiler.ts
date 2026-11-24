import type { Diagnostic, Plan } from './types'

type Result = Plan | { ok: false; diagnosticos: Diagnostic[]; nos?: Plan['nos'] }
type WorkerMessage = { tipo: 'pronto' | 'resultado' | 'falha'; id?: number; resultado?: Result; mensagem?: string }

let nextId = 0
let ready: Promise<Worker> | undefined
const pending = new Map<number, { resolve: (result: Result) => void; reject: (error: Error) => void }>()

function compilerWorker(): Promise<Worker> {
  if (ready) return ready
  ready = new Promise((resolve, reject) => {
    const worker = new Worker(new URL('studioCompiler.worker.js', document.baseURI), { type: 'module' })
    const fail = (error: Error) => {
      reject(error)
      for (const request of pending.values()) request.reject(error)
      pending.clear()
      worker.terminate()
      ready = undefined
    }
    worker.onerror = () => fail(new Error('Não foi possível iniciar o compilador no navegador.'))
    worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
      if (data.tipo === 'pronto') resolve(worker)
      else if (data.tipo === 'falha' && data.id === undefined) fail(new Error(data.mensagem ?? 'Falha ao carregar o compilador.'))
      else if (data.id !== undefined) {
        const request = pending.get(data.id)
        if (!request) return
        pending.delete(data.id)
        if (data.tipo === 'resultado' && data.resultado) request.resolve(data.resultado)
        else request.reject(new Error(data.mensagem ?? 'Falha ao compilar.'))
      }
    }
  })
  return ready
}

export async function compileInBrowser(codigo: string, selecionado: number): Promise<Result> {
  if (codigo.length > 32000) throw new Error('O código excede o limite de 32.000 caracteres.')
  const worker = await compilerWorker()
  const id = ++nextId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    worker.postMessage({ tipo: 'analisar', id, codigo, selecionado })
  })
}
