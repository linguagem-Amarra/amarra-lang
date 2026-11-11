# Amarra Studio

Aplicação local para editar programas `.amr`, compilá-los com o ANTLR existente e
reproduzir seus comandos em uma corda 3D contínua. Não usa planos pré-gravados:
edições, variáveis, condições e repetições determinam os movimentos retornados
pela API Python.

## Executar neste checkout

As dependências, os analisadores e o build foram preparados durante a implementação.
Na raiz do repositório:

```bash
.venv/bin/python studio.py
```

Abra **http://127.0.0.1:8000**. Para outra porta: `studio.py --port 8001`.
O servidor escuta somente em `127.0.0.1`. Não publica o projeto.

## Preparar uma nova instalação

Requisitos: Python 3.10 ou superior, Node.js compatível com Vite 7 (20.19+ ou
22.12+) e Java 11+ para gerar os analisadores. O compilador E3 mantém suas
dependências originais; as dependências adicionais estão em `requirements-studio.txt`.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-studio.txt
.venv/bin/python gerar.py
cd web/studio
npm ci
npm run build
cd ../..
.venv/bin/python studio.py
```

No Windows, substitua `.venv/bin/python` por `.venv\Scripts\python.exe`.

Neste checkout, a JRE de geração foi instalada isoladamente em `.venv/java/`,
sem alterar o Java do sistema. Os analisadores foram produzidos pelo ANTLR
4.13.2, com os mesmos argumentos de destino, visitor, encoding e diretórios de
`gerar.py`. A JRE, o JAR e `gerado/` são locais e ignorados pelo Git.

Para desenvolvimento com atualização automática, execute dois terminais:

```bash
# Terminal 1, raiz
.venv/bin/python -m uvicorn src.studio_api:app --reload --host 127.0.0.1 --port 8000
```

```bash
# Terminal 2
cd web/studio
npm run dev
```

Abra a URL impressa pelo Vite. `/api` é encaminhado para o servidor Python;
editor, código e exemplos não dependem de serviços externos.

## Uso

- A abertura padrão e o cartão **Nó reforçado** carregam `exemplos/no_simples_duplo.amr`.
  Nó simples e Windsor continuam disponíveis. O exemplo original `no_reforcado.amr`
  foi preservado e pode ser aberto pelo editor.
- Edite o programa e clique em **Compilar código** ou use **Ctrl + Enter**.
  A edição invalida o plano anterior até uma nova compilação.
- Reproduza, pause, ajuste a velocidade, avance/retorne um passo ou arraste a
  linha do tempo. A velocidade vai de 0,25× a 2×. Desative **Continuar entre etapas
  automaticamente** para pausar ao concluir cada comando. Clicar em um movimento
  também seleciona sua posição no código.
- Arraste a cena para girar a câmera e use a roda para aproximar. A barra da cena
  permite alternar a grade, restaurar a câmera e entrar em tela cheia quando
  suportada pelo navegador.
- Abra arquivos locais e baixe o código atual usando os controles do editor.
  Alterações ficam na memória da página até serem baixadas; não há salvamento
  automático no repositório.
- A aba Variáveis mostra os valores finais das variáveis do bloco externo.
- Diagnósticos léxicos, sintáticos e de execução são apresentados com localização.
  Clique no diagnóstico para ir à posição correspondente.
- Arquivos com múltiplos nós permitem selecionar a definição pelo índice, mesmo
  quando duas definições têm nomes iguais.

## Arquitetura

```text
web/studio/                         React + TypeScript + Vite
  src/App.tsx                     Editor, diagnósticos, arquivos e reprodução
  src/types.ts                    Contrato do plano e descrições dos movimentos
  src/geometry.ts                 Despacho por registro e interpolação determinística
  src/knots/doubleOverhand.ts      Formação, duas passagens, organização e aperto
  src/knots/knotRegistry.ts        Correspondência entre ações e nós cadastrados
  src/animation/KnotAnimationEngine.ts Controles comuns e conversão tempo/etapa
  src/animation/TheatreKnotController.ts Theatre Core e driver do R3F
  src/animation/theatreStudio.ts   Editor Theatre somente em desenvolvimento
  src/animation/validateKnotMotion.ts Validação do cache antes da reprodução
  src/knots/doubleOverhandTimeline.ts Contrato das etapas e validação da autoria
  src/knots/doubleOverhand.theatre.json Estado versionado do Theatre
  src/animation/RopeValidation.ts  Distância exata entre segmentos da linha central
  src/ropeConstruction.ts         Construção da volta e da passagem inicial
  src/ropeWinding.ts              Guias de enrolamento e acomodação da cauda livre
  src/geometry.worker.ts          Preparação da trajetória fora da interface
  src/ropeMotion.ts               Cache temporal e reprodução contínua
  src/ropeSurface.ts              Orientação estável das seções da malha
  src/RopeScene.tsx               Three.js / React Three Fiber e câmera
  tests/geometry.test.ts          Regressões do modelo livre
  tests/doubleOverhand.test.ts     Geometria, passagens e registro do nó duplo
  tests/engine.test.ts             Reprodução e sincronização
  tests/run.ts                    Execução conjunta das asserções
  e2e/studio.spec.ts              Integração real no Chromium
