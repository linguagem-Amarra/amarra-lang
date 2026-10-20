# Validação do analisador sintático — E3

Data da execução: **20/10/2026**.

O analisador sintático da Amarra foi gerado novamente e validado com
**108 testes automatizados: todos passaram, sem falhas ou erros**. Este documento
registra a evolução do projeto léxico para o sintático e a ampliação dos testes,
com ênfase em entradas inválidas.

## O que foi implementado

| Etapa | Alteração | Onde conferir |
| :--- | :--- | :--- |
| E2 | Reconhecimento dos tokens da linguagem e diagnóstico de erros léxicos. | [Lexer](../gramatica/AmarraLexer.g4) e [comando léxico](../src/lexico.py). |
| Aula 10 | Gramática livre de contexto, blocos aninhados, expressões, precedência, associatividade e árvore sintática concreta. | [Parser](../gramatica/AmarraParser.g4), [analisador](../src/sintatico.py) e [explicação da Aula 10](aula10.md). |
| Aula 11 | `senao` opcional, rastreamento dos contextos do parser e análise de regras isoladas com consumo completo. | [Rastreamento](../src/rastreamento.py) e [explicação da Aula 11](aula11.md). |
| Revisão de 20/10 | Coleção de 72 entradas, execução individual dos casos e documentação dos resultados. | [Entradas dos testes](../tests/casos_sintaticos.json) e [executor](../tests/test_casos_sintaticos.py). |

O parser já estava implementado antes desta revisão. A geração e os testes
confirmaram seu comportamento nos casos examinados; não foi necessário mudar
a gramática ou o código de análise.

## Critérios de verificação

Para uma entrada válida, o teste exige uma árvore da regra escolhida, nenhum
erro sintático registrado e o cursor no fim da entrada (`EOF`). Reconhecer apenas
um prefixo do código não é suficiente.

Para uma entrada inválida, o teste exige `ErroAnalise` na fase esperada, com
mensagem, linha e coluna. Se um caso marcado como sintático falhar no lexer,
o teste falha. Se o analisador aceitar a entrada ou lançar uma exceção inesperada,
o teste também falha. Os casos S07, S16, S46 e L01 verificam ainda a posição exata.
As linhas começam em 1 e as colunas em 0.

Além da aceitação ou rejeição, os testes anteriores inspecionam a estrutura da
árvore para verificar precedência e associatividade. Também verificam a
associação de `senao`, o aninhamento, os eventos da pilha e o terminal: código
de saída 0 em sucesso, 1 em erro de análise e ausência de árvore de sucesso
quando ocorre erro.

## Quantidade e resultado

| Conjunto | Testes independentes | Resultado |
| :--- | ---: | :--- |
| `test_sintatico.py` — árvores, precedência, diagnósticos e terminal | 17 | Todos passaram |
| `test_aula11.py` — condicionais, regras isoladas, pilha e terminal | 19 | Todos passaram |
| Coleção V01–V20 — entradas sintaticamente válidas | 20 | Todas aceitas até EOF |
| Coleção S01–S48 — entradas com erro sintático | 48 | Todas rejeitadas pelo parser |
| Coleção L01–L04 — entradas com erro léxico | 4 | Todas rejeitadas pelo lexer |
| **Total descoberto pelo unittest** | **108** | **OK** |

Os 72 casos adicionais contêm **52 entradas inválidas**. Os subtestes internos
dos 36 testes anteriores não foram somados como testes independentes. Essa
contagem representa testes executados, não uma porcentagem de cobertura de código.

Cada caso está no arquivo [casos_sintaticos.json](../tests/casos_sintaticos.json),
com `id`, `descricao`, `regra`, `resultado` e `codigo`. O campo opcional `posicao`
contém `[linha, coluna]`. Os valores `valido`, `sintatico` e `lexico` indicam,
respectivamente, aceitação ou a fase que deve rejeitar a entrada.

## Matriz dos casos adicionais

O código completo de cada entrada está no JSON indicado acima. A coluna
“Obtido” registra o resultado da execução desta revisão; `OK` em um teste
negativo significa que a rejeição esperada ocorreu.

### Entradas válidas

