<a name="inicio"></a>

<p align="center">
  <img src="docs/assets/amarra/capa.svg" alt="Amarra — cada comando, um passo. Cada passo, um nó. Linguagem de domínio específico para descrever nós." width="100%">
</p>

<p align="center">
  <img src="docs/assets/amarra/badge-e3.svg" alt="Fase E3: análise sintática" height="30">
  <img src="docs/assets/amarra/badge-python.svg" alt="Python 3.8 ou superior" height="30">
  <img src="docs/assets/amarra/badge-antlr.svg" alt="ANTLR 4.13.2" height="30">
  <img src="docs/assets/amarra/badge-amr.svg" alt="Extensão dos programas: .amr" height="30">
</p>

<p align="center">
  <a href="#linguagem">A linguagem</a> &nbsp;·&nbsp;
  <a href="#exemplo">Exemplo</a> &nbsp;·&nbsp;
  <a href="#executar">Como executar</a> &nbsp;·&nbsp;
  <a href="docs/aula10.md">Aula 10</a> &nbsp;·&nbsp;
  <a href="docs/aula11.md">Aula 11</a> &nbsp;·&nbsp;
  <a href="docs/aula12.md">Aula 12</a> &nbsp;·&nbsp;
  <a href="docs/aula13.md">Aula 13</a> &nbsp;·&nbsp;
  <a href="docs/validacao-sintatica.md">Relatório de testes</a> &nbsp;·&nbsp;
  <a href="#estrutura">Estrutura</a> &nbsp;·&nbsp;
  <a href="#evolucao">Evolução</a>
</p>

---

<a name="linguagem"></a>

## 01 · Quando amarrar vira linguagem

**Amarra** é uma linguagem de domínio específico para descrever, passo a passo, como amarrar nós de cadarços, gravatas e nós náuticos simples. A ideia é representar cada ação com comandos em português, organizados em uma sequência de instruções.

O projeto aproxima o estudo de compiladores de uma atividade cotidiana: **transformar o gesto de amarrar em uma descrição que o computador possa analisar.**

| O domínio | A implementação | A entrega atual |
| :--- | :--- | :--- |
| Sequências de ações para montar nós. | Python e código gerado pelo ANTLR. | **E3:** análise léxica, análise sintática e árvore sintática. |

> **Escopo atual (E3)** — O projeto reconhece tokens, valida a estrutura do programa e produz uma árvore sintática concreta. A análise de tipos e nomes, a validação dos movimentos e a execução ficam para E4.

**Validação atual:** 132 testes automatizados passaram na execução de 21/10/2026.
A coleção de 72 entradas identificadas contém **20 válidas, 48 com erro sintático
e 4 com erro léxico**. A [Aula 13](docs/aula13.md) acrescenta 24 testes de
diagnósticos, recuperação e visitor aos 108 testes do
[relatório de validação de 20/10](docs/validacao-sintatica.md).

<a name="exemplo"></a>

## 02 · Um primeiro nó, em código

Um programa Amarra descreve uma sequência de ações dentro de um bloco `no`:

```amarra
// No de cadarco simples
no "cadarco simples" {
    cruzar ponta_direita ponta_esquerda;
    passar_baixo ponta_direita;
    apertar;
    finalizar "no pronto";
}
```

Neste exemplo, os nomes dos comandos expressam a sequência proposta: **cruzar, passar por baixo, apertar e finalizar**. O lexer identifica os tokens e o parser verifica sua organização em comandos e blocos.

Explore outros programas em [`exemplos/`](exemplos/) e consulte a [especificação da linguagem](docs/especificacao.md).

### O que acontece na análise léxica

| Entrada ou regra | Papel no processo |
| :--- | :--- |
| Arquivo `.amr` | Contém o programa que será lido pelo analisador. |
| `gramatica/AmarraLexer.g4` | Define as regras de reconhecimento dos tokens. |
| `gerado/AmarraLexer.py` | Implementa o lexer gerado pelo ANTLR. |
| `src/lexico.py` | Lê o programa e apresenta os tokens ou o erro léxico encontrado. |

Comentários e espaços em branco são descartados pelas regras com `-> skip`. Eles não aparecem na listagem nem na contagem final de tokens.

### O que foi acrescentado a partir da Aula 10

