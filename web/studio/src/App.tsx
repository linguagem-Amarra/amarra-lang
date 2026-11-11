import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowLeft, ArrowRight, Braces, Check, CheckCircle2, ChevronDown,
  CircleHelp, Code2, FileCode2, FolderOpen, Grid2X2, Maximize2, Pause, Play, RotateCcw,
  ScanLine, Terminal, X, XCircle } from 'lucide-react'
import { RopeScene } from './RopeScene'
import { initialFrame } from './geometry'
import { describe, motionCaption, stepDuration, stepName, type Diagnostic, type Example, type Plan, type Frame } from './types'
import { KnotAnimationEngine } from './animation/KnotAnimationEngine'
import { registeredKnot } from './knots/knotRegistry'
import { compileInBrowser } from './staticCompiler'

const staticSite = import.meta.env.VITE_STUDIO_STATIC === 'true'

function Brand({ small = false }: { small?: boolean }) {
  return <div className={`brand ${small ? 'brand-small' : ''}`}><svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <path d="M8 30C4 20 13 6 22 9c9 3 10 20 3 23C15 36 6 17 13 12c7-5 22 5 20 14" stroke="currentColor" strokeWidth="3.7" strokeLinecap="round" />
    <path d="m9 28 2 4m21-9-1 5" stroke="#101513" strokeWidth="6" /><path d="m9 28 2 4m21-9-1 5" stroke="currentColor" strokeWidth="3.7" strokeLinecap="round" />
  </svg><span>amarra<span className="brand-studio">studio</span></span></div>
}

const tokenPattern = /(\/\/.*$|"[^"\r\n]*"|\b(?:no|inteiro|real|texto|booleano|cruzar|passar_baixo|passar_cima|enrolar|apertar|finalizar|repetir|se|senao|verdadeiro|falso|e|ou)\b|\b\d+(?:\.\d+)?\b|[{};()]|[+*/<>=-])/g
function Highlight({ line }: { line: string }) {
  let last = 0
  const parts = []
  for (const match of line.matchAll(tokenPattern)) {
    if (match.index! > last) parts.push(line.slice(last, match.index))
    const text = match[0]
    const kind = text.startsWith('//') ? 'comment' : text.startsWith('"') ? 'string'
      : /^\d/.test(text) ? 'number' : /^[{};()+*/<>=-]/.test(text) ? 'symbol' : 'keyword'
    parts.push(<span className={`token-${kind}`} key={match.index}>{text}</span>)
    last = match.index! + text.length
  }
  parts.push(line.slice(last))
  return <>{parts.length ? parts : ' '}</>
}

