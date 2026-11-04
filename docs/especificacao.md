# Especificação da linguagem Amarra

## 1. Para que serve

Amarra é uma linguagem para descrever, passo a passo, como amarrar nós (cadarços,
gravatas e nós náuticos simples). Um programa em Amarra é uma sequência de comandos.
A proposta é produzir um roteiro de montagem do nó e validar a ordem lógica dos
movimentos quando a etapa de execução for implementada.

Na implementação atual (E3 e início da E4), os analisadores reconhecem os tokens,
validam a sintaxe, constroem a AST e verificam nomes, escopos e tipos. O
interpretador executa as instruções e a interface web apresenta as etapas em
um diagrama de duas pontas. A correção física dos movimentos não é certificada.

## 2. Programa de exemplo comentado

```amarra
// Nó de cadarço simples, com duas voltas de reforço
no "cadarço simples" {                  // inicia a definição de um nó com esse nome
    inteiro voltas = 2;                 // variável inteira: quantidade de voltas de reforço

    cruzar ponta_direita ponta_esquerda;  // cruza as duas pontas do cadarço
    passar_baixo ponta_direita;           // passa a ponta direita por baixo da esquerda
    apertar;                              // aperta o primeiro nó

    repetir voltas {                      // repete o bloco "voltas" vezes (aqui, 2x)
        enrolar ponta_esquerda 1;         // enrola a ponta esquerda uma volta
    }

    se voltas > 1 {                       // condicional: só reforça se houver mais de 1 volta
        apertar;                          // aperta de novo para fixar o reforço
    }

    finalizar "nó pronto";                // encerra a definição, com mensagem de status
}
```

## 3. Tipos de dado

- `inteiro` — quantidade de voltas, repetições, contadores (ex.: `2`, `10`)
- `real` — comprimento de uma ponta em centímetros (ex.: `65.5`)
- `texto` — nomes de nós e mensagens (ex.: `"cadarço simples"`)
- `booleano` — resultado de condições internas (ex.: `verdadeiro`, `falso`)

## 4. Comandos

| Comando | Efeito |
|---|---|
| `no "nome" { ... }` | Inicia a definição de um nó com um nome |
| `cruzar A B` | Cruza a ponta A sobre a ponta B |
| `passar_baixo A` | Passa a ponta A por baixo do cruzamento atual |
| `passar_cima A` | Passa a ponta A por cima do cruzamento atual |
| `enrolar A n` | Enrola a ponta A por `n` voltas |
| `apertar` | Aperta o nó no ponto atual |
| `repetir n { ... }` | Repete o bloco de comandos `n` vezes |
| `se condição { ... }` | Executa o bloco somente se a condição for verdadeira |
| `se condição { ... } senao { ... }` | Acrescenta um bloco alternativo para a condição falsa |
| `finalizar expressão` | Encerra a definição do nó e imprime a mensagem, como `finalizar "pronto";` |

## 5. Operadores e precedência

Da maior para a menor precedência:

1. `( ... )` — agrupamento explícito
2. `-` unário — sinal de uma expressão, como `-2.5` ou `-(voltas + 1)`
3. `*`, `/` — multiplicação e divisão (usados em cálculos de voltas)
4. `+`, `-` binários — soma e subtração
5. `>`, `<`, `==` — comparações (usadas em `se`)
6. `e` — conjunção lógica
7. `ou` — disjunção lógica

Os operadores binários de um mesmo grupo associam à esquerda. Por exemplo,
`8 - 3 - 1` tem a estrutura `(8 - 3) - 1`. As alternativas recursivas de `expr`
estão nessa ordem de precedência em `gramatica/AmarraParser.g4`.

A atribuição `=` é parte de uma instrução, não de uma expressão. Em
`voltas = base + 1 * 2;`, a árvore coloca `1 * 2` dentro da soma, que é o valor
atribuído a `voltas`. O parser representa essa estrutura; a avaliação virá em E4.

Os nomes `e`, `ou` e `senao` são palavras reservadas. Nomes maiores como
`enrolar`, `esquerda`, `outra_ponta` e `senao_extra` continuam sendo reconhecidos normalmente.

## 6. Comentários

Comentários de linha começam com `//` e vão até o fim da linha. Não há comentários
de bloco — mantém a gramática do lexer simples e evita ambiguidade com outros símbolos.

## 7. Três coisas que a linguagem deliberadamente não faz

1. **Não simula física real do nó** (tensão, atrito, material do cadarço) — só valida a
   ordem lógica dos movimentos quando o executor for implementado, não o resultado mecânico real.