src/studio_plano.py                Visitor da AST e interpretador limitado
src/studio_api.py                  API e entrega do build estático
src/studio_nos.py                  Reconhecimento das sequências executadas
studio.py                         Inicializador local
requirements-studio.txt            Dependências adicionais
tests/test_studio.py               Testes da semântica e da API
```

O fluxo é `código → analisar() → árvore concreta → visitor → AST → interpretador
→ plano JSON → estados da corda → animação`.

As gramáticas e os módulos existentes do compilador não foram alterados. As
verificações adicionais do Studio ficam depois de `analisar()`; portanto, uma
entrada que a CLI E3 aceita continua sendo aceita pela CLI E3, mesmo que o Studio
rejeite sua execução por incompatibilidade de tipos ou falta de cruzamento.

### API

- `GET /api/health`: disponibilidade e versão do contrato.
- `GET /api/exemplos`: lê os três exemplos diretamente do repositório.
- `POST /api/compilar`: recebe `{"codigo": "...", "selecionado": 0}` e devolve
  o catálogo de definições, valores das variáveis e movimentos resolvidos.
  Inclui `animacao` quando a sequência corresponde ao nó cadastrado; programas
  válidos sem correspondência continuam usando o modelo livre.
- `GET /`: entrega `web/studio/dist/index.html`; os assets ficam em `/assets`.
- `/docs`: documentação OpenAPI da API.

O contrato tem `versao: 1`. Um movimento contém `id`, `acao`, `pontas`, `valor`,
`origem` e `duracao`. A duração é a sugestão do interpretador; o visualizador
reserva tempo adicional para posicionar a ponta e completar cada enrolamento,
usando esse mesmo tempo na reprodução e na linha do tempo.
Linha é baseada em 1; coluna é baseada em 0. A interface
apresenta a coluna ao usuário baseada em 1.

Erros de análise/execução retornam `ok: false`, `diagnosticos` e `passos: []`.
Requisições fora do esquema retornam HTTP 422. Árvores parciais não são executadas.
Objetos ANTLR permanecem no Python. Não há `eval`, execução de código Python a
partir da entrada nem chamadas a shell no processamento das requisições.

### Semântica adotada pelo Studio

- Inicialização obrigatória; escopo por bloco; atribuição procura o escopo mais
  próximo; uma declaração não pode se repetir no mesmo escopo.
- `inteiro` aceita inteiros; `real` também aceita inteiros, promovidos a reais;
  `texto` e `booleano` exigem seus respectivos valores.
- Operações aritméticas e comparações ordenadas exigem números finitos. A divisão
  produz real. Booleanos não são tratados como números. Não há concatenação
  implícita de textos.
- `e` e `ou` usam curto-circuito. `se` exige booleano. Tipos e nomes são verificados
  no caminho executado; esta implementação não faz análise estática de ramos
  não executados.
- `repetir` exige inteiro não negativo. Declarações locais são recriadas a cada
  iteração; atribuições podem atualizar variáveis externas.
- O primeiro `cruzar A B` estabelece as duas pontas disponíveis. Comandos seguintes
  usam essas pontas; passar, enrolar e apertar exigem um cruzamento anterior.
- `finalizar expressão` registra o resultado e encerra a execução da definição
  selecionada, inclusive quando aparece em um bloco aninhado.
- Limites: 32.000 caracteres por entrada, 500 movimentos, 2.000 iterações totais
  e 1–12 voltas por comando `enrolar`. Valores excessivos e profundidade excessiva
  são reportados como diagnóstico, sem publicar um plano parcial.

## Nó simples duplo

O exemplo padrão é um **Double Overhand Stopper Knot**, seguindo a sequência de
[Animated Knots](https://www.animatedknots.com/double-overhand-stopper-knot): formar
um laço, passar a extremidade duas vezes pela mesma abertura e depois apertar.
Imagens e vídeos da referência não são distribuídos nem usados na aplicação.

```amarra
no "no simples duplo" {
    cruzar parte_firme ponta_trabalho;
    passar_baixo ponta_trabalho;
    passar_baixo ponta_trabalho;
    apertar;
    finalizar "no simples duplo pronto";
}
```

O backend reconhece exatamente `cruzar → passar_baixo → passar_baixo → apertar`,
com `finalizar` opcional. As duas passagens precisam usar a mesma ponta do
cruzamento. O nome é livre; repetições e condicionais são resolvidos pelo
interpretador antes da correspondência. Apertar antes da segunda passagem,
usá-la em outra ponta ou adicionar outro movimento impede esse reconhecimento.
Isso não transforma um programa sintaticamente válido em erro: ele usa o modelo
livre e deixa de receber a identificação do nó simples duplo. O frontend também
confere a sequência no registro; reconhecer o nome escrito não é suficiente.

A definição contém uma única linha central de 17 unidades, reamostrada em 384
intervalos. A parte firme fica à esquerda e a ponta móvel à direita. O corpo tem
cor de cânhamo e a extremidade de trabalho recebe a cor da sua identificação A/B.
O cruzamento segue a ordem das pontas: inverter quem trabalha espelha toda a
geometria em profundidade, conservando a estrutura do nó.

A formação revela progressivamente uma guia curva. A ponta percorre uma trajetória
3D contínua ao redor do ramo direito do laço e atravessa seu interior em cada
meia-volta. A segunda volta conserva a primeira. As duas passagens terminam com
o laço aberto. Nos primeiros 30% do comando `apertar`, as voltas são organizadas;
os 70% seguintes acomodam o retorno pelo exterior das espiras, reduzem o laço
e orientam o barril para alinhar horizontalmente as duas extremidades. A entrada
da parte firme e a ligação com as espiras usam curvas arredondadas para respeitar
a espessura do tubo. A pose final conserva os cinco cruzamentos orientados do nó
simples duplo, verificados em uma projeção oblíqua não degenerada.
Essa verificação do diagrama é uma regressão geométrica, não um classificador
topológico para programas arbitrários.

As etapas duram 7, 8, 8 e 9 segundos, mais a duração de `finalizar`. Cada passagem
reserva os 12% finais para observar a ponta já fora do laço antes do próximo comando. Cada movimento
possui 160 intervalos temporais preparados em um Worker. A suavização quintica e a
interpolação temporal com velocidade nula nos limites permitem pausar, buscar e
reproduzir ao contrário por busca sem recalcular o programa. `finalizar` mantém a
mesma geometria. A sobra é transferida para a parte firme para conservar o
comprimento; sua extremidade livre pode se deslocar, sem representar uma fixação
rígida a um suporte.

`KnotAnimationEngine` mantém os controles comuns de posição, velocidade, pausa,
reinício e navegação. No nó simples duplo, delega o tempo e os parâmetros ao
Theatre Core; o modelo livre preserva seu relógio anterior. O loop `useFrame`
avança o driver Theatre e atualiza a malha no mesmo quadro, sem outro RAF de
reprodução no App. A interface recebe progresso a aproximadamente 15 Hz e
sincroniza imediatamente ao pausar. Ocultar a aba pausa a reprodução, evitando
saltos no retorno; deltas longos não são descartados arbitrariamente.
A malha tubular reutiliza seus buffers, curva, centros e vetores de orientação,
com 480 seções e transporte paralelo. As etiquetas A/B são elementos DOM
projetados pela câmera, sem raízes React aninhadas na cena. Geometria e textura procedural são descartadas ao desmontar a cena.
O Worker anterior é cancelado ao trocar ou editar o programa.

O fundo fica atrás de toda a trajetória para não ocultar trechos que passam em
profundidade. **Foco no nó** aproxima a câmera gradualmente; **Visão geral** mostra
a corda inteira. No nó duplo, o foco termina de enquadrar antes da primeira
passagem e permanece estável durante as duas travessias. Arrastar assume o
controle manual sem pausar a reprodução;
**Restaurar câmera** retoma o enquadramento automático.

## Integração Theatre.js

Dependências adicionadas com versão exata: **@theatre/core 0.7.2** em produção e
**@theatre/studio 0.7.2** em desenvolvimento. React 19.3.1, Three 0.180.0,
Fiber 9.8.2 e Drei 10.7.9 foram preservados. `@theatre/r3f` não foi instalado:
seu peer exige Fiber 8. O Core é conectado diretamente ao motor existente.
Não foi adicionado Rapier nem outra versão de three-mesh-bvh; o BVH 0.8.3
permanece apenas como dependência indireta do Drei.

O estado `web/studio/src/knots/doubleOverhand.theatre.json` define cinco parâmetros:
`loop`, `firstPass`, `secondPass`, `dressing` e `tightening`. Suas curvas controlam
o avanço pela trajetória aprovada, mantendo uma única linha central. As curvas
Theatre iniciais são lineares; a suavização geométrica já existe no cache e não
é aplicada novamente pelo adaptador. Os limites das etapas e suas durações são
derivados desse mesmo estado, inclusive a divisão entre acomodação e aperto.
O nome do projeto inclui um hash do estado para evitar reutilizar uma definição
antiga quando o arquivo de autoria muda durante o desenvolvimento.

Cada visualizador recebe um playhead separado. O adaptador converte tempo em
segundos para etapa/fração e distingue progresso temporal de progresso da pose.
Ele usa um `rafDriver` personalizado: pedidos de reprodução são iniciados dentro
do tick, mantendo a mesma referência temporal em reprodução real e testes.
Pausa, busca, reinício, velocidade, troca de velocidade durante a reprodução e
parada entre etapas usam a mesma sequência. Subscrições são removidas ao descartar
o controlador. Não são utilizadas APIs experimentais de escrita de keyframes.

### Editar a animação

Com a API Python iniciada, execute:

```bash
cd web/studio
npm run dev
```

Abra a URL do Vite com `?theatre=1`, por exemplo
`http://127.0.0.1:5173/?theatre=1`. O Studio só é importado dinamicamente quando
esse parâmetro está presente em desenvolvimento. Selecione o projeto **Amarra
Studio**, a sheet **Knot** e o objeto **Construction**. Os cinco parâmetros
aparecem com nomes em português. **Playback** é interno ao driver e não deve ser
editado. Os controles do Amarra continuam disponíveis; a interface do Studio pode
ser escondida com seu atalho Alt/Option + barra invertida.