export default function App() {
  const [examples, setExamples] = useState<Example[]>([])
  const [exampleId, setExampleId] = useState('no_simples_duplo')
  const [code, setCode] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [catalog, setCatalog] = useState<Plan['nos']>([])
  const [selected, setSelected] = useState(0)
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([])
  const [networkError, setNetworkError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [playing, setUiPlaying] = useState(false)
  const [progress, setUiProgress] = useState(0)
  const [poseProgress, setPoseProgress] = useState(0)
  const engine = useMemo(() => new KnotAnimationEngine(), [])
  const setPlaying = useCallback((value: boolean) => {
    if (value) engine.play(); else engine.pause()
    setUiPlaying(engine.playing); setUiProgress(engine.position); setPoseProgress(engine.posePosition)
  }, [engine])
  const setProgress = useCallback((position: number) => {
    engine.seek(position); setUiProgress(engine.position); setPoseProgress(engine.posePosition)
  }, [engine])
  const publishPlayback = useCallback((position: number, pose: number, running: boolean) => {
    setUiProgress(position); setPoseProgress(pose); setUiPlaying(running)
  }, [])
  const [speed, setSpeed] = useState(1)
  const [autoAdvance, setAutoAdvance] = useState(true)
  const [grid, setGrid] = useState(true)
  const [detail, setDetail] = useState(true)
  const [cameraKey, setCameraKey] = useState(0)
  const [view, setView] = useState<'code' | 'variables'>('code')
  const [fileName, setFileName] = useState('no_simples_duplo.amr')
  const request = useRef(0)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const help = useRef<HTMLDialogElement>(null)
  const emptyFrames = useMemo(() => [initialFrame()], [])
  const [geometry, setGeometry] = useState<{ plan: Plan | null; frames: Frame[]; error: string }>({ plan: null, frames: emptyFrames, error: '' })
  const frames = geometry.plan === plan ? geometry.frames : emptyFrames
  const count = plan?.passos.length ?? 0
  const geometryReady = !!plan && geometry.plan === plan && !geometry.error && frames.length === count + 1
  const geometryError = geometry.plan === plan ? geometry.error : ''
  const activeIndex = Math.min(Math.floor(progress), count - 1)
  const active = plan?.passos[activeIndex]
  const definition = plan ? registeredKnot(plan) : undefined
  const lines = code.split('\n')

  useEffect(() => {
    if (!plan) return
    const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' })
    let cancelled = false
    worker.onmessage = (event: MessageEvent<{ frames?: Frame[]; error?: string }>) => {
      if (cancelled) return
      setGeometry({ plan, frames: event.data.frames ?? emptyFrames,
        error: event.data.error ? `Falha ao preparar a animação: ${event.data.error}` : '' })
      worker.terminate()
    }
    worker.onerror = () => {
      if (!cancelled) setGeometry({ plan, frames: emptyFrames, error: 'Não foi possível iniciar a preparação da animação. Recompile o código.' })
      worker.terminate()
    }
    worker.postMessage(plan)
    return () => { cancelled = true; worker.terminate() }
  }, [plan, emptyFrames])

  const compile = useCallback(async (source: string, selection = 0) => {
    const id = ++request.current
    setBusy(true); setPlaying(false); setProgress(0); setPlan(null); setSelected(selection)
    setNetworkError(''); setDiagnostics([])
    try {
      const result = staticSite ? await compileInBrowser(source, selection) : await (async () => {
        const response = await fetch('/api/compilar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: source, selecionado: selection }),
        })
        if (!response.ok) throw new Error(`A API respondeu com HTTP ${response.status}.`)
        return response.json()
      })()
      if (id !== request.current) return
      setDirty(false)
      if (result.nos) setCatalog(result.nos)
      if (result.ok) { setPlan(result); setSelected(selection) }
      else setDiagnostics(result.diagnosticos)
    } catch (error) {
      if (id === request.current) setNetworkError(`Não foi possível compilar. ${error instanceof Error ? error.message : 'Verifique a API Python.'}`)
    } finally {
      if (id === request.current) setBusy(false)
    }
  }, [setPlaying, setProgress])

  const loadExamples = useCallback(async () => {
    setNetworkError('')
    try {
      const response = await fetch(staticSite ? new URL('examples.json', document.baseURI) : '/api/exemplos')
      if (!response.ok) throw new Error('Não foi possível carregar os exemplos da API.')
      const items: Example[] = await response.json()
      setExamples(items)
      const initial = items.find(item => item.id === 'no_simples_duplo') ?? items[0]
      setCode(initial.codigo)
      setExampleId(initial.id); setFileName(`${initial.id}.amr`)
      setCatalog([]); setSelected(0)
      await compile(initial.codigo)
    } catch {
      setNetworkError('A API Python está indisponível. Inicie o Studio e tente conectar novamente.')
    }
  }, [compile])

  useEffect(() => { void loadExamples(); return () => { ++request.current } }, [loadExamples])

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault(); void compile(code, selected)
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [code, selected, compile])

  useEffect(() => {
    engine.configure(plan?.passos ?? [], frames)
    setUiPlaying(false); setUiProgress(engine.position); setPoseProgress(engine.posePosition)
  }, [engine, plan, frames])
  useEffect(() => () => engine.dispose(), [engine])
  useEffect(() => { engine.setSpeed(speed) }, [engine, speed])
  useEffect(() => { engine.autoAdvance = autoAdvance }, [engine, autoAdvance])
  useEffect(() => {
    const hide = () => { if (document.hidden) setPlaying(false) }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [setPlaying])

  const edit = (value: string) => {
    ++request.current
    setCode(value); setDirty(true); setPlan(null); setCatalog([]); setSelected(0)
    setPlaying(false); setProgress(0); setDiagnostics([]); setBusy(false)
  }

  const load = (item: Example) => {
    setExampleId(item.id); setFileName(`${item.id}.amr`); setCode(item.codigo)
    setSelected(0); setCatalog([]); setView('code')
    void compile(item.codigo)
  }

  const jumpToLine = (line: number, column = 0) => {
    setView('code')
    requestAnimationFrame(() => {
      const input = textarea.current
      if (!input) return
      const index = lines.slice(0, line - 1).reduce((sum, text) => sum + text.length + 1, 0) + column
      input.focus(); input.setSelectionRange(index, index)
      input.closest('.code-scroll')?.scrollTo({ top: Math.max(0, (line - 5) * 26), behavior: 'smooth' })
    })
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = fileName; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const totalSeconds = plan?.passos.reduce((sum, step, i) => sum + stepDuration(step, frames[i + 1]), 0) ?? 0
  const elapsedSeconds = plan?.passos.reduce((sum, step, i) => sum + stepDuration(step, frames[i + 1]) * Math.min(1, Math.max(0, progress - i)), 0) ?? 0
  const clock = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`

  return <div className="app-shell">
    <header className="topbar"><Brand /><span className="topbar-divider" /><span className="workspace-name">Seu ateliê de nós</span>
      <div className="topbar-right"><span className="local-badge"><span /> Ambiente local</span>
        <button className="text-button" onClick={() => help.current?.showModal()}><CircleHelp size={16} /> Como usar</button></div>
    </header>

    <main>
      <div className="page-heading"><div><div className="eyebrow">LINGUAGEM EM MOVIMENTO</div><h1>Cada comando, <span>um novo laço.</span></h1>
        <p>Escreva, execute e descubra como um nó ganha forma.</p></div><div className="heading-note"><span className="tiny-knot">⌘</span><span>Da lógica ao gesto.<br /><strong>Um passo de cada vez.</strong></span></div></div>

      <div className="studio-layout">
        <aside className="library"><div className="section-label"><span>EXPLORAR NÓS</span><span>{String(examples.length).padStart(2, '0')}</span></div>
          <nav aria-label="Exemplos de nós">{examples.map(item => <button key={item.id} className={`example-card ${exampleId === item.id ? 'selected' : ''}`} onClick={() => load(item)}>
            <div className="example-top"><span className="example-number">{item.numero}</span><span className="knot-icon"><svg viewBox="0 0 80 48" fill="none" aria-hidden="true"><path d={item.id === 'no_simples' ? 'M6 34C18 36 35 3 49 11S45 47 30 36 38 5 73 15' : item.id === 'no_reforcado' || item.id === 'no_simples_duplo' ? 'M4 34C22 41 28 5 42 10S27 46 42 39 52 6 63 15 64 36 76 30' : 'M15 7 41 31 65 7M19 15 40 41 61 15M30 27 25 44M49 27 55 44'} stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>{exampleId === item.id && <span className="selected-dot" />}</div>
            <strong>{item.nome}</strong><p>{item.descricao}</p><span className="example-link">Abrir no editor <ArrowRight size={13} /></span>
          </button>)}</nav>
          <div className="library-bottom"><Braces size={22} /><p>Pequenas instruções.<br /><strong>Infinitas possibilidades.</strong></p><span>Feito com Amarra + ANTLR4</span></div>
        </aside>

        <section className="editor-panel" aria-label="Editor Amarra"><div className="panel-header"><div className="panel-title"><Code2 size={16} /><span>Editor</span></div><span className="file-type">.amr</span></div>
          <div className="file-bar"><span><FileCode2 size={14} />{fileName}{dirty && <i title="Alterações ainda não compiladas" />}</span><div>
            <button className="icon-button" title="Abrir arquivo .amr" aria-label="Abrir arquivo Amarra" onClick={() => file.current?.click()}><FolderOpen size={16} /></button>
            <button className="icon-button" title="Baixar código .amr" aria-label="Baixar código Amarra" onClick={download} disabled={!code}><ArrowDownToLine size={16} /></button>
          </div></div>
          <input ref={file} type="file" accept=".amr,.txt" hidden onChange={async event => {
            const chosen = event.target.files?.[0]
            if (!chosen) return
            if (chosen.size > 128000) { setNetworkError('O arquivo é muito grande. O editor aceita até 32.000 caracteres.'); return }
            const text = await chosen.text()
            if (text.length > 32000) { setNetworkError('O editor aceita até 32.000 caracteres.'); return }
            setFileName(chosen.name); setExampleId(''); edit(text)
            event.target.value = ''
          }} />
          <div className="editor-tabs"><button className={view === 'code' ? 'active' : ''} onClick={() => setView('code')}>Código</button><button className={view === 'variables' ? 'active' : ''} onClick={() => setView('variables')}>Variáveis <span>{Object.keys(plan?.variaveis ?? {}).length}</span></button></div>
          {view === 'code' ? <div className="code-scroll"><div className="line-numbers" aria-hidden="true">{lines.map((_, i) => <div key={i} className={active?.origem.linha === i + 1 ? 'current' : ''}>{String(i + 1).padStart(2, '0')}</div>)}</div>
            <div className="code-area" style={{ minWidth: `${Math.max(43, ...lines.map(l => l.length + 2))}ch` }}>
              <pre aria-hidden="true">{lines.map((line, i) => <div className={`code-line ${active?.origem.linha === i + 1 ? 'current' : ''} ${diagnostics.some(d => d.linha === i + 1) ? 'has-error' : ''}`} key={i}><Highlight line={line || ' '} /></div>)}</pre>
              <textarea ref={textarea} aria-label="Código Amarra" value={code} onChange={event => edit(event.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" maxLength={32000}
                onKeyDown={event => {
                  if (event.key === 'Tab') {
                    event.preventDefault()
                    const start = event.currentTarget.selectionStart, end = event.currentTarget.selectionEnd
                    edit(code.slice(0, start) + '    ' + code.slice(end))
                    requestAnimationFrame(() => textarea.current?.setSelectionRange(start + 4, start + 4))
                  }
                }} />
            </div></div> : <div className="variables-view">{plan && Object.keys(plan.variaveis).length ? Object.entries(plan.variaveis).map(([name, item]) => <div className="variable" key={name}><code>{name}</code><span>{item.tipo}</span><strong>{String(item.valor)}</strong></div>) : <p>{plan ? 'Este programa não declara variáveis.' : 'Compile o código para inspecionar as variáveis.'}</p>}</div>}
          <div className="editor-status"><span><span className="status-dot" />Amarra</span><span>UTF-8 <span className="status-separator">|</span> {lines.length} linhas</span></div>
          <div className="compile-bar"><span><kbd>Ctrl</kbd> + <kbd>Enter</kbd></span><button className="primary-button" onClick={() => void compile(code, selected)} disabled={busy || !code.trim()}><Play size={14} fill="currentColor" />{busy ? 'Compilando…' : 'Compilar código'}</button></div>
          <div className={`diagnostic-panel ${diagnostics.length || networkError || geometryError ? 'error' : ''}`} role="status" aria-live="polite"><div className="diagnostic-heading"><Terminal size={14} /><span>SAÍDA DO COMPILADOR</span></div>
            {networkError || geometryError ? <div className="diagnostic-message"><XCircle size={16} /><span>{networkError || geometryError}</span><button onClick={() => void (code ? compile(code, selected) : loadExamples())}>Tentar novamente</button></div>
              : diagnostics.length ? diagnostics.map((error, i) => <button className="error-item" key={i} onClick={() => jumpToLine(error.linha, error.coluna)}><XCircle size={15} /><span><strong>L{error.linha}:{error.coluna + 1} · {error.fase}</strong>{error.mensagem}</span></button>)
              : <div className="diagnostic-message">{plan ? <CheckCircle2 size={16} /> : <Terminal size={16} />}<span>{busy ? 'Analisando com ANTLR4…' : dirty ? 'Código alterado. Compile para atualizar a visualização.' : plan ? <>Análise concluída sem erros.<small>{geometryReady ? `${count} movimentos prontos para visualizar.` : 'Preparando a trajetória 3D…'}</small></> : 'Aguardando código para análise.'}</span></div>}
          </div>
        </section>

        <section className="visualizer-panel" aria-label="Visualizador de nós"><div className="panel-header"><div className="panel-title"><ScanLine size={16} /><span>Visualização 3D</span></div><div className="scene-tools"><button className={`icon-button ${grid ? 'on' : ''}`} aria-label="Mostrar grade" aria-pressed={grid} title="Mostrar ou ocultar grade" onClick={() => setGrid(!grid)}><Grid2X2 size={15} /></button><button className="icon-button" aria-label="Restaurar câmera" title="Restaurar câmera" onClick={() => setCameraKey(k => k + 1)}><RotateCcw size={15} /></button>{document.fullscreenEnabled && <button className="icon-button" aria-label="Tela cheia" title="Tela cheia" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void scene.current?.requestFullscreen() }}><Maximize2 size={15} /></button>}</div></div>
          <div className="scene" ref={scene}><div className="scene-caption"><span className="eyebrow">{plan ? 'SEU NÓ, EM MOVIMENTO' : 'VISUALIZADOR'}</span><h2>{plan?.nome ?? 'Uma ideia começa aqui.'}</h2><span className="scene-model-label">{definition ? 'Nó simples duplo · duas passagens · uma corda' : 'Corda contínua · pontas A e B'}</span></div>
            <div className="scene-view-switch" role="group" aria-label="Enquadramento da corda"><button aria-pressed={!detail} onClick={() => setDetail(false)}>Visão geral</button><button aria-pressed={detail} onClick={() => setDetail(true)}>Foco no nó</button></div>
            <RopeScene engine={engine} onPlayback={publishPlayback} frames={frames} progress={progress} cameraKey={cameraKey} showGrid={grid} detail={detail} />
            {plan && !geometryReady && <div className="scene-preparing" role="status">{geometryError || 'Preparando trajetória contínua…'}</div>}
            {active && geometryReady && <div className="motion-caption"><span>{String(activeIndex + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</span><strong>{motionCaption(active, frames[activeIndex + 1], Math.max(0, Math.min(1, poseProgress - activeIndex)))}</strong></div>}
            <div className="scene-legend"><span><i className="orange" />A · {(plan?.pontas[0] ?? 'ponta_direita').replaceAll('_', ' ')}</span><span><i className="blue" />B · {(plan?.pontas[1] ?? 'ponta_esquerda').replaceAll('_', ' ')}</span></div><span className="orbit-hint">Arraste para girar · Role para aproximar</span>
          </div>
          <div className="player"><div className="player-controls"><button className="icon-button" aria-label="Reiniciar animação" title="Reiniciar" disabled={!geometryReady} onClick={() => { setPlaying(false); setProgress(0) }}><RotateCcw size={16} /></button><div className="transport"><button className="icon-button" aria-label="Passo anterior" disabled={!geometryReady || progress === 0} onClick={() => { setPlaying(false); setProgress(Math.max(0, Math.ceil(progress) - 1)) }}><ArrowLeft size={17} /></button><button className="play-button" aria-label={playing ? 'Pausar animação' : 'Reproduzir animação'} disabled={!count || !geometryReady} onClick={() => { if (progress >= count) setProgress(0); setPlaying(!playing) }}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><button className="icon-button" aria-label="Próximo passo" disabled={!geometryReady || progress >= count} onClick={() => { setPlaying(false); setProgress(Math.min(count, Math.floor(progress) + 1)) }}><ArrowRight size={17} /></button></div><label className="speed-select"><select aria-label="Velocidade da animação" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[.25, .5, 1, 1.5, 2].map(s => <option key={s} value={s}>{s}×</option>)}</select><ChevronDown size={12} /></label></div>
            <label className="auto-advance"><input type="checkbox" checked={autoAdvance} onChange={event => setAutoAdvance(event.target.checked)} />Continuar entre etapas automaticamente</label>
            <div className="timeline"><span>{clock(elapsedSeconds)}</span><input aria-label="Posição da animação" type="range" min={0} max={Math.max(1, count)} step={.001} value={progress} disabled={!count || !geometryReady} onChange={event => { setPlaying(false); setProgress(Number(event.target.value)) }} style={{ '--progress': `${count ? progress / count * 100 : 0}%` } as React.CSSProperties} /><span>{clock(totalSeconds)}</span></div>
          </div>
          <div className="steps-heading"><span className="section-label">PASSO A PASSO <span>{String(count).padStart(2, '0')} MOVIMENTOS</span></span>{catalog.length > 1 && <select aria-label="Selecionar definição de nó" value={selected} onChange={e => void compile(code, Number(e.target.value))}>{catalog.map(n => <option key={n.id} value={n.id}>{n.nome}</option>)}</select>}</div>
          <div className="steps-list">{plan ? count ? plan.passos.map((step, i) => <button key={step.id} disabled={!geometryReady} className={`step ${activeIndex === i ? 'active' : ''} ${progress >= i + 1 ? 'completed' : ''}`} onClick={() => { setPlaying(false); setProgress(i); jumpToLine(step.origem.linha, step.origem.coluna) }}><span className="step-number">{progress >= i + 1 ? <Check size={13} /> : String(i + 1).padStart(2, '0')}</span><span className="step-body"><strong>{stepName(step, frames[i + 1])}</strong><small>{describe(step)}</small></span><span className="step-line">L{step.origem.linha}</span>{activeIndex === i && <span className="step-active-dot" />}</button>) : <div className="empty-steps">Sintaxe válida. Adicione comandos para produzir movimentos.</div> : <div className="empty-steps">{diagnostics.length ? 'Corrija os diagnósticos para visualizar os movimentos.' : 'Compile seu código para acompanhar cada passo.'}</div>}</div>
        </section>
      </div>
      <footer><span>AMARRA STUDIO <span className="footer-dot">·</span> Cada comando, um passo. Cada passo, um nó.</span><span>Python + ANTLR4 <span className="footer-dot">/</span> React + Three.js</span></footer>
    </main>
    <dialog ref={help} className="help-dialog"><div className="help-header"><Brand small /><button className="icon-button" aria-label="Fechar ajuda" onClick={() => help.current?.close()}><X size={18} /></button></div><h2>Do código ao movimento.</h2><p>Escolha um exemplo ou abra um arquivo .amr. Edite o programa e use <kbd>Ctrl + Enter</kbd> para compilar com o analisador ANTLR existente.</p><ol><li>O primeiro <code>cruzar A B;</code> define as duas pontas da corda.</li><li>Use <code>passar_baixo</code>, <code>passar_cima</code>, <code>enrolar</code> e <code>apertar</code> para transformá-la.</li><li>Reproduza, pause ou navegue pela linha do tempo. Clique em um passo para encontrar sua instrução.</li></ol><p>A cena é uma representação geométrica didática, sem simulação de tensão ou atrito. O nó simples duplo usa duas passagens pelo mesmo laço antes do aperto. Sua sequência é reconhecida pelos comandos, independentemente do nome do programa. Outros comandos usam o modelo geométrico livre.</p><p>O Studio verifica tipos e nomes durante a execução, aceita até 500 movimentos e 2.000 iterações, e encerra o nó em <code>finalizar</code>. Arquivos e alterações ficam neste ambiente local.</p><button className="primary-button" onClick={() => help.current?.close()}>Começar a explorar <ArrowRight size={15} /></button></dialog>
  </div>
}