2. **Não permite funções definidas pelo usuário nem chamadas recursivas** — reuso de ações
   é feito com `repetir`, sem chamar um nó dentro de outro. Essa restrição não impede a
   recursão das regras gramaticais, que permite aninhar blocos de `repetir` e `se`.
3. **Não corrige nem desfaz passos** — não existe comando "desamarrar" ou "voltar"; um erro de
   sequência é reportado como erro de execução, não corrigido automaticamente.

## 8. Regras sintáticas da fase E3

O lexer permanece em `gramatica/AmarraLexer.g4`. O parser está em
`gramatica/AmarraParser.g4` e reutiliza os tokens do lexer por meio de
`tokenVocab = AmarraLexer`.

| Regra | Estrutura reconhecida |
|---|---|
| `programa` | Uma ou mais definições de nó seguidas de `EOF` (fim do arquivo). |
| `definicaoNo` | `no "nome" { ... }`, somente no nível externo. |
| `bloco` | Zero ou mais instruções entre chaves. |
| `declaracao` | Tipo, identificador, `=` e expressão; a inicialização é obrigatória. |
| `atribuicao` | Identificador, `=` e expressão. |
| `comando` | `cruzar`, `passar_baixo`, `passar_cima`, `enrolar`, `apertar` ou `finalizar`, com seus argumentos. |
| `repeticao` | `repetir` seguido de uma expressão e um bloco. |
| `condicional` | `se` seguido de uma expressão e um bloco, com `senao` e outro bloco opcionais. |
| `expr` | Literais, identificadores, agrupamentos e operações da seção 5. |

Declarações, atribuições e comandos terminam com `;`. Os blocos de `repetir` e
`se` terminam com `}` e não recebem `;` depois da chave. Eles podem conter novos
blocos de `repetir` e `se`. A definição de um `no` dentro de outro não é permitida.

A condicional usa `condicional : SE expr bloco (SENAO bloco)? ;`. O bloco de
`senao` também exige chaves. Ele deve acompanhar o fechamento do bloco do `se`,
sem `;` entre os dois. As chaves determinam a associação em condicionais
aninhadas. Espaços e comentários entre `}` e `senao` são permitidos.

Os argumentos de `cruzar`, `passar_baixo` e `passar_cima` são identificadores de
pontas. `enrolar` recebe um identificador de ponta e uma expressão para a
quantidade de voltas. `finalizar` recebe uma expressão, como um literal de texto
ou o nome de uma variável. A fase semântica exige quantidade inteira em `enrolar`
e texto em `finalizar`, conforme a seção 9.

Por padrão, o parser encerra no primeiro erro. Os diagnósticos informam linha
(a partir de 1), coluna (a partir de 0), símbolos esperados e entrada encontrada.
Ele só apresenta a árvore quando o arquivo inteiro foi aceito.
O comando `src/sintatico.py` também detecta erros léxicos antes da análise sintática.

Com `--recuperar`, tenta continuar após erros dentro de instruções, descartando
tokens até `;` ou `}`. A chave do bloco chamador é preservada e blocos pertencentes
à instrução descartada são balanceados. Operadores e parênteses não são pontos
de sincronização. Erros estruturais fora desses limites podem encerrar a análise.
Qualquer diagnóstico impede a devolução da árvore e mantém o código de saída 1.
Se houver erros léxicos, o parser não começa; o modo de recuperação coleta os
diagnósticos do lexer antes de encerrar.

Para depuração, `--regra` seleciona uma regra isolada, como `expr` ou `bloco`.
O padrão permanece `programa`. O analisador exige o fim da entrada em todos os
modos, inclusive quando a regra escolhida não contém `EOF` explicitamente.
Os fragmentos de exemplo ficam em `exemplos/fragmentos/`.

Com `--rastrear`, o analisador mostra entradas e saídas de regras e tokens
consumidos com a pilha de contextos do ANTLR. O rastro é emitido durante a
análise e pode ser parcial quando há erro; a árvore só é exibida após o sucesso.

Aceitar a sintaxe não garante que variáveis foram declaradas, que os tipos são
compatíveis, que existe um comando `finalizar` ou que os movimentos fazem sentido.
Essas verificações pertencem à análise semântica e à execução.

