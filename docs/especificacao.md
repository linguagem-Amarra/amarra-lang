# Especificação da linguagem Amarra

## 1. Para que serve

Amarra é uma linguagem para descrever, passo a passo, como amarrar nós (cadarços,
gravatas e nós náuticos simples). Um programa em Amarra é uma sequência de comandos.
A proposta é produzir um roteiro de montagem do nó e validar a ordem lógica dos
movimentos quando a etapa de execução for implementada.

Na implementação atual (E3), os analisadores reconhecem os tokens, validam a
sintaxe e produzem uma árvore sintática concreta. A análise de tipos, a validação
da sequência de movimentos e a execução dos comandos ficam para E4.

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

Os nomes `e` e `ou` passam a ser palavras reservadas. Nomes maiores como
`enrolar`, `esquerda` e `outra_ponta` continuam sendo reconhecidos normalmente.

## 6. Comentários

Comentários de linha começam com `//` e vão até o fim da linha. Não há comentários
de bloco — mantém a gramática do lexer simples e evita ambiguidade com outros símbolos.

## 7. Três coisas que a linguagem deliberadamente não faz

1. **Não simula física real do nó** (tensão, atrito, material do cadarço) — só valida a
   ordem lógica dos movimentos, não o resultado mecânico real.
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
| `condicional` | `se` seguido de uma expressão e um bloco. |
| `expr` | Literais, identificadores, agrupamentos e operações da seção 5. |

Declarações, atribuições e comandos terminam com `;`. Os blocos de `repetir` e
`se` terminam com `}` e não recebem `;` depois da chave. Eles podem conter novos
blocos de `repetir` e `se`. A definição de um `no` dentro de outro não é permitida.

Os argumentos de `cruzar`, `passar_baixo` e `passar_cima` são identificadores de
pontas. `enrolar` recebe um identificador de ponta e uma expressão para a
quantidade de voltas. `finalizar` recebe uma expressão, como um literal de texto
ou o nome de uma variável. A compatibilidade dos tipos será verificada em E4.

O parser encerra no primeiro erro, informando linha (a partir de 1) e coluna
(a partir de 0). Ele só apresenta a árvore quando o arquivo inteiro foi aceito.
O comando `src/sintatico.py` também detecta erros léxicos antes da análise sintática.

Aceitar a sintaxe não garante que variáveis foram declaradas, que os tipos são
compatíveis, que existe um comando `finalizar` ou que os movimentos fazem sentido.
Essas verificações pertencem à análise semântica e à execução.

Consulte [a aplicação dos conceitos da Aula 10](aula10.md) para ver o vocabulário
formal, uma derivação e exemplos de árvore e precedência na linguagem Amarra.