Exporte o estado pelo menu do projeto no Theatre e substitua
`web/studio/src/knots/doubleOverhand.theatre.json`. Recarregue a página para preparar
e validar a definição atualizada. Cada etapa deve começar em 0, terminar em 1,
avançar continuamente sem overshoot e respeitar a ordem das etapas. Deixe tempo
positivo para finalizar. Exportações com etapas sobrepostas, valores fora do
intervalo, interpolação `hold` ou saltos são rejeitadas. Ajustes ao vivo no Studio
são uma prévia de autoria; a definição publicada é o JSON exportado e validado.
A persistência automática do Studio está desativada para não sobrepor esse arquivo
com um estado antigo do navegador. Exporte as mudanças que deseja conservar.

O Studio 0.7.2 consulta um serviço externo de atualizações sem oferecer uma opção
pública para desativá-lo. O pré-bundle de desenvolvimento do Vite substitui somente
essa URL por uma resposta local sem atualizações, evitando dependência de rede e
erros de CORS. Os pacotes instalados não são modificados por isso. O Studio e essa
adaptação não são incluídos no build de produção.

### Validar antes de reproduzir

Para o nó cadastrado, o Worker prepara os keyframes e executa `validateKnotMotion`
antes de transferir os buffers. A verificação usa a mesma Catmull–Rom e resolução
da linha central renderizada: 480 intervalos. Inspeciona os estados, todas as
amostras do cache e subdivide intervalos com movimento rápido ou pouca folga,
com profundidade máxima de três subdivisões. No perfil padrão, são cerca de
1.100 poses, em vez de verificar colisões dentro do loop de renderização.

