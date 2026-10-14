# Diário de bordo

## 09/09

Criamos a ideia principal da linguagem **Amarra**, definindo como domínio as instruções para realizar diferentes tipos de nós, inicialmente com foco em nós de cadarço e gravata. A proposta surgiu a partir da ideia de criar uma linguagem capaz de representar uma sequência de ações para realizar um nó, de forma semelhante ao exemplo de uma linguagem utilizada para comandar um robô.

Também estabelecemos as principais características da linguagem, definindo que ela deveria possuir comandos relacionados aos movimentos necessários para realizar os nós, permitir a identificação do tipo de nó e possibilitar a representação de informações como medidas e descrições durante o processo.

## 16/09

Configuramos o ambiente de desenvolvimento do projeto e instalamos o **ANTLR4**, ferramenta que será utilizada para definir a gramática e gerar o analisador léxico da linguagem **Amarra**. Também verificamos o funcionamento da ferramenta e preparamos o projeto para iniciar a implementação da gramática.

## 20/09

Definimos o domínio: instruções para amarrar nós (cadarço e gravata), inspirado no exemplo de "desenho" do enunciado (robô que executa comandos). Descartamos a ideia original de somente *reconhecer* se uma sequência de movimentos forma um nó válido, porque isso seria um autômato de reconhecimento, e não uma linguagem de programação que executa algo — o projeto pede uma linguagem que comanda, não apenas valida.

Montamos a especificação (`docs/especificacao.md`) e a gramática do lexer (`gramatica/Amarra.g4`). No meio do caminho, percebemos que a especificação inicial excluía números reais, mas o enunciado exige que o lexer reconheça inteiros e reais no mínimo. Corrigimos adicionando o tipo `real`, utilizado para representar medidas, como o comprimento da ponta do cadarço em centímetros.

## 13/10 — Árvore sintática (Aula 10)

Adicionamos `gramatica/AmarraParser.g4`, reutilizando os tokens do lexer da E2.
As regras reconhecem definições de nó, declarações, atribuições, comandos e
blocos aninhados de `repetir` e `se`, com consumo obrigatório até o fim do arquivo.

Incluímos parênteses, menos unário e operadores lógicos `e` e `ou`. A ordem das
alternativas de expressão estabelece a precedência, e os operadores binários de
um mesmo grupo associam à esquerda.

O novo `src/sintatico.py` mostra a árvore sintática concreta em formato indentado
ou parentizado e informa erros com linha e coluna. Acrescentamos exemplos válidos,
exemplos com erros sintáticos e testes de estrutura, precedência e diagnósticos.
A relação entre os conceitos da aula e o código está em `docs/aula10.md`.
Análise semântica e execução permanecem como etapas futuras.

## 14/10 — Autômatos de pilha (Aula 11)

Relacionamos as regras da gramática com os métodos gerados pelo ANTLR e com os
contextos mantidos durante a análise. Acrescentamos `--rastrear` ao analisador
sintático para observar entradas e saídas de regras, consumo de tokens e a pilha
de contextos. O rastreamento utiliza os eventos do próprio parser.

A opção `--regra` permite testar expressões, blocos e outras regras separadamente,
sempre verificando se toda a entrada foi consumida. A condicional ganhou o bloco
opcional `senao`, com chaves obrigatórias para definir sua associação ao `se`.

Adicionamos exemplos de condicionais aninhadas, fragmentos para depuração e erros
com parênteses e `senao`. Os testes cobrem essas construções, a evolução da pilha,
os tokens consumidos e a preservação da árvore com rastreamento. A explicação dos
conceitos e dos diagnósticos está em `docs/aula11.md`.
