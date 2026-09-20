# Amarra

Amarra é uma linguagem para descrever, passo a passo, como amarrar nós (cadarços,
gravatas e nós náuticos simples). Um programa em Amarra é uma sequência de comandos
que, ao ser executada, produz o roteiro de montagem do nó e aponta erros quando a
sequência não segue a sintaxe da linguagem.

Este repositório contém a fase **E2** do projeto: a especificação da linguagem e o
analisador léxico (a parte do compilador que reconhece os tokens do texto).

## Exemplo de programa

```amarra
// No de cadarco simples
no "cadarço simples" {
    cruzar ponta_direita ponta_esquerda;
    passar_baixo ponta_direita;
    apertar;
    finalizar "nó pronto";
}
```

Mais exemplos estão em `exemplos/`.

## O que você precisa ter instalado

- **Python 3.8 ou mais novo.** Confira rodando `python3 --version` (ou `py
  --version` no Windows). Se não tiver, baixe em https://www.python.org/downloads/.
- **pip**, o instalador de pacotes do Python (normalmente já vem junto com o
  Python).
- **Conexão com a internet** na primeira instalação: o ANTLR baixa e instala o
  Java automaticamente se ele não estiver presente.

Não é preciso instalar Java manualmente nem clonar o ANTLR à parte — os dois
passos abaixo cuidam disso.

## Passo a passo para rodar o projeto do zero

### 1. Baixar o projeto

Descompacte `amarra-lang.zip` (ou clone o repositório, se já estiver no Git) e
abra um terminal dentro da pasta:

```bash
cd amarra-lang
```

Todo comando abaixo deve ser rodado a partir dessa pasta (a raiz do
repositório), não de dentro de `src/` ou `gramatica/`.

### 2. Criar um ambiente e instalar as ferramentas do ANTLR

No Windows (PowerShell):

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

No Linux/macOS:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

Não é necessário ativar o ambiente: os comandos usam diretamente o Python
de `.venv/`. Se essa pasta já existir, basta executar o comando de instalação.

O arquivo `requirements.txt` fixa as versões de dois pacotes:

- `antlr4-tools`, que cria os comandos `antlr4` (gera código a partir da
  gramática) e `antlr4-parse` (testa a gramática direto, sem gerar código)
- `antlr4-python3-runtime`, a biblioteca que o `lexico.py` usa para rodar o
  lexer gerado

Na primeira geração, a ferramenta baixa o ANTLR. Se não encontrar Java, ela
também oferece instalar uma JRE — responda `y`. Isso pode demorar alguns minutos.

### 3. Gerar o código do analisador léxico

No Windows (PowerShell):

```powershell
.\.venv\Scripts\python.exe gerar.py
```

No Linux/macOS:

```bash
.venv/bin/python gerar.py
```