Uma trajetória é bloqueada se houver coordenadas inválidas, número de pontos
inconsistente, cache incompleto, salto entre etapas, separação menor que
`2 × raio + 0,005`, raio local de curvatura menor que o raio da corda ou variação
de comprimento acima de 0,5%. O visualizador apresenta o diagnóstico e mantém
os controles de reprodução desabilitados. A distância exata entre segmentos usa
poda por caixas delimitadoras pré-calculadas e dispensa BVH de triângulos.
O modelo livre continua com suas restrições anteriores; esse bloqueio adicional
é específico da definição de nó cadastrada.

No ensaio local, preparar e validar o perfil padrão levou aproximadamente
2,2 segundos em Node, incluindo a preparação geométrica. Foram encontradas
separação mínima de aproximadamente 0,254, raio local mínimo acima de 0,12 e
variação máxima de comprimento na curva renderizada de aproximadamente 0,054
em 17 unidades. São medições amostradas; não constituem prova de colisão contínua.

No Chromium headless com SwiftShader, viewport 1440 × 1080 e reprodução 2×,
a versão integrada completou a sequência em aproximadamente 16,6 segundos,
com média de 18,6 FPS e P95 de 66,8 ms por quadro. A medição anterior, nas mesmas
condições gerais, ficou em 17,9 FPS e P95 de 66,7 ms. A diferença de média é
pequena e não demonstra um ganho amplo de renderização. SwiftShader usa software;
esses números não representam o desempenho na GPU física do usuário. A primeira
preparação do navegador medido levou aproximadamente 3,3 segundos. A validação
acrescenta trabalho nessa preparação, sem executar colisões em cada quadro.