| ID | Situação | Regra | Esperado | Obtido |
| :--- | :--- | :--- | :--- | :--- |
| V01 | Nó com bloco vazio | programa | Aceitar | Aceito até EOF |
| V02 | Os seis comandos com seus argumentos | programa | Aceitar | Aceito até EOF |
| V03 | Declarações dos quatro tipos | programa | Aceitar | Aceito até EOF |
| V04 | Atribuição com expressão aritmética | programa | Aceitar | Aceito até EOF |
| V05 | Comparações e operadores lógicos combinados | programa | Aceitar | Aceito até EOF |
| V06 | Parênteses aninhados e menos unário | programa | Aceitar | Aceito até EOF |
| V07 | Repetição e condicionais aninhadas com dois senao | programa | Aceitar | Aceito até EOF |
| V08 | Blocos vazios nas duas alternativas da condicional | programa | Aceitar | Aceito até EOF |
| V09 | Repetição cujo contador é uma expressão | programa | Aceitar | Aceito até EOF |
| V10 | Três definições de nó no mesmo arquivo | programa | Aceitar | Aceito até EOF |
| V11 | Texto com acentos, chaves e marcador de comentário | programa | Aceitar | Aceito até EOF |
| V12 | Tabulações, linhas CRLF e comentário até o fim do arquivo | programa | Aceitar | Aceito até EOF |
| V13 | Identificadores com prefixos de palavras reservadas | programa | Aceitar | Aceito até EOF |
| V14 | Zero inteiro e literal real | programa | Aceitar | Aceito até EOF |
| V15 | Instruções após blocos de controle consecutivos | programa | Aceitar | Aceito até EOF |
| V16 | Expressão isolada sem ponto e vírgula | expr | Aceitar | Aceito até EOF |
| V17 | Instrução isolada com ponto e vírgula | instrucao | Aceitar | Aceito até EOF |
| V18 | Comando isolado sem ponto e vírgula | comando | Aceitar | Aceito até EOF |
| V19 | Nome não declarado é questão semântica, com sintaxe válida | programa | Aceitar | Aceito até EOF |
| V20 | Incompatibilidade de tipos não é rejeitada na fase sintática | programa | Aceitar | Aceito até EOF |

### Entradas com erro sintático

| ID | Situação | Regra | Esperado | Obtido |
| :--- | :--- | :--- | :--- | :--- |
| S01 | Programa vazio | programa | Erro sintático | Erro sintático |
| S02 | Arquivo contendo somente comentário | programa | Erro sintático | Erro sintático |
| S03 | Definição sem a palavra no | programa | Erro sintático | Erro sintático |
| S04 | Nome do nó sem aspas | programa | Erro sintático | Erro sintático |
| S05 | Definição sem nome | programa | Erro sintático | Erro sintático |
| S06 | Bloco sem chave de abertura | programa | Erro sintático | Erro sintático |
| S07 | Fim do arquivo antes da chave de fechamento | programa | Erro sintático | Erro sintático |
| S08 | Chave de fechamento excedente | programa | Erro sintático | Erro sintático |
| S09 | Definição de nó dentro de outro nó | programa | Erro sintático | Erro sintático |
| S10 | Comando fora do nó após uma definição válida | programa | Erro sintático | Erro sintático |
| S11 | Declaração sem identificador | programa | Erro sintático | Erro sintático |
| S12 | Palavra reservada usada como identificador | programa | Erro sintático | Erro sintático |
| S13 | Declaração sem inicialização obrigatória | programa | Erro sintático | Erro sintático |
| S14 | Declaração sem sinal de atribuição | programa | Erro sintático | Erro sintático |
| S15 | Declaração sem expressão após o igual | programa | Erro sintático | Erro sintático |
| S16 | Declaração sem terminador antes da instrução seguinte | programa | Erro sintático | Erro sintático |
| S17 | Atribuição sem sinal de igual | programa | Erro sintático | Erro sintático |
| S18 | Atribuições encadeadas não previstas na gramática | programa | Erro sintático | Erro sintático |
| S19 | Comando sem ponto e vírgula | programa | Erro sintático | Erro sintático |
| S20 | Ponto e vírgula isolado não forma instrução | programa | Erro sintático | Erro sintático |
| S21 | Cruzar com apenas uma ponta | programa | Erro sintático | Erro sintático |
| S22 | Cruzar com uma terceira ponta excedente | programa | Erro sintático | Erro sintático |
| S23 | Passar por baixo com número no lugar de identificador | programa | Erro sintático | Erro sintático |
| S24 | Passar por cima sem a ponta | programa | Erro sintático | Erro sintático |
| S25 | Enrolar sem expressão de quantidade | programa | Erro sintático | Erro sintático |
| S26 | Enrolar sem identificador da ponta | programa | Erro sintático | Erro sintático |
| S27 | Apertar com argumento não permitido | programa | Erro sintático | Erro sintático |
| S28 | Finalizar sem expressão | programa | Erro sintático | Erro sintático |
| S29 | Repetição sem expressão | programa | Erro sintático | Erro sintático |
| S30 | Repetição sem bloco delimitado por chaves | programa | Erro sintático | Erro sintático |
| S31 | Aninhamento de repetição com uma chave faltando | programa | Erro sintático | Erro sintático |
| S32 | Se sem condição | programa | Erro sintático | Erro sintático |
| S33 | Se sem bloco delimitado por chaves | programa | Erro sintático | Erro sintático |
| S34 | Senao sem se correspondente | programa | Erro sintático | Erro sintático |
| S35 | Senao sem bloco delimitado por chaves | programa | Erro sintático | Erro sintático |
| S36 | Dois senao para a mesma condicional | programa | Erro sintático | Erro sintático |
| S37 | Condição indevida após senao | programa | Erro sintático | Erro sintático |
| S38 | Terminador indevido após bloco de controle | programa | Erro sintático | Erro sintático |
| S39 | Parênteses sem expressão interna | programa | Erro sintático | Erro sintático |
| S40 | Expressão com parêntese sem fechamento | programa | Erro sintático | Erro sintático |
| S41 | Expressão com parêntese de fechamento excedente | programa | Erro sintático | Erro sintático |
| S42 | Operador binário sem operando à direita | programa | Erro sintático | Erro sintático |
| S43 | Operadores aritméticos em sequência inválida | programa | Erro sintático | Erro sintático |
| S44 | Mais unário não previsto na linguagem | programa | Erro sintático | Erro sintático |
| S45 | Operadores lógicos sem operando intermediário | programa | Erro sintático | Erro sintático |
| S46 | Tokens restantes após expressão isolada | expr | Erro sintático | Erro sintático |
| S47 | Ponto e vírgula excedente na regra comando | comando | Erro sintático | Erro sintático |
| S48 | Ponto e vírgula excedente na regra declaracao | declaracao | Erro sintático | Erro sintático |