| Conceito da aula | Aplicação no projeto |
| :--- | :--- |
| Gramática livre de contexto | Regras de `programa`, `bloco`, `instrucao` e `expr` em `gramatica/AmarraParser.g4`. |
| Recursão e aninhamento | Blocos de `repetir` e `se` podem conter outros blocos. |
| Árvore sintática | `src/sintatico.py` mostra regras nos nós internos e tokens nas folhas. |
| Precedência e associatividade | Parênteses, menos unário, aritmética, comparações e operadores `e` e `ou`. |
| Consumo de toda a entrada | A regra `programa` exige `EOF`, rejeitando tokens sobrando no final. |

A [explicação da Aula 10 aplicada à Amarra](docs/aula10.md) inclui o vocabulário
formal, uma derivação e um diagrama de árvore. O programa
[`exemplos/expressoes.amr`](exemplos/expressoes.amr) demonstra as novas construções.

### O que foi acrescentado a partir da Aula 11

| Conceito da aula | Aplicação no projeto |
| :--- | :--- |
| Regras, chamadas e pilha | `--rastrear` mostra os contextos do ANTLR ao entrar e sair de regras e consumir tokens. |
| Depuração por regra | `--regra expr`, `--regra bloco` e as demais regras permitem analisar fragmentos isolados. |
| Elementos opcionais | A condicional aceita um bloco `senao` opcional com `(SENAO bloco)?`. |
| Consumo completo | A entrada deve terminar em `EOF`, inclusive ao testar uma regra isolada. |

Veja a [Aula 11 aplicada à Amarra](docs/aula11.md) para entender a pilha, os padrões
de repetição, a recursão à esquerda e as mensagens de erro do parser.

### Como a Aula 12 se relaciona com o projeto

A escolha entre instruções, a precedência das expressões e o `senao` opcional
já estavam implementados. A [Aula 12 aplicada à Amarra](docs/aula12.md) explica
esses comportamentos usando **FIRST** (o que pode começar uma regra) e **FOLLOW**
(o que pode aparecer depois dela), com exemplos da gramática e referências aos
testes existentes.

### O que foi acrescentado a partir da Aula 13

| Conceito da aula | Aplicação no projeto |
| :--- | :--- |
| Mensagens úteis | Diagnósticos em português com linha, coluna, símbolos esperados e entrada encontrada. |
| Recuperação em modo pânico | `--recuperar` procura mais erros, descartando instruções inválidas até `;` ou `}`. |
| Preparação do visitor | `gerar.py` passa `-visitor` ao ANTLR e gera `AmarraParserVisitor.py`. |

Veja a [Aula 13 aplicada à Amarra](docs/aula13.md) para reproduzir o exemplo com
vários erros e entender a diferença entre árvore concreta, AST, listener e visitor.
A construção da AST completa é apresentada no material como assunto da Aula 14.

<a name="executar"></a>

## 03 · Do repositório ao primeiro resultado

### Antes de começar

