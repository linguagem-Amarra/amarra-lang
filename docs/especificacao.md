# Especificação da linguagem Amarra

## 1. Para que serve

Amarra é uma linguagem para descrever, passo a passo, como amarrar nós (cadarços,
gravatas e nós náuticos simples). Um programa em Amarra é uma sequência de comandos que,
ao ser executada, produz o roteiro de montagem do nó e valida se a sequência de movimentos
é fisicamente possível.

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
| `finalizar "mensagem"` | Encerra a definição do nó e imprime a mensagem |

## 5. Operadores e precedência

Da maior para a menor precedência:

1. `*`, `/` — multiplicação e divisão (usados em cálculos de voltas)
2. `+`, `-` — soma e subtração
3. `>`, `<`, `==` — comparações (usadas em `se`)
4. `=` — atribuição

Exemplo: `voltas = base + 1 * 2` avalia `1 * 2` primeiro, depois a soma, depois atribui.

## 6. Comentários

Comentários de linha começam com `//` e vão até o fim da linha. Não há comentários
de bloco — mantém a gramática do lexer simples e evita ambiguidade com outros símbolos.

## 7. Três coisas que a linguagem deliberadamente não faz

1. **Não simula física real do nó** (tensão, atrito, material do cadarço) — só valida a
   ordem lógica dos movimentos, não o resultado mecânico real.
2. **Não permite funções definidas pelo usuário nem recursão** — cada nó é descrito de forma
   linear e plana; reuso é feito copiando ou usando `repetir`, nunca chamando um nó dentro do outro.
3. **Não corrige nem desfaz passos** — não existe comando "desamarrar" ou "voltar"; um erro de
   sequência é reportado como erro de execução, não corrigido automaticamente.
