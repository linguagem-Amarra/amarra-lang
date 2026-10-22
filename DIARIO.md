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

## 20/10/2026 — Validação da entrega sintática

Revisamos o analisador sintático já implementado nas etapas das Aulas 10 e 11.
Regeneramos o lexer e o parser e executamos os 36 testes existentes, que passaram.

Acrescentamos uma coleção de 72 entradas em `tests/casos_sintaticos.json`, com
identificadores, descrições, regras iniciais e resultados esperados. São 20
entradas sintaticamente válidas, 48 com erros sintáticos e 4 com erros léxicos.
Os casos incluem argumentos ausentes ou excedentes, declarações incompletas,
delimitadores incorretos, condicionais, repetições, expressões e tokens restantes.
Também verificamos textos com acentos, comentários, quebras de linha do Windows
e a distinção entre erro sintático e questão semântica.

O novo `tests/test_casos_sintaticos.py` registra cada entrada como um teste
independente. A execução completa passou com **108 testes, sem falhas ou erros**.
Os testes anteriores continuam verificando a estrutura das árvores, a
precedência, a associatividade, a pilha e a interface de terminal.

Criamos `docs/validacao-sintatica.md` com a matriz de casos, os resultados,
o ambiente utilizado e os comandos para reproduzir a validação. Atualizamos
o README para dar acesso direto a esse relatório e explicar a contagem dos testes.
Nesta revisão, não foi necessário alterar a gramática ou o analisador.

## 21/10/2026 — Diagnósticos e preparação do visitor (Aula 13)

Aplicamos os conceitos do material `Aula13 - Erros e AST-1.pdf`. As mensagens
léxicas e sintáticas agora apresentam linha, coluna, símbolos esperados e entrada
encontrada em português. Os diagnósticos também ficam disponíveis como dados
estruturados em `ErroAnalise.diagnosticos`.

Acrescentamos `--recuperar` ao analisador sintático. O modo pânico descarta a
instrução defeituosa até um ponto seguro (`;` ou `}`), preserva a chave do bloco
externo e permite encontrar outros erros. Mantivemos a interrupção no primeiro
erro como padrão. Nenhuma árvore de sucesso é apresentada quando há diagnósticos.

O script `gerar.py` passou a incluir `-visitor`, garantindo que o visitor seja
recriado junto com o lexer e o parser. Os testes demonstram a visita aos comandos
e o retorno de resultados entre subexpressões. A AST completa será construída
na etapa seguinte, conforme a indicação da Aula 14 no material.

Incluímos o exemplo `multiplos_erros.amr`, a documentação `docs/aula13.md` e 24
testes novos. Os **132 testes passaram**, incluindo os casos anteriores e a
verificação das 72 entradas da coleção também com recuperação ativada.

## 21/10/2026 — Conferência da Aula 12

Comparamos o material `Aula12 - Analise descendente-2 (3).pdf` com a gramática,
o parser gerado e os testes existentes. Confirmamos que a escolha de instruções
pelo próximo token, a precedência das expressões e o `senao` opcional já estavam
contemplados nas implementações anteriores.

Acrescentamos `docs/aula12.md` para explicar FIRST e FOLLOW com exemplos da
Amarra e indicar onde esses conceitos aparecem no código. As decisões são
realizadas pelo ANTLR; não foi acrescentado um calculador próprio desses conjuntos.
Atualizamos também o README e as referências na especificação.

Os três testes selecionados de precedência e os quatro testes de condicionais
passaram. Esta conferência não alterou a gramática nem acrescentou testes:
a suíte continua com 132 testes.