## Limitações

- A animação usa guias e estados-chave cinemáticos. Não simula tensão, atrito ou
  colisões físicas contínuas.
- A separação entre segmentos é verificada em amostras da trajetória, incluindo
  os interiores dos segmentos. Isso não constitui uma prova de ausência de contato
  em todo tempo contínuo ou em toda a superfície tubular suavizada.
- O laço final conserva uma pequena folga para tornar os cruzamentos legíveis e
  respeitar o diâmetro da corda; não representa uma corda comprimida sob carga.
- Apenas a sequência acima está cadastrada como nó simples duplo. Os demais
  programas usam o modelo livre anterior de 26 unidades. Ele ilustra comandos,
  mas não garante fidelidade física ou topológica de qualquer nó, inclusive Windsor.
- A variável `comprimento` pode ser avaliada e inspecionada; ainda não controla a
  escala da corda. Suportar outros tipos de nó exige novas definições e validação.

## Verificação

Em 11/11/2026: **150 testes Python**, **47 testes TypeScript** e **11 cenários de
navegador Chromium** passaram, além do build TypeScript/Vite. Os testes originais
do compilador e seus exemplos foram preservados.

A cobertura do nó duplo verifica corda inicialmente estendida, número fixo de
amostras, continuidade, duas travessias em profundidade pela abertura antes do
aperto, organização sem tensão, cinco cruzamentos orientados na pose final,
comprimento, separação entre segmentos, busca reversa determinística, ausência de
saltos nos limites e imobilidade em `finalizar`. A auditoria numérica encontrou
uma separação mínima de aproximadamente 0,254 unidades (diâmetro: 0,24) e erro
de comprimento pequeno em relação às 17 unidades da corda. A curva suavizada
usada para renderizar o tubo também é verificada: separação acima do diâmetro e
raio local de curvatura acima do raio da corda, em 241 posições nos testes de
geometria e cerca de 1.100 poses na validação adaptativa do Worker. A variação
máxima observada na validação ficou em aproximadamente 0,054 unidades.
A compactação é medida pelo diâmetro espacial do laço, independente da rotação.
Há regressões específicas para as duas espiras, alinhamento das extremidades,
pausa após cada passagem, parâmetros reais do Theatre, relógios independentes,
quadros de durações diferentes, troca de velocidade em movimento, carregamento
assíncrono e cancelamento, validação de autoria e rejeição de caches inválidos.