O script `gerar.py` lê `gramatica/AmarraLexer.g4` e cria
`gerado/AmarraLexer.py`, usando a mesma versão do ANTLR instalada para o runtime.
A gramática é exclusivamente léxica, correspondente à fase E2 do projeto.
A opção [`-Xexact-output-dir`](https://github.com/antlr/antlr4/blob/master/doc/tool-options.md#-xexact-output-dir)
garante que os arquivos sejam gravados diretamente em `gerado/`, no caminho
esperado pelo analisador. Essa pasta é gerada automaticamente e não vai para o Git.

O `gerar.sh` continua disponível para quem usa Bash com o ambiente ativado:
`source .venv/bin/activate` e depois `bash gerar.sh`.

Se a pasta `gerado/` não aparecer depois de rodar o script, o comando
de geração provavelmente falhou — role a saída do terminal para cima e leia a
primeira linha de erro.

### 4. Rodar o analisador léxico em um programa de exemplo

No Windows (PowerShell):

```powershell
.\.venv\Scripts\python.exe src/lexico.py exemplos/no_simples.amr
```

No Linux/macOS:

```bash
.venv/bin/python src/lexico.py exemplos/no_simples.amr
```

A saída esperada é uma linha por token reconhecido, seguida da contagem
total:

```
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

Comentários e espaços em branco são descartados pela regra `-> skip` e não
aparecem na saída nem na contagem final.

### 5. Rodar em um exemplo com erro

```powershell
.\.venv\Scripts\python.exe src/lexico.py exemplos/invalidos/caractere_invalido.amr
```

No Linux/macOS, substitua `.\.venv\Scripts\python.exe` por `.venv/bin/python`.

Em vez da lista de tokens, deve aparecer uma mensagem apontando a linha e a
coluna do problema, por exemplo:

```
Erro lexico na linha 4, coluna 12: token recognition error at: '@'
```

### 6. Rodar todos os exemplos de uma vez (opcional)

No Linux/macOS:

```bash
for f in exemplos/*.amr; do echo "--- $f ---"; .venv/bin/python src/lexico.py "$f"; done
for f in exemplos/invalidos/*.amr; do echo "--- $f ---"; .venv/bin/python src/lexico.py "$f"; done
```

No Windows (PowerShell):

```powershell
Get-ChildItem exemplos\*.amr | ForEach-Object { Write-Host "--- $_ ---"; .\.venv\Scripts\python.exe src/lexico.py $_.FullName }
Get-ChildItem exemplos\invalidos\*.amr | ForEach-Object { Write-Host "--- $_ ---"; .\.venv\Scripts\python.exe src/lexico.py $_.FullName }
```

## Estrutura do repositório

```
amarra-lang/
├── README.md              este arquivo
├── .gitignore              ignora gerado/, .venv/ e arquivos temporários
├── requirements.txt         versões das dependências Python
├── gerar.py                 gera o lexer no Windows, Linux e macOS
├── gerar.sh                 atalho para gerar.py em Bash
├── gramatica/
│   └── AmarraLexer.g4       regras do lexer (o que vira cada tipo de token)
├── gerado/                  criado pelo passo 3 — não editar, não versionar
├── src/
│   └── lexico.py            lê um .amr e imprime os tokens reconhecidos
├── exemplos/
│   ├── no_simples.amr        programa válido
│   ├── no_reforcado.amr      programa válido (usa repetir/se)
│   ├── no_windsor.amr        programa válido (usa tipo real)
│   └── invalidos/            programas com erro proposital, um por tipo de erro
├── docs/
│   └── especificacao.md      especificação completa da linguagem
└── DIARIO.md                 registro de cada sessão de trabalho do grupo
```

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `python` não é reconhecido ou abre a Microsoft Store | O comando aponta para um alias do Windows | Crie o ambiente com `py -m venv .venv` e use `.\.venv\Scripts\python.exe` nos demais comandos |
| `./gerar.sh` não funciona no PowerShell | Esse script é para Bash | Use `.\.venv\Scripts\python.exe gerar.py` |
| `Dependencias ausentes` ou `Biblioteca antlr4 ausente` | Os pacotes não foram instalados no Python em uso | Execute `.\.venv\Scripts\python.exe -m pip install -r requirements.txt` |
| Trava perguntando sobre Java e nunca termina | Rede lenta ou bloqueada baixando o Java | Tente de novo com conexão melhor; se estiver numa rede restrita (ex: rede de faculdade), tente em outra rede |
| `Lexer nao gerado` | O passo 3 não foi concluído | Execute `.\.venv\Scripts\python.exe gerar.py` e verifique se houve erro |
| `Nao foi possivel abrir` | O arquivo informado não existe ou não pode ser lido | Confira o caminho e execute a partir da raiz do projeto |
| Tokens aparecem com nome errado ou fora de ordem | A gramática (`AmarraLexer.g4`) foi editada depois da última geração | Rode `gerar.py` de novo para atualizar a pasta `gerado/` |

Os comandos da tabela são para PowerShell; no Linux/macOS, use `.venv/bin/python`.

## Fase atual do projeto

**E2** — especificação da linguagem e analisador léxico (vale 1,5 ponto na
Avaliação de Grau 1). As próximas fases são E3 (analisador sintático, árvore
sintática) e E4 (análise semântica e execução).

## Versão do ANTLR usada

**4.13.2**, fixada em `requirements.txt`. O script `gerar.py` seleciona a versão
do gerador a partir do runtime instalado para manter ambos compatíveis.
