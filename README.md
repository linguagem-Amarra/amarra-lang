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

- **Python 3.8 ou mais novo.** Confira rodando `python3 --version` (ou `python
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

### 2. Instalar as ferramentas do ANTLR

```bash
pip install antlr4-tools antlr4-python3-runtime
```

Isso instala dois pacotes:
- `antlr4-tools`, que cria os comandos `antlr4` (gera código a partir da
  gramática) e `antlr4-parse` (testa a gramática direto, sem gerar código)
- `antlr4-python3-runtime`, a biblioteca que o `lexico.py` usa para rodar o
  lexer gerado

Na primeira vez que você rodar `antlr4` ou `antlr4-parse`, ele vai perguntar
algo como "Java not found, install it? [y/n]" — responda `y`. Isso pode
demorar alguns minutos, principalmente no Windows.

Se o comando `pip` não for reconhecido, tente `pip3` no lugar, ou `python -m
pip install antlr4-tools antlr4-python3-runtime`.

### 3. Gerar o código do analisador léxico

```bash
./gerar.sh
```

Se aparecer erro de permissão (`Permission denied`), rode:

```bash
bash gerar.sh
```

Esse script executa o comando `antlr4 -Dlanguage=Python3 -visitor -o gerado
gramatica/Amarra.g4`, que lê a gramática em `gramatica/Amarra.g4` e cria uma
pasta nova chamada `gerado/`, com o código Python do lexer dentro
(`AmarraLexer.py` e outros arquivos de apoio). Essa pasta é gerada
automaticamente a cada vez — por isso ela não vai para o Git (veja
`.gitignore`).

Se a pasta `gerado/` não aparecer depois de rodar o script, o comando
`antlr4` provavelmente falhou — role a saída do terminal para cima e leia a
primeira linha de erro.

### 4. Rodar o analisador léxico em um programa de exemplo

```bash
python src/lexico.py exemplos/no_simples.amr
```

(No Windows, pode ser necessário `python3` em vez de `python`, dependendo de
como o Python foi instalado.)

A saída esperada é uma linha por token reconhecido, seguida da contagem
total, parecido com isto:

```
COMENT '// No de cadarco simples' linha 1
NO 'no' linha 2
TEXTO '"cadarço simples"' linha 2
ABRE_CHAVE '{' linha 2
CRUZAR 'cruzar' linha 3
IDENT 'ponta_direita' linha 3
IDENT 'ponta_esquerda' linha 3
PONTOVIRG ';' linha 3
...
14 tokens reconhecidos
```

(comentários e espaços em branco são descartados na regra do lexer, então na
prática eles não aparecem na contagem final — se aparecerem, é sinal de que a
regra `-> skip` não está funcionando, avise o grupo.)

### 5. Rodar em um exemplo com erro

```bash
python src/lexico.py exemplos/invalidos/caractere_invalido.amr
```

Em vez da lista de tokens, deve aparecer uma mensagem apontando a linha e a
coluna do problema, por exemplo:

```
Erro lexico na linha 4, coluna 12: token recognition error at: '@'
```

### 6. Rodar todos os exemplos de uma vez (opcional)

No Linux/macOS:

```bash
for f in exemplos/*.amr; do echo "--- $f ---"; python src/lexico.py "$f"; done
for f in exemplos/invalidos/*.amr; do echo "--- $f ---"; python src/lexico.py "$f"; done
```

No Windows (PowerShell):

```powershell
Get-ChildItem exemplos\*.amr | ForEach-Object { Write-Host "--- $_ ---"; python src/lexico.py $_.FullName }
Get-ChildItem exemplos\invalidos\*.amr | ForEach-Object { Write-Host "--- $_ ---"; python src/lexico.py $_.FullName }
```

## Estrutura do repositório

```
amarra-lang/
├── README.md              este arquivo
├── .gitignore              ignora a pasta gerado/ e arquivos temporários
├── gerar.sh                 script que gera o código a partir da gramática
├── gramatica/
│   └── Amarra.g4            regras do lexer (o que vira cada tipo de token)
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
| `antlr4: command not found` | O `pip install` do passo 2 não terminou certo, ou o PATH do Python não inclui a pasta de scripts | Rode o `pip install` de novo e confira se não apareceu erro; no Windows, reabra o terminal depois de instalar |
| Trava perguntando sobre Java e nunca termina | Rede lenta ou bloqueada baixando o Java | Tente de novo com conexão melhor; se estiver numa rede restrita (ex: rede de faculdade), tente em outra rede |
| `ModuleNotFoundError: No module named 'gerado'` | O passo 3 (`./gerar.sh`) não foi rodado, ou foi rodado de dentro da pasta errada | Volte pra raiz do repositório (`amarra-lang/`) e rode `./gerar.sh` de novo |
| `ModuleNotFoundError: No module named 'antlr4'` | O pacote `antlr4-python3-runtime` não foi instalado | Rode `pip install antlr4-python3-runtime` |
| Tokens aparecem com nome errado ou fora de ordem | A gramática (`Amarra.g4`) foi editada depois da última geração | Rode `./gerar.sh` de novo para atualizar a pasta `gerado/` |

## Fase atual do projeto

**E2** — especificação da linguagem e analisador léxico (vale 1,5 ponto na
Avaliação de Grau 1). As próximas fases são E3 (analisador sintático, árvore
sintática) e E4 (análise semântica e execução).

## Versão do ANTLR usada

Depois de instalar, confirme a versão com `antlr4 --version` e atualize esta
linha com o número exato — código gerado por uma versão pode não rodar com o
runtime de outra.