| Requisito | Como conferir |
| :--- | :--- |
| **Python 3.8 ou superior** | Execute `py --version` no Windows ou `python3 --version` no Linux/macOS. [Baixar Python](https://www.python.org/downloads/). |
| **pip** | Normalmente acompanha a instalação do Python. |
| **venv** | Usado para criar o ambiente do projeto. Em algumas distribuições Linux, é necessário instalar o componente `python3-venv`. |
| **Java 11 ou superior** | Usado na geração dos analisadores. Confira com `java -version`; se estiver ausente, a ferramenta oferece instalar uma JRE. |
| **Conexão com a internet** | Necessária para instalar as dependências e baixar o ANTLR; também para instalar uma JRE, caso ela não esteja disponível. |

Descompacte `amarra-lang.zip` ou clone o repositório. Depois, abra o terminal na pasta do projeto:

```bash
cd amarra-lang
```

**Execute todos os comandos a partir da raiz do repositório**, onde estão `gerar.py` e `requirements.txt`.

### Escolha seu sistema operacional

<details open>
<summary><strong>Windows · PowerShell</strong></summary>

**1. Crie o ambiente virtual e instale as dependências.**

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

**2. Gere os analisadores léxico e sintático.**

```powershell
.\.venv\Scripts\python.exe gerar.py
```

**3. Confira os tokens do programa de exemplo.**

```powershell
.\.venv\Scripts\python.exe src/lexico.py exemplos/no_simples.amr
```

**4. Valide a sintaxe e veja a árvore.**

```powershell
.\.venv\Scripts\python.exe src/sintatico.py exemplos/no_simples.amr
```

</details>

<details>
<summary><strong>Linux ou macOS · Terminal</strong></summary>

**1. Crie o ambiente virtual e instale as dependências.**

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

**2. Gere os analisadores léxico e sintático.**

```bash
.venv/bin/python gerar.py
```

**3. Confira os tokens do programa de exemplo.**

```bash
.venv/bin/python src/lexico.py exemplos/no_simples.amr
```

**4. Valide a sintaxe e veja a árvore.**

```bash
.venv/bin/python src/sintatico.py exemplos/no_simples.amr
```

</details>

Não é necessário ativar o ambiente: os comandos usam diretamente o Python de `.venv/`. Se a pasta já existir, execute apenas a instalação das dependências e as etapas seguintes.

Execute um comando por vez. Se `py` não existir no Windows e `python --version`
mostrar Python 3.8 ou superior, crie o ambiente com `python -m venv .venv`.
Ao atualizar o projeto da E2 para E3, execute `gerar.py` novamente para criar o parser.

Na primeira geração, a ferramenta baixa o ANTLR. Se não encontrar Java, oferece instalar uma JRE; nesse caso, responda `y`. O processo pode levar alguns minutos. Não é necessário clonar o ANTLR à parte.

<details>
<summary><strong>Entenda as dependências e a geração dos analisadores</strong></summary>

O arquivo `requirements.txt` fixa as versões das ferramentas utilizadas:

| Pacote | Função |
| :--- | :--- |
| `antlr4-tools` | Disponibiliza `antlr4`, para gerar código a partir da gramática, e `antlr4-parse`, para testar a gramática diretamente. |
| `antlr4-python3-runtime` | Fornece a biblioteca usada para executar o lexer e o parser gerados. |

O script `gerar.py` lê `gramatica/AmarraLexer.g4` e `gramatica/AmarraParser.g4`,
criando `gerado/AmarraLexer.py`, `gerado/AmarraParser.py` e
`gerado/AmarraParserVisitor.py`, além dos arquivos de apoio `.tokens` e `.interp`.
O parser reutiliza os tokens do lexer com a opção
`tokenVocab = AmarraLexer`.

O visitor é gerado pela opção `-visitor` e fornece métodos como `visitPrograma`,
`visitDeclaracao` e `visitAditiva`. Ele é uma classe base para as próximas etapas;
as ações da linguagem ainda precisam ser implementadas. A geração pode terminar
sem imprimir mensagem. Não edite os arquivos de `gerado/`, pois serão recriados.

O projeto utiliza **ANTLR 4.13.2**, conforme registrado em `requirements.txt`. O script seleciona a versão do gerador a partir do runtime instalado para manter ambos compatíveis.

A opção [`-Xexact-output-dir`](https://github.com/antlr/antlr4/blob/master/doc/tool-options.md#-xexact-output-dir) mantém os arquivos diretamente em `gerado/`, no caminho esperado pelo analisador. Essa pasta é gerada automaticamente e não deve ser versionada.

Para quem usa Bash, o atalho `gerar.sh` continua disponível:

```bash
source .venv/bin/activate
bash gerar.sh
```

Se `gerado/AmarraLexer.py` ou `gerado/AmarraParser.py` não aparecerem, confira a
saída do terminal e procure a primeira mensagem de erro da geração. A geração
bem-sucedida pode terminar sem imprimir uma mensagem.

</details>

<a name="resultados"></a>

## 04 · Veja o que o analisador reconhece

### Tokens de um programa válido (E2)

Para o exemplo de nó simples, a saída esperada contém o tipo de token, o texto reconhecido e a linha de origem. Ao final, aparece a contagem total:

```text
NO 'no' linha 2
TEXTO '"cadarco simples"' linha 2
ABRE_CHAVE '{' linha 2
CRUZAR 'cruzar' linha 3
IDENT 'ponta_direita' linha 3
IDENT 'ponta_esquerda' linha 3
PONTOVIRG ';' linha 3
PASSAR_BAIXO 'passar_baixo' linha 4
IDENT 'ponta_direita' linha 4
PONTOVIRG ';' linha 4
APERTAR 'apertar' linha 5
PONTOVIRG ';' linha 5
FINALIZAR 'finalizar' linha 6
TEXTO '"no pronto"' linha 6
PONTOVIRG ';' linha 6
FECHA_CHAVE '}' linha 7
16 tokens reconhecidos
```

### Árvore sintática de um programa válido (E3)

O comando `src/sintatico.py` apresenta `Analise sintatica concluida sem erros.`
e a árvore indentada. Trecho da saída de `exemplos/no_simples.amr`:

```text
Analise sintatica concluida sem erros.
Arvore sintatica:
programa
  definicaoNo
    NO 'no'
    TEXTO '"cadarco simples"'
    bloco
      ABRE_CHAVE '{'
      instrucao
        comando
          CRUZAR 'cruzar'
          IDENT 'ponta_direita'
          IDENT 'ponta_esquerda'
        PONTOVIRG ';'
...
```

Nomes como `programa`, `bloco` e `comando` são regras do parser; `NO`, `TEXTO`
e `IDENT` são tipos de tokens nas folhas. Essa árvore concreta preserva a
pontuação do programa. Ela ainda não é uma AST simplificada nem executa os comandos.

Para ver expressões, blocos aninhados e a representação parentizada do ANTLR:

**Windows — PowerShell**

```powershell
.\.venv\Scripts\python.exe src/sintatico.py exemplos/expressoes.amr --formato lisp
```

**Linux ou macOS**

```bash
.venv/bin/python src/sintatico.py exemplos/expressoes.amr --formato lisp
```

Nas próximas execuções, basta chamar o analisador com o caminho do arquivo `.amr`
salvo em UTF-8. Repita `gerar.py` sempre que alterar um dos arquivos `.g4`.

### Pilha e depuração de regras (Aula 11)

Primeiro, execute `gerar.py` para atualizar os analisadores. Depois, experimente
uma expressão isolada ou um programa completo com `senao`:

**Windows — PowerShell**

```powershell
.\.venv\Scripts\python.exe src/sintatico.py exemplos/fragmentos/expressao.amr --regra expr --rastrear --formato lisp
.\.venv\Scripts\python.exe src/sintatico.py exemplos/condicional_senao.amr --rastrear
```

**Linux ou macOS**

```bash
.venv/bin/python src/sintatico.py exemplos/fragmentos/expressao.amr --regra expr --rastrear --formato lisp
.venv/bin/python src/sintatico.py exemplos/condicional_senao.amr --rastrear
```

`--rastrear` mostra eventos `ENTRAR`, `CONSUMIR` e `SAIR`, com o token e os
contextos ativos da base para o topo. O rastro acompanha a análise e é enviado
para `stderr`; o resultado e a árvore continuam em `stdout`. Em um terminal,
as duas saídas são visíveis.

`--regra` usa `programa` por padrão. Os arquivos em `exemplos/fragmentos/` são
partes de um programa: use `--regra expr` para `expressao.amr` e `--regra bloco`
para `bloco.amr`. O analisador rejeita tokens restantes depois do fragmento.
Consulte todas as regras disponíveis com `src/sintatico.py --help`, usando o
Python do ambiente como nos comandos acima.

A condicional agora permite escrever:

```amarra
se voltas > 1 {
    enrolar ponta_esquerda 1;
} senao {
    apertar;
}
```

As chaves são obrigatórias e definem a qual `se` cada `senao` pertence.
O parser reconhece os dois blocos; a escolha de qual executar pertence à E4.

### Um programa com erro léxico

Execute o exemplo que contém um caractere inválido:

**Windows — PowerShell**

```powershell
.\.venv\Scripts\python.exe src/lexico.py exemplos/invalidos/caractere_invalido.amr
```

**Linux ou macOS**

```bash
.venv/bin/python src/lexico.py exemplos/invalidos/caractere_invalido.amr
```

Em vez da lista de tokens, deve aparecer uma mensagem indicando a linha e a coluna do problema, como:

```text
Erro lexico na linha 4, coluna 12: esperava um token valido; encontrou '@'
```

### Um programa com erro sintático

Os exemplos em `exemplos/invalidos/sintaxe/` contêm tokens válidos, mas estruturas
incorretas: falta de `;`, chave ou parêntese sem fechamento, expressão incompleta
ou `senao` sem um `se` correspondente.

**Windows — PowerShell**

```powershell
.\.venv\Scripts\python.exe src/sintatico.py exemplos/invalidos/sintaxe/sem_ponto_virgula.amr
```

**Linux ou macOS**

```bash
.venv/bin/python src/sintatico.py exemplos/invalidos/sintaxe/sem_ponto_virgula.amr
```

Saída esperada:

```text
Erro sintatico na linha 4, coluna 4: esperava ';'; encontrou 'finalizar'
```

As linhas começam em `1` e as colunas em `0`. O analisador sintático também
detecta erros léxicos. Em caso de erro, encerra com código `1` e não mostra uma
árvore de sucesso; em caso de sintaxe válida, encerra com código `0`.

### Buscar vários erros no mesmo arquivo (Aula 13)

Por padrão, o analisador para no primeiro erro. Para tentar continuar após uma
instrução inválida, use `--recuperar`:

**Windows — PowerShell**

```powershell
.\.venv\Scripts\python.exe src/sintatico.py exemplos/invalidos/sintaxe/multiplos_erros.amr --recuperar
```

**Linux ou macOS**

```bash
.venv/bin/python src/sintatico.py exemplos/invalidos/sintaxe/multiplos_erros.amr --recuperar
```

Esse exemplo produz três diagnósticos, nas linhas **3, 5 e 7**, e termina com
código `1`. A expressão defeituosa da linha 3 produz uma mensagem; o parser
descarta o restante da instrução até o `;` e continua. Não há árvore de sucesso
quando existem erros, mesmo que as instruções seguintes sejam reconhecidas.

A recuperação usa os tokens `;` e `}` e respeita os blocos aninhados. Erros
estruturais podem impedir a continuação. Havendo erro léxico, o parser não é
iniciado; com `--recuperar`, são apresentados os diagnósticos coletados pelo lexer.

<details>
<summary><strong>Opcional · Execute todos os exemplos de uma vez</strong></summary>

Os programas em `exemplos/invalidos/` contêm erros propositais para demonstrar os diagnósticos do analisador.

**Windows — PowerShell**

```powershell
Get-ChildItem exemplos\*.amr | ForEach-Object {
    Write-Host "--- $_ ---"
    .\.venv\Scripts\python.exe src/sintatico.py $_.FullName --formato lisp
}

Get-ChildItem exemplos\invalidos -Filter *.amr -Recurse | ForEach-Object {
    Write-Host "--- $_ ---"
    .\.venv\Scripts\python.exe src/sintatico.py $_.FullName --formato lisp
}
```

**Linux ou macOS**

```bash
for f in exemplos/*.amr; do
    echo "--- $f ---"
    .venv/bin/python src/sintatico.py "$f" --formato lisp
done

for f in exemplos/invalidos/*.amr exemplos/invalidos/sintaxe/*.amr; do
    echo "--- $f ---"
    .venv/bin/python src/sintatico.py "$f" --formato lisp
done
```

</details>

### Verificar os testes automatizados

Depois de gerar os analisadores, execute na raiz do projeto:

**Windows — PowerShell**

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

**Linux ou macOS**

```bash
.venv/bin/python -m unittest discover -s tests -v
```

Os testes cobrem exemplos válidos e inválidos, blocos aninhados, precedência,
associatividade, consumo até `EOF`, saída no terminal e os tokens dos exemplos
originais da E2. Também verificam `senao`, regras isoladas, consumo de tokens no
rastro e preservação da árvore ao observar a pilha. A saída deve terminar com `OK`.

São **132 testes descobertos pelo `unittest`**: 36 das Aulas 10 e 11, 72 casos
de [`tests/casos_sintaticos.json`](tests/casos_sintaticos.json) e 24 da Aula 13. Cada
entrada dessa coleção vira um teste independente, com ID e descrição na saída.
Um teste de entrada inválida passa quando o analisador rejeita o código na fase
esperada; erro léxico não substitui erro sintático.

Para executar somente a coleção adicional:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_casos_sintaticos.py -v
```

No Linux/macOS, substitua o executável por `.venv/bin/python`. Para investigar um
único caso, acrescente `-k S16`, por exemplo. O [relatório de validação](docs/validacao-sintatica.md)
explica os IDs, os critérios de aprovação e os limites da análise.

<a name="estrutura"></a>

## 05 · Cada arquivo tem seu papel

| Caminho | Responsabilidade |
| :--- | :--- |
| [`README.md`](README.md) | Apresentação do projeto e guia de execução. |
| `.gitignore` | Exclui `gerado/`, `.venv/` e arquivos temporários do versionamento. |
| [`requirements.txt`](requirements.txt) | Fixa as versões das dependências Python. |
| [`gerar.py`](gerar.py) | Gera o lexer e o parser no Windows, Linux e macOS. |
| [`gerar.sh`](gerar.sh) | Oferece um atalho de geração para Bash. |
| [`gramatica/AmarraLexer.g4`](gramatica/AmarraLexer.g4) | Define as regras do analisador léxico. |
| [`gramatica/AmarraParser.g4`](gramatica/AmarraParser.g4) | Define as regras sintáticas, o aninhamento e a precedência. |
| `gerado/` | Recebe os arquivos gerados pelo ANTLR; não editar nem versionar. |
| [`src/lexico.py`](src/lexico.py) | Lê um arquivo `.amr` e apresenta os tokens reconhecidos. |
| [`src/sintatico.py`](src/sintatico.py) | Valida a sintaxe e apresenta a árvore ou o primeiro erro. |
| [`src/diagnosticos.py`](src/diagnosticos.py) | Formata erros com posição, símbolos esperados e entrada encontrada. |
| [`src/recuperacao.py`](src/recuperacao.py) | Implementa a recuperação opcional em modo pânico sobre o parser gerado. |
| [`src/rastreamento.py`](src/rastreamento.py) | Observa os contextos do parser em entradas, saídas e consumo de tokens. |
| [`exemplos/no_simples.amr`](exemplos/no_simples.amr) | Demonstra um programa válido com um nó simples. |
| [`exemplos/no_reforcado.amr`](exemplos/no_reforcado.amr) | Demonstra um programa válido com `repetir` e `se`. |
| [`exemplos/no_windsor.amr`](exemplos/no_windsor.amr) | Demonstra um programa válido que usa o tipo real. |
| [`exemplos/expressoes.amr`](exemplos/expressoes.amr) | Demonstra precedência, parênteses, lógica e blocos aninhados. |
| [`exemplos/condicional_senao.amr`](exemplos/condicional_senao.amr) | Demonstra condicionais com `senao` e aninhamento. |
| [`exemplos/fragmentos/`](exemplos/fragmentos/) | Contém expressão e bloco isolados para testar com `--regra`. |
| [`exemplos/invalidos/`](exemplos/invalidos/) | Reúne programas com erros propositais. |
| [`exemplos/invalidos/sintaxe/`](exemplos/invalidos/sintaxe/) | Demonstra erros de estrutura com tokens válidos. |
| [`tests/test_sintatico.py`](tests/test_sintatico.py) | Verifica árvores, precedência, diagnósticos e execução no terminal. |
| [`tests/test_condicionais_regras_rastreamento.py`](tests/test_condicionais_regras_rastreamento.py) | Verifica `senao`, regras isoladas e o rastreamento do parser. |
| [`tests/test_diagnosticos_recuperacao_visitor.py`](tests/test_diagnosticos_recuperacao_visitor.py) | Verifica diagnósticos, recuperação, terminal e visitor. |
| [`tests/casos_sintaticos.json`](tests/casos_sintaticos.json) | Reúne 72 entradas com ID, descrição, regra inicial e resultado esperado. |
| [`tests/test_casos_sintaticos.py`](tests/test_casos_sintaticos.py) | Executa cada caso da coleção como um teste independente. |
| [`docs/validacao-sintatica.md`](docs/validacao-sintatica.md) | Registra as alterações, os resultados e a matriz de validação da E3. |
| [`docs/especificacao.md`](docs/especificacao.md) | Documenta a especificação completa da linguagem. |
| [`docs/aula10.md`](docs/aula10.md) | Relaciona os conceitos da aula com a implementação da Amarra. |
| [`docs/aula11.md`](docs/aula11.md) | Explica a pilha do parser, os padrões de regras e a depuração. |
| [`docs/aula12.md`](docs/aula12.md) | Relaciona FIRST, FOLLOW, precedência e alternativas opcionais com o parser existente. |
| [`docs/aula13.md`](docs/aula13.md) | Explica os diagnósticos, o modo pânico e a preparação para AST. |
| [`docs/assets/amarra/`](docs/assets/amarra/) | Guarda a capa, os selos e os demais elementos visuais deste README. |
| [`DIARIO.md`](DIARIO.md) | Registra cada sessão de trabalho do grupo. |

<a name="problemas"></a>

## 06 · Se algum nó aparecer no caminho

<details>
<summary><strong>Consulte os problemas comuns e suas soluções</strong></summary>

| Sintoma | Causa provável | O que fazer |
| :--- | :--- | :--- |
| `python` não é reconhecido ou abre a Microsoft Store | O comando aponta para um alias do Windows. | Crie o ambiente com `py -m venv .venv` e use `.\.venv\Scripts\python.exe` nos demais comandos. |
| `./gerar.sh` não funciona no PowerShell | O script foi feito para Bash. | Use `.\.venv\Scripts\python.exe gerar.py`. |
| `Dependencias ausentes` ou `Biblioteca antlr4 ausente` | Os pacotes não foram instalados no Python em uso. | Execute `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`. |
| A instalação fica parada na etapa do Java | A rede está lenta ou bloqueia o download. | Confirme a resposta ao pedido de instalação e tente novamente com uma conexão que permita o download. |
| `Lexer nao gerado` | A geração não foi concluída. | Execute `.\.venv\Scripts\python.exe gerar.py` e confira a primeira mensagem de erro. |
| `Analisadores nao gerados` | O parser ainda não foi gerado, por exemplo após atualizar da E2. | Execute `.\.venv\Scripts\python.exe gerar.py` novamente. |
| `Erro sintatico` | Os tokens não seguem uma regra da gramática. | Confira a linha e a coluna indicadas, os argumentos dos comandos, os `;` e o fechamento de chaves e parênteses. |
| `esperava fim da entrada (EOF)` ao testar um fragmento | Sobraram tokens depois da regra selecionada. | Confira `--regra`: `expr` e `comando` não incluem `;`, enquanto `instrucao` inclui o terminador dos comandos. |
| `AmarraParserVisitor` não foi encontrado | Os arquivos foram gerados antes da opção `-visitor` ser incorporada ao script. | Execute `gerar.py` novamente com o Python de `.venv`. |
| `senao` é rejeitado após atualizar o projeto | O lexer ou o parser gerado ainda corresponde à versão anterior. | Execute `gerar.py` novamente e confira se o `senao` acompanha um bloco de `se`. |
| `Nao foi possivel abrir` | O arquivo não existe no caminho informado ou não pode ser lido. | Confira o caminho e execute a partir da raiz do projeto. |
| Tokens aparecem com nome errado ou fora de ordem | A gramática foi alterada depois da última geração. | Execute `gerar.py` novamente para atualizar `gerado/`. |

Os comandos da tabela são para PowerShell. No Linux/macOS, substitua `.\.venv\Scripts\python.exe` por `.venv/bin/python`.

</details>

<a name="evolucao"></a>

## 07 · O próximo passo da Amarra

| Etapa | Foco | Situação |
| :---: | :--- | :--- |
| **E2** | Especificação da linguagem e analisador léxico. | Implementada; o comando `src/lexico.py` continua disponível. |
| **E3** | Analisador sintático, árvore, diagnósticos e depuração. | **Fase atual: conceitos das Aulas 10, 11, 12 e 13 aplicados e documentados.** |
| **E4** | Análise semântica e execução. | Fase futura. |

A entrega E2 corresponde a **1,5 ponto na Avaliação de Grau 1**. A evolução do trabalho do grupo está registrada no [diário do projeto](DIARIO.md).

## 08 · Integrantes

- Lucas da Silva Nascimento
- Magno Vinicius Coelho Lima
- Victor da Mata Abreu

---

<p align="center">
  <img src="docs/assets/amarra/rodape.svg" alt="Amarra — conectando ações, construindo uma linguagem." width="100%">
</p>

<p align="center">
  <a href="docs/especificacao.md">Especificação</a> &nbsp;·&nbsp;
  <a href="DIARIO.md">Diário do projeto</a> &nbsp;·&nbsp;
  <a href="#inicio">Voltar ao início ↑</a>
</p>