No navegador foram verificados pausa, reinício, velocidades de 0,25× e 2×,
etapas anterior/próxima, parada automática entre comandos, reprodução até o fim,
câmera durante a animação, renomeação e recompilação, sequência com uma só
passagem, diagnósticos, arquivos, layout móvel e regressões do Windsor. Capturas
de cada fase e gravação da reprodução real ficam em `.studio-cache/`, ignorado
pelo Git; não substituem a geometria em tempo real da aplicação.

```bash
# Compilador e integração Python
.venv/bin/python -m unittest discover -s tests

# Geometria, motor e build
cd web/studio
npm test
npm run build

# Chromium: servidor exclusivo na porta 8010
PLAYWRIGHT_BROWSERS_PATH=../../.studio-cache/browsers npx playwright install chromium
npm run test:e2e
# Outra porta: AMARRA_TEST_PORT=8011 npm run test:e2e
```

Em ambientes restritos, HTTP local e Chromium precisam de acesso a sockets locais.
A suíte opcional do Studio é ignorada sem FastAPI/httpx, mantendo a descoberta
dos testes E3 com as dependências originais.

## Arquivos desta alteração

- Geometria e identificação: `web/studio/src/knots/doubleOverhand.ts`,
  `web/studio/src/knots/knotRegistry.ts`, `web/studio/src/geometry.ts`, `web/studio/src/types.ts`.
- Reprodução e validação: `web/studio/src/animation/KnotAnimationEngine.ts`,
  `web/studio/src/animation/RopeValidation.ts`, `web/studio/src/animation/TheatreKnotController.ts`,
  `web/studio/src/animation/theatreStudio.ts`, `web/studio/src/animation/validateKnotMotion.ts`.
- Autoria: `web/studio/src/knots/doubleOverhandTimeline.ts`,
  `web/studio/src/knots/doubleOverhand.theatre.json`.
- Renderização e integração do cache: `web/studio/src/ropeSurface.ts`,
  `web/studio/src/geometry.worker.ts`, `web/studio/src/main.tsx`, `web/studio/index.html`.
- Interface existente: `web/studio/src/App.tsx`, `web/studio/src/RopeScene.tsx`,
  `web/studio/src/style.css`.
- Integração: `src/studio_nos.py`, `src/studio_api.py`, `exemplos/no_simples_duplo.amr`.
- Verificação: `web/studio/tests/doubleOverhand.test.ts`, `web/studio/tests/engine.test.ts`,
  `web/studio/tests/run.ts`, `web/studio/e2e/studio.spec.ts`, `web/studio/playwright.config.ts`,
  `web/studio/package.json`, `web/studio/package-lock.json`, `web/studio/vite.config.ts`,
  `web/studio/tests/theatre.test.ts`, `web/studio/tests/validation.test.ts`, `tests/test_studio.py`.
- Documentação: `docs/studio.md`, `README.md`.

As gramáticas, o compilador original e `exemplos/no_reforcado.amr` não foram alterados.
Foram adicionados somente Theatre Core e Studio 0.7.2. Build, gravações e
capturas são locais e ignorados pelo Git.
