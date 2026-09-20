<a name="inicio"></a>

<p align="center">
  <img src="docs/assets/amarra/capa.png" alt="Amarra — cada comando, um passo. Cada passo, um nó. Linguagem de domínio específico para descrever nós." width="100%">
</p>

<p align="center">
  <img src="docs/assets/amarra/badge-e2.svg" alt="Fase E2: análise léxica" height="30">
  <img src="docs/assets/amarra/badge-python.svg" alt="Python 3.8 ou superior" height="30">
  <img src="docs/assets/amarra/badge-antlr.svg" alt="ANTLR 4.13.2" height="30">
  <img src="docs/assets/amarra/badge-amr.svg" alt="Extensão dos programas: .amr" height="30">
</p>

<p align="center">
  <a href="#linguagem">A linguagem</a> &nbsp;·&nbsp;
  <a href="#exemplo">Exemplo</a> &nbsp;·&nbsp;
  <a href="#executar">Como executar</a> &nbsp;·&nbsp;
  <a href="#estrutura">Estrutura</a> &nbsp;·&nbsp;
  <a href="#evolucao">Evolução</a>
</p>

<a name="linguagem"></a>

01 · Quando amarrar vira linguagem

Amarra é uma linguagem de domínio específico para descrever, passo a passo, como amarrar nós de cadarços, gravatas e nós náuticos simples. A ideia é representar cada ação com comandos em português, organizados em uma sequência de instruções.

O projeto aproxima o estudo de compiladores de uma atividade cotidiana: transformar o gesto de amarrar em uma descrição que o computador possa analisar.

O domínio

A implementação

A entrega atual

Sequências de ações para montar nós.

Python e código gerado pelo ANTLR.

E2: especificação da linguagem e analisador léxico.

Escopo da fase E2 — O analisador reconhece tokens e aponta erros léxicos. A validação sintática está prevista para E3; a análise semântica e a execução, para E4.

<a name="exemplo"></a>

02 · Um primeiro nó, em código

Um programa Amarra descreve uma sequência de ações dentro de um bloco no:

// No de cadarco simples
no "cadarco simples" {
    cruzar ponta_direita ponta_esquerda;
    passar_baixo ponta_direita;
    apertar;
    finalizar "no pronto";
}

Neste exemplo, os nomes dos comandos expressam a sequência proposta: cruzar, passar por baixo, apertar e finalizar. Na fase atual, o analisador percorre esse texto e identifica seus tokens.

Explore outros programas em exemplos/ e consulte a especificação da linguagem.

O que acontece na análise léxica

Entrada ou regra

Papel no processo

Arquivo .amr

Contém o programa que será lido pelo analisador.

gramatica/AmarraLexer.g4

Define as regras de reconhecimento dos tokens.

gerado/AmarraLexer.py

Implementa o lexer gerado pelo ANTLR.

src/lexico.py

Lê o programa e apresenta os tokens ou o erro léxico encontrado.

Comentários e espaços em branco são descartados pelas regras com -> skip. Eles não aparecem na listagem nem na contagem final de tokens.

<a name="executar"></a>

03 · Do repositório ao primeiro resultado

Antes de começar

Requisito

Como conferir

Python 3.8 ou superior

Execute py --version no Windows ou python3 --version no Linux/macOS. Baixar Python.

pip

Normalmente acompanha a instalação do Python.

Conexão com a internet

Necessária para instalar as dependências e baixar o ANTLR; também para instalar uma JRE, caso ela não esteja disponível.

Descompacte amarra-lang.zip ou clone o repositório. Depois, abra o terminal na pasta do projeto:

cd amarra-lang

Execute todos os comandos a partir da raiz do repositório, onde estão gerar.py e requirements.txt.

Escolha seu sistema operacional

<details open>
<summary><strong>Windows · PowerShell</strong></summary>

1. Crie o ambiente virtual e instale as dependências.

py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

2. Gere o analisador léxico.

.\.venv\Scripts\python.exe gerar.py

3. Analise o programa de exemplo.

.\.venv\Scripts\python.exe src/lexico.py exemplos/no_simples.amr

</details>

<details>
<summary><strong>Linux ou macOS · Terminal</strong></summary>

1. Crie o ambiente virtual e instale as dependências.

python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt

2. Gere o analisador léxico.

.venv/bin/python gerar.py

3. Analise o programa de exemplo.

.venv/bin/python src/lexico.py exemplos/no_simples.amr

</details>

Não é necessário ativar o ambiente: os comandos usam diretamente o Python de .venv/. Se a pasta já existir, execute apenas a instalação das dependências e as etapas seguintes.

Na primeira geração, a ferramenta baixa o ANTLR. Se não encontrar Java, oferece instalar uma JRE; nesse caso, responda y. O processo pode levar alguns minutos. Não é necessário clonar o ANTLR à parte.

<details>
<summary><strong>Entenda as dependências e a geração do lexer</strong></summary>

O arquivo requirements.txt fixa as versões das ferramentas utilizadas:

Pacote

Função

antlr4-tools

Disponibiliza antlr4, para gerar código a partir da gramática, e antlr4-parse, para testar a gramática diretamente.

antlr4-python3-runtime

Fornece a biblioteca usada para executar o lexer gerado.

O script gerar.py lê gramatica/AmarraLexer.g4 e cria gerado/AmarraLexer.py. A gramática é exclusivamente léxica, correspondente à fase E2.

O projeto utiliza ANTLR 4.13.2, conforme registrado em requirements.txt. O script seleciona a versão do gerador a partir do runtime instalado para manter ambos compatíveis.

A opção -Xexact-output-dir mantém os arquivos diretamente em gerado/, no caminho esperado pelo analisador. Essa pasta é gerada automaticamente e não deve ser versionada.

