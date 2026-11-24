import { loadPyodide } from 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs'

let analisar

async function iniciar() {
  try {
    const pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/' })
    const resposta = await fetch(new URL('compilador.zip', import.meta.url))
    if (!resposta.ok) throw new Error('Pacote do compilador indisponível.')
    pyodide.unpackArchive(await resposta.arrayBuffer(), 'zip', { extractDir: '/home/pyodide/amarra' })
    pyodide.runPython("import sys\nsys.path.insert(0, '/home/pyodide/amarra')")
    analisar = pyodide.pyimport('src.studio_web').analisar_json
    self.postMessage({ tipo: 'pronto' })
  } catch (erro) {
    self.postMessage({ tipo: 'falha', mensagem: String(erro) })
  }
}

self.onmessage = ({ data }) => {
  if (!analisar || data.tipo !== 'analisar') return
  try {
    self.postMessage({ tipo: 'resultado', id: data.id,
      resultado: JSON.parse(analisar(data.codigo, data.selecionado)) })
  } catch (erro) {
    self.postMessage({ tipo: 'falha', id: data.id, mensagem: String(erro) })
  }
}

void iniciar()