### Entradas com erro léxico

| ID | Situação | Regra | Esperado | Obtido |
| :--- | :--- | :--- | :--- | :--- |
| L01 | Caractere não reconhecido dentro de bloco | programa | Erro léxico | Erro léxico |
| L02 | Literal de texto sem aspas de fechamento | programa | Erro léxico | Erro léxico |
| L03 | Número real com dois pontos decimais | programa | Erro léxico | Erro léxico |
| L04 | Quebra de linha dentro de literal de texto | programa | Erro léxico | Erro léxico |

## Como reproduzir

Para a primeira execução, siga a instalação de Python, Java e dependências no
[README](../README.md#executar). Todos os comandos abaixo partem da raiz do
repositório.

No Windows/PowerShell:

```powershell
.\.venv\Scripts\python.exe gerar.py
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

No Linux/macOS:

```bash
.venv/bin/python gerar.py
.venv/bin/python -m unittest discover -s tests -v
```

Trecho final obtido no Windows nesta revisão:

```text
Ran 108 tests in 8.245s

OK
```

A duração depende da máquina. Ambiente utilizado: Windows, Python 3.11.2,
Java 22.0.2, `antlr4-tools` 0.2.2 e gerador/runtime ANTLR 4.13.2.
Esta execução não constitui uma validação em Linux ou macOS.

Para executar apenas os 72 casos adicionais no Windows:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_casos_sintaticos.py -v
```

Para investigar somente o caso S16:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_casos_sintaticos.py -k S16 -v
```

### Demonstração no terminal

Programa válido, com árvore:

```powershell
.\.venv\Scripts\python.exe src/sintatico.py exemplos/expressoes.amr --formato lisp
```

Programa inválido, com diagnóstico e código de saída 1:

```powershell
.\.venv\Scripts\python.exe src/sintatico.py exemplos/invalidos/sintaxe/sem_ponto_virgula.amr
```

Expressão isolada, com rastreamento da pilha:

```powershell
.\.venv\Scripts\python.exe src/sintatico.py exemplos/fragmentos/expressao.amr --regra expr --rastrear --formato lisp
```

## Limites da entrega

O resultado é uma árvore sintática concreta, com regras e tokens. O analisador
não executa os comandos nem calcula o valor das expressões. Tipos incompatíveis,
nomes não declarados e validade física dos movimentos pertencem à análise
semântica ou à execução, previstas para E4. V19 e V20 registram explicitamente
essa fronteira.

A bateria verifica os comportamentos descritos, sem provar ausência de todos
os possíveis defeitos. A recursão também está sujeita aos limites do ambiente
Python. As referências conceituais usadas são os materiais das Aulas 10 e 11,
relacionados ao código nos documentos correspondentes; critérios de nota e
prazo devem ser conferidos no enunciado oficial do professor.
