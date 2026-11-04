import { exemplos, criarQuadros, descrever, nomePonta } from './movimentos.js';
import { Cena } from './cena.js';

const $=id=>document.getElementById(id), codigo=$('codigo'), cena=new Cena($('cordas'));
let worker, pronto=false, ocupado=false, resultado=null, plano=null, quadros=[], pontas=[], cursor=0;
let tocando=false, temporizador=0, limite=0, requisicao=0, linhaAtiva=0, linhaErro=false, aba='tokens';
const rascunho='amarra-editor-v1';
const rotulos={cruzar:'Cruzar as pontas',passar_baixo:'Passar por baixo',passar_cima:'Passar por cima',enrolar:'Enrolar',apertar:'Apertar',finalizar:'Finalizar'};

function texto(tag,conteudo,classe){const e=document.createElement(tag);e.textContent=conteudo;if(classe)e.className=classe;return e;}
function estado(mensagem,erro=false){$('estado').textContent=mensagem;$('estado').classList.toggle('falhou',erro);}
function numerar(){
  $('numeros').replaceChildren(...codigo.value.split('\n').map((_,i)=>texto('span',i+1,linhaAtiva===i+1?(linhaErro?'erro':'ativo'):'')));
  $('numeros').style.transform=`translateY(${-codigo.scrollTop}px)`;
  const pos=15+(linhaAtiva-1)*25-codigo.scrollTop;
  codigo.style.backgroundImage=linhaAtiva?`linear-gradient(to bottom,transparent ${pos}px,${linhaErro?'#f9e6de':'#e6efdf'} ${pos}px,${linhaErro?'#f9e6de':'#e6efdf'} ${pos+25}px,transparent ${pos+25}px)`:'none';
}
function destacar(linha,erro=false,selecionar=false){
  linhaAtiva=linha||0;linhaErro=erro;
  if(linha){const y=(linha-1)*25;if(y<codigo.scrollTop||y>codigo.scrollTop+codigo.clientHeight-45)codigo.scrollTop=Math.max(0,y-60);}
  if(selecionar){const linhas=codigo.value.split('\n'),inicio=linhas.slice(0,linha-1).join('\n').length+(linha>1?1:0);codigo.focus();codigo.setSelectionRange(inicio,inicio+(linhas[linha-1]||'').length);}
  numerar();
}
function pausar(){tocando=false;clearTimeout(temporizador);$('reproduzir').replaceChildren(texto('span','▶'),document.createTextNode(' Reproduzir'));}
function botoes(){
  const disponivel=!!plano&&!ocupado&&pontas.length<=2&&plano.passos.length>0;
  $('analisar').disabled=!pronto||ocupado;
  $('anterior').disabled=!disponivel||cursor===0;$('proximo').disabled=!disponivel||cursor===plano.passos.length;
  $('reiniciar').disabled=!disponivel||cursor===0;$('reproduzir').disabled=!disponivel;
}
function limpar(){
  pausar();resultado=null;plano=null;cursor=0;quadros=[];pontas=[];
  $('etapas').replaceChildren(texto('li','Analise o código para gerar um novo roteiro.','vazio'));
  $('total-etapas').textContent='—';$('total-tokens').textContent='0';$('seletor-no').hidden=true;
  $('diagnosticos').hidden=true;$('aviso-visual').hidden=true;destacar(0);
  cena.mostrar({fase:'livre',ativa:0,cima:0,voltas:0},['ponta_direita'],false);
  $('cordas').setAttribute('aria-label','Duas pontas de cadarço soltas, azul e laranja.');
  $('numero-passo').textContent='00';$('rotulo-passo').textContent='ANTES DE COMEÇAR';
  $('titulo-passo').textContent='Tudo começa com duas pontas.';$('descricao-passo').textContent='Analise o código para acompanhar esta sequência.';
  $('progresso').style.width='0%';detalhes();botoes();
}
function carregarExemplo(nome){
  requisicao++;codigo.value=exemplos[nome];codigo.scrollTop=0;
  $('nome-arquivo').textContent=nome==='simples'?'cadarco.amr':`${nome}.amr`;
  limpar();numerar();salvarRascunho();if(pronto&&!ocupado)analisar();
}
function salvarRascunho(){try{localStorage.setItem(rascunho,codigo.value);}catch{/* O editor funciona mesmo sem armazenamento local. */}}
function iniciar(){
  worker?.terminate();pronto=false;ocupado=false;botoes();$('tentar').hidden=true;
  estado('Carregando o compilador. A primeira abertura pode levar alguns instantes…');
  worker=new Worker(new URL('./compilador.worker.js',import.meta.url),{type:'module'});
  clearTimeout(limite);limite=setTimeout(()=>falha('O carregamento demorou mais que o esperado. Confira a conexão e tente novamente.'),90000);
  worker.onmessage=({data})=>{
    if(data.tipo==='estado'){estado(data.mensagem);return;}
    if(data.tipo==='pronto'){clearTimeout(limite);pronto=true;botoes();analisar();return;}
    if(data.id!==undefined&&data.id!==requisicao){ocupado=false;clearTimeout(limite);botoes();return;}
    if(data.tipo==='falha'){falha('Não foi possível carregar ou executar o compilador. Tente novamente.');console.error(data.mensagem);return;}
    if(data.tipo==='resultado'){
      clearTimeout(limite);ocupado=false;
      if(!data.resultado.ok){mostrarErros(data.resultado.diagnosticos);botoes();return;}
      resultado=data.resultado;$('diagnosticos').hidden=true;$('total-tokens').textContent=resultado.tokens.length;
      $('no-ativo').replaceChildren(...resultado.planos.map((p,i)=>{const o=texto('option',p.nome);o.value=i;return o;}));
      $('seletor-no').hidden=resultado.planos.length<2;
      estado('Código válido. Seu roteiro está pronto.');$('estado-editor').textContent='Léxico, sintaxe e semântica verificados.';
      escolherNo(0);detalhes();botoes();
    }
  };
  worker.onerror=()=>falha('O compilador não carregou. Verifique sua conexão e tente novamente.');
}
function falha(mensagem){clearTimeout(limite);worker?.terminate();ocupado=false;pronto=false;limpar();estado(mensagem,true);$('tentar').hidden=false;botoes();}
function analisar(){
  if(!pronto||ocupado)return;limpar();ocupado=true;const id=++requisicao;
  estado('Analisando e preparando os movimentos…');botoes();
  limite=setTimeout(()=>falha('A análise excedeu o tempo disponível. Simplifique o programa e tente novamente.'),15000);
  worker.postMessage({tipo:'analisar',codigo:codigo.value,id});
}
function mostrarErros(erros){
  $('diagnosticos').replaceChildren(...erros.map(e=>{const b=texto('button',e.mensagem);b.onclick=()=>destacar(e.linha,true,true);return b;}));
  $('diagnosticos').hidden=false;estado(`${erros.length} ${erros.length===1?'problema encontrado':'problemas encontrados'}. Clique na mensagem para localizar.`,true);
  $('estado-editor').textContent='Corrija o trecho indicado e analise novamente.';destacar(erros[0]?.linha,true);
}
function escolherNo(indice){
  pausar();plano=resultado.planos[indice];({quadros,pontas}=criarQuadros(plano));cursor=0;
  $('nome-azul').textContent=nomePonta(pontas[0]);$('nome-laranja').textContent=nomePonta(pontas[1]);
  $('total-etapas').textContent=`${plano.passos.length} etapas`;
  $('etapas').replaceChildren(...plano.passos.map((p,i)=>{
    const li=document.createElement('li'),b=document.createElement('button'),info=document.createElement('div');
    info.append(texto('strong',rotulos[p.acao]),texto('small',`Linha ${p.linha}${p.acao==='enrolar'?` · volta ${p.volta}/${p.quantidade}`:''}`));
    b.append(texto('span',String(i+1).padStart(2,'0')),info);b.onclick=()=>{pausar();ir(i+1);};li.append(b);return li;
  }));
  if(!plano.passos.length)$('etapas').append(texto('li','Este programa não produziu movimentos.','vazio'));
  ir(0,false);
}
function ir(n,animar=true){
  if(!plano)return;cursor=Math.max(0,Math.min(n,plano.passos.length));
  const passo=plano.passos[cursor-1],descricao=descrever(passo),q=quadros[cursor];
  $('numero-passo').textContent=String(cursor).padStart(2,'0');
  $('rotulo-passo').textContent=cursor?`ETAPA ${cursor} DE ${plano.passos.length}`:'ANTES DE COMEÇAR';
  $('titulo-passo').textContent=descricao.titulo;$('descricao-passo').textContent=descricao.texto;
  $('cordas').setAttribute('aria-label',`${descricao.titulo} ${descricao.texto}`);
  $('progresso').style.width=`${plano.passos.length?cursor/plano.passos.length*100:0}%`;
  $('etapas').querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('ativo',i+1===cursor);b.classList.toggle('concluido',i+1<cursor);b.setAttribute('aria-current',String(i+1===cursor));});
  const aviso=pontas.length>2?'Este programa usa mais de duas pontas. Consulte o roteiro e os detalhes; o desenho desta versão acompanha apenas duas.':q.aviso;
  $('aviso-visual').hidden=!aviso;$('aviso-visual').textContent=aviso;
  if(pontas.length<=2)cena.mostrar(q,pontas,animar,Number($('velocidade').value));
  destacar(passo?.linha);botoes();if(aba==='variaveis')detalhes();
}
function reproduzir(){
  if(tocando){pausar();return;}
  if(!plano||!plano.passos.length||pontas.length>2)return;
  if(cursor===plano.passos.length)ir(0,false);
  tocando=true;$('reproduzir').replaceChildren(texto('span','Ⅱ'),document.createTextNode(' Pausar'));
  const seguir=()=>{if(!tocando)return;if(cursor>=plano.passos.length){pausar();return;}ir(cursor+1);temporizador=setTimeout(seguir,1900/Number($('velocidade').value));};seguir();
}
function tabela(cabecalhos,linhas){
  const t=document.createElement('table'),head=document.createElement('thead'),r=document.createElement('tr'),body=document.createElement('tbody');
  cabecalhos.forEach(c=>r.append(texto('th',c)));head.append(r);
  linhas.forEach(l=>{const tr=document.createElement('tr');l.forEach(v=>tr.append(texto('td',v)));body.append(tr);});t.append(head,body);return t;
}
function detalhes(){
  const painel=$('dados');painel.replaceChildren();painel.setAttribute('aria-labelledby',`tab-${aba}`);
  if(!resultado){painel.append(texto('p','Analise um programa para explorar seus tokens, a AST e as variáveis.','texto-vazio'));return;}
  if(aba==='ast'){painel.append(texto('pre',resultado.arvore));return;}
  if(aba==='tokens'){painel.append(tabela(['TIPO','TEXTO','LINHA · COLUNA'],resultado.tokens.map(t=>[t.tipo,t.texto,`${t.linha} · ${t.coluna}`])));return;}
  if(aba==='simbolos'){
    if(!resultado.simbolos.length){painel.append(texto('p','Este programa não declara variáveis.','texto-vazio'));return;}
    painel.append(tabela(['NÓ','NOME','TIPO','ESCOPO'],resultado.simbolos.map(s=>[s.definicao,s.nome,s.tipo,s.escopo])));return;
  }
  const valores=plano?.passos[cursor-1]?.variaveis||{};
  if(!Object.keys(valores).length){painel.append(texto('p','Nenhuma variável visível nesta etapa.','texto-vazio'));return;}
  painel.append(tabela(['VARIÁVEL','VALOR'],Object.entries(valores).map(([nome,valor])=>[nome,typeof valor==='boolean'?(valor?'verdadeiro':'falso'):String(valor)])));
}
codigo.addEventListener('input',()=>{requisicao++;limpar();estado(pronto?'Código alterado. Analise novamente para atualizar o nó.':'Preparando o compilador…');$('estado-editor').textContent='Alterações salvas neste navegador.';salvarRascunho();numerar();});
codigo.addEventListener('scroll',numerar);
codigo.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const inicio=codigo.selectionStart,fim=codigo.selectionEnd;codigo.setRangeText('    ',inicio,fim,'end');codigo.dispatchEvent(new Event('input'));}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();analisar();}});
$('analisar').onclick=analisar;$('tentar').onclick=iniciar;$('reproduzir').onclick=reproduzir;
$('proximo').onclick=()=>{pausar();ir(cursor+1);};$('anterior').onclick=()=>{pausar();ir(cursor-1);};$('reiniciar').onclick=()=>{pausar();ir(0);};
$('exemplo').onchange=e=>carregarExemplo(e.target.value);$('no-ativo').onchange=e=>escolherNo(Number(e.target.value));
$('abrir').onclick=()=>$('arquivo').click();
$('arquivo').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>80000)throw new Error('Use um arquivo de até 20.000 caracteres.');const valor=await f.text();if(valor.length>20000)throw new Error('Use um arquivo de até 20.000 caracteres.');codigo.value=valor;$('nome-arquivo').textContent=f.name;codigo.dispatchEvent(new Event('input'));}catch(erro){estado(erro.message,true);}e.target.value='';};
$('baixar').onclick=()=>{const url=URL.createObjectURL(new Blob([codigo.value],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=$('nome-arquivo').textContent.endsWith('.amr')?$('nome-arquivo').textContent:'programa.amr';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const abas=[...document.querySelectorAll('[data-aba]')];
function selecionarAba(b){aba=b.dataset.aba;abas.forEach(a=>{a.setAttribute('aria-selected',String(a===b));a.tabIndex=a===b?0:-1;});detalhes();}
abas.forEach((b,i)=>{b.onclick=()=>selecionarAba(b);b.onkeydown=e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?abas.length-1:(i+(e.key==='ArrowRight'?1:-1)+abas.length)%abas.length;abas[n].focus();selecionarAba(abas[n]);}};});
try{codigo.value=localStorage.getItem(rascunho)||exemplos.simples;}catch{codigo.value=exemplos.simples;}
numerar();iniciar();