Consulte [a aplicação dos conceitos da Aula 10](aula10.md) para ver o vocabulário
formal, uma derivação e exemplos de árvore e precedência na linguagem Amarra.
Consulte também [a aplicação da Aula 11](aula11.md), sobre a pilha do parser,
opcionalidade, recursão à esquerda e depuração de regras.
Consulte a [Aula 12](aula12.md) para relacionar as escolhas do parser com FIRST,
FOLLOW, a precedência das expressões e o `senao` opcional.
Consulte a [Aula 13](aula13.md) para os diagnósticos, o modo pânico e a preparação
do visitor. `gerar.py` gera também `AmarraParserVisitor.py`.
Consulte a [Aula 14](aula14.md) para a AST e as regras semânticas implementadas.

## 9. Regras semânticas e início da E4

`src/construtor_ast.py` transforma a árvore concreta em nós próprios da Amarra.
`src/semantico.py` analisa essa AST e mantém uma pilha de tabelas de símbolos.
O comando sintático continua verificando apenas a estrutura; para verificar
também nomes e tipos, use o comando semântico.

### Nomes e escopos

Variáveis precisam ser declaradas antes de seu uso, inclusive no destino de
atribuições. Uma declaração duplicada no mesmo bloco é rejeitada. Cada bloco
cria um escopo; a busca começa no bloco atual e segue para os externos. Nomes
iguais em blocos internos são permitidos, ocultando temporariamente o externo.
Declarações internas não ficam disponíveis após sair do bloco. Cada `no` tem
variáveis independentes, e os ramos `se` e `senao` não compartilham declarações.

O inicializador é verificado antes de registrar a nova variável. Uma referência
ao próprio nome exige uma declaração anterior visível, por exemplo no bloco
externo. Mesmo blocos de condições constantes falsas são verificados.

Identificadores de pontas são nomes simbólicos próprios dos movimentos, sem
declaração de variável. Assim, `enrolar ponta_esquerda voltas;` exige declarar
`voltas`, mas não `ponta_esquerda`. Não há verificação física dessas referências.

### Compatibilidade e operadores

Declarações e atribuições aceitam tipos iguais ou promoção de `inteiro` para
`real`. Não há conversão implícita nos demais casos. Números com ponto são
reais, mesmo quando a parte fracionária é zero.

| Construção | Operandos exigidos | Resultado |
| :--- | :--- | :--- |
| `+`, `-`, `*` | Números | `real` se algum operando for real, caso contrário `inteiro`. |
| `/` | Números | Sempre `real`. |
| `-` unário | Número | Mesmo tipo do operando. |
| `>`, `<` | Números | `booleano`. |
| `==` | Mesmo tipo ou dois números | `booleano`. |
| `e`, `ou` | Booleanos | `booleano`. |

`+` não concatena textos. Uma condição de `se` exige booleano. `repetir` e
`enrolar` exigem quantidade inteira. `finalizar` exige mensagem de tipo texto.
Por exemplo, `inteiro x = 4 / 2;` é rejeitado porque `/` produz real; use `real`.

### Erros e limites

Os diagnósticos semânticos indicam linha, coluna, código e mensagem: `S001`
para nome ausente, `S002` para duplicidade, `S003` para atribuição incompatível,
`S004` para tipo inadequado em condição/comando e `S005` para operador inválido.
A análise coleta erros independentes e rejeita o programa se houver qualquer um.
Erros léxicos ou sintáticos impedem essa fase; não há análise de AST parcial.

A fase semântica não avalia valores. O interpretador, executado depois dela,
verifica divisão por zero e quantidades negativas durante a execução. A presença
de finalização em todos os caminhos e a correção física de uma sequência de
movimentos não são verificadas. Um programa semanticamente válido pode não
formar um nó correto.

## 10. Execução e interface visual

`src/interpretador.py` avalia a AST validada com escopos e variáveis locais,
preservando a promoção de inteiro para real. As expressões usam a precedência
representada na AST; `e` e `ou` fazem curto-circuito. `se` executa apenas o ramo
selecionado. `repetir` avalia sua quantidade uma vez ao entrar e executa o corpo
essa quantidade de vezes, criando um novo escopo a cada iteração.

Cada comando de movimento gera uma etapa, com posição e valores das variáveis.
Cada volta de `enrolar` gera uma etapa separada. Quantidade zero não gera etapas;
quantidade negativa é rejeitada. `finalizar` registra a mensagem e encerra o nó
atual, inclusive dentro de blocos; outros nós do arquivo podem ser executados.

A interface usa um limite de 300 etapas, 20.000 operações e 20.000 caracteres
de entrada. Erros de execução têm posição e códigos `E001` a `E005`. Não é
entregue um roteiro parcial após erro. A representação visual cobre duas pontas
e identifica as limitações para programas mais gerais. Consulte
[interface-visual.md](interface-visual.md) para os comandos e os detalhes.