Para quem usa Bash, o atalho gerar.sh continua disponível:

source .venv/bin/activate
bash gerar.sh

Se gerado/ não aparecer, confira a saída do terminal e procure a primeira mensagem de erro da geração.

</details>

<a name="resultados"></a>

04 · Veja o que o analisador reconhece

Um programa válido

Para o exemplo de nó simples, a saída esperada contém o tipo de token, o texto reconhecido e a linha de origem. Ao final, aparece a contagem total:

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

Um programa com erro léxico

Execute o exemplo que contém um caractere inválido:

Windows — PowerShell

.\.venv\Scripts\python.exe src/lexico.py exemplos/invalidos/caractere_invalido.amr

Linux ou macOS

.venv/bin/python src/lexico.py exemplos/invalidos/caractere_invalido.amr

Em vez da lista de tokens, deve aparecer uma mensagem indicando a linha e a coluna do problema, como:

Erro lexico na linha 4, coluna 12: token recognition error at: '@'

<details>
<summary><strong>Opcional · Execute todos os exemplos de uma vez</strong></summary>

Os programas em exemplos/invalidos/ contêm erros propositais para demonstrar os diagnósticos do analisador.

Windows — PowerShell

Get-ChildItem exemplos\*.amr | ForEach-Object {
    Write-Host "--- $_ ---"
    .\.venv\Scripts\python.exe src/lexico.py $_.FullName
}

Get-ChildItem exemplos\invalidos\*.amr | ForEach-Object {
    Write-Host "--- $_ ---"
    .\.venv\Scripts\python.exe src/lexico.py $_.FullName
}

Linux ou macOS

for f in exemplos/*.amr; do
    echo "--- $f ---"
    .venv/bin/python src/lexico.py "$f"
done

for f in exemplos/invalidos/*.amr; do
    echo "--- $f ---"
    .venv/bin/python src/lexico.py "$f"
done

</details>

<a name="estrutura"></a>

05 · Cada arquivo tem seu papel

Caminho

Responsabilidade

README.md

Apresentação do projeto e guia de execução.

.gitignore

Exclui gerado/, .venv/ e arquivos temporários do versionamento.

requirements.txt

Fixa as versões das dependências Python.

gerar.py

Gera o lexer no Windows, Linux e macOS.

gerar.sh

Oferece um atalho de geração para Bash.

gramatica/AmarraLexer.g4

Define as regras do analisador léxico.

gerado/

Recebe os arquivos gerados pelo ANTLR; não editar nem versionar.

src/lexico.py

Lê um arquivo .amr e apresenta os tokens reconhecidos.

exemplos/no_simples.amr

Demonstra um programa válido com um nó simples.

exemplos/no_reforcado.amr

Demonstra um programa válido com repetir e se.

exemplos/no_windsor.amr

Demonstra um programa válido que usa o tipo real.

exemplos/invalidos/

Reúne programas com erros propositais.

docs/especificacao.md

Documenta a especificação completa da linguagem.

docs/assets/amarra/

Guarda a capa, os selos e os demais elementos visuais deste README.

DIARIO.md

Registra cada sessão de trabalho do grupo.

<a name="problemas"></a>

06 · Se algum nó aparecer no caminho

<details>
<summary><strong>Consulte os problemas comuns e suas soluções</strong></summary>

Sintoma

Causa provável

O que fazer

python não é reconhecido ou abre a Microsoft Store

O comando aponta para um alias do Windows.

Crie o ambiente com py -m venv .venv e use .\.venv\Scripts\python.exe nos demais comandos.

./gerar.sh não funciona no PowerShell

O script foi feito para Bash.

Use .\.venv\Scripts\python.exe gerar.py.

Dependencias ausentes ou Biblioteca antlr4 ausente

Os pacotes não foram instalados no Python em uso.

Execute .\.venv\Scripts\python.exe -m pip install -r requirements.txt.

A instalação fica parada na etapa do Java

A rede está lenta ou bloqueia o download.

Confirme a resposta ao pedido de instalação e tente novamente com uma conexão que permita o download.

Lexer nao gerado

A geração não foi concluída.

Execute .\.venv\Scripts\python.exe gerar.py e confira a primeira mensagem de erro.

Nao foi possivel abrir

O arquivo não existe no caminho informado ou não pode ser lido.

Confira o caminho e execute a partir da raiz do projeto.

Tokens aparecem com nome errado ou fora de ordem

A gramática foi alterada depois da última geração.

Execute gerar.py novamente para atualizar gerado/.

Os comandos da tabela são para PowerShell. No Linux/macOS, substitua .\.venv\Scripts\python.exe por .venv/bin/python.

</details>

<a name="evolucao"></a>

07 · O próximo passo da Amarra

Etapa

Foco

Situação

E2

Especificação da linguagem e analisador léxico.

Fase atual deste repositório.

E3

Analisador sintático e árvore sintática.

Próxima fase.

E4

Análise semântica e execução.

Fase futura.

A entrega E2 corresponde a 1,5 ponto na Avaliação de Grau 1. A evolução do trabalho do grupo está registrada no diário do projeto.

08 · Alunos

Lucas da Silva Nascimento

Magno Vinicius Coelho Lima

Victor da Mata Abreu

<p align="center">
  <img src="docs/assets/amarra/rodape.svg" alt="Amarra — conectando ações, construindo uma linguagem." width="100%">
</p>

<p align="center">
  <a href="docs/especificacao.md">Especificação</a> &nbsp;·&nbsp;
  <a href="DIARIO.md">Diário do projeto</a> &nbsp;·&nbsp;
  <a href="#inicio">Voltar ao início ↑</a>
</p>