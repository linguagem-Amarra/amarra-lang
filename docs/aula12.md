# Aula 12 aplicada à Amarra: escolhas, FIRST e FOLLOW

Material de referência: **Aula12 - Analise descendente-2 (3).pdf**,
“Por que a ordem importa — Como o parser escolhe entre duas alternativas”,
Encontro 12, de 14/10. Conferência do projeto realizada em **21/10/2026**.

Os comportamentos abordados nessa aula já estavam presentes na gramática e
nos testes das etapas anteriores. Esta revisão documenta a relação com FIRST
e FOLLOW; não acrescenta regras à linguagem nem outro analisador.

## Comparação com o projeto

| Conceito da aula | Onde aparece na Amarra | Evidência existente |
| :--- | :--- | :--- |
| Escolha olhando o próximo token | Alternativas de `instrucao`, `comando` e bases de `expr`. | O método gerado `instrucao()` consulta `LA(1)` e seleciona a regra correspondente. |
| FIRST: o que pode começar uma construção | Tipos iniciam declarações; identificadores iniciam atribuições; palavras de comando iniciam suas instruções. | [AmarraParser.g4](../gramatica/AmarraParser.g4). |
| Ordem e precedência | Multiplicação/divisão aparecem antes de soma/subtração nas alternativas recursivas de `expr`. | Testes de precedência em [test_sintatico.py](../tests/test_sintatico.py). |
| Alternativa vazia | `(SENAO bloco)?` pode estar ausente. | Testes de condicionais em [test_condicionais_regras_rastreamento.py](../tests/test_condicionais_regras_rastreamento.py). |
| FOLLOW: o que pode vir depois | Depois de uma condicional dentro de um bloco pode vir outra instrução ou a chave que fecha esse bloco. | Caso V15 da [coleção de entradas](../tests/casos_sintaticos.json) e regras `bloco`/`instrucao`. |

## FIRST na nossa gramática

FIRST reúne os tokens que podem iniciar uma sequência derivada de uma regra.
Se a sequência puder ser vazia, também se considera a possibilidade de vazio,
representada por `ε`. Isso não cria um token no arquivo de entrada.

Para as alternativas de `instrucao`, os inícios são distintos:

| Alternativa | Tokens que podem iniciá-la |
| :--- | :--- |
| `declaracao PONTOVIRG` | `inteiro`, `real`, `texto`, `booleano` |
| `atribuicao PONTOVIRG` | `IDENT` |
| `comando PONTOVIRG` | `cruzar`, `passar_baixo`, `passar_cima`, `enrolar`, `apertar`, `finalizar` |
| `repeticao` | `repetir` |
| `condicional` | `se` |

Assim, ao encontrar `inteiro`, o parser entra em uma declaração. Ao encontrar
`repetir`, entra em uma repetição. As palavras reservadas têm tokens próprios;
não são confundidas com `IDENT`.

Uma expressão pode começar com `(`, `-`, `NUMERO`, `TEXTO`, `verdadeiro`,
`falso` ou `IDENT`. Esses são os elementos de FIRST(`expr`) para a Amarra.
Nas alternativas recursivas `expr '*' expr` e `expr '+' expr`, os conjuntos
iniciais se sobrepõem; reconhecer o primeiro operando não resolve a precedência.

## Por que a ordem das operações já está correta

O trecho da gramática responsável pelos dois primeiros grupos binários é:

```antlr
| expr op=(VEZES | DIVISAO) expr      # multiplicativa
| expr op=(MAIS | MENOS) expr         # aditiva
```

Na transformação dessa regra com recursão à esquerda direta, o ANTLR atribui
maior precedência ao primeiro grupo. Por isso, a árvore de `2 + 3 * 4` tem
a soma na raiz e a multiplicação como seu filho direito: `2 + (3 * 4)`.
O teste `test_multiplicacao_tem_precedencia_sobre_soma` verifica esses contextos
na árvore, sem precisar executar a expressão.

O projeto também testa parênteses, menos unário, associatividade à esquerda,
comparações e operadores lógicos. Os valores 14 e 20 usados nos slides ilustram
o efeito de mudar a estrutura; o analisador da Amarra ainda não calcula esses valores.

Nos exemplos simples, olhar um token é suficiente. O ANTLR 4 também utiliza
predição adaptativa, capaz de examinar mais entrada quando necessário. No código
gerado de `expr`, aparecem `adaptivePredict()` e `precpred()`. Portanto,
conjuntos FIRST sobrepostos não provam, sozinhos, que toda a gramática é ambígua,
nem significam que o gerador sempre escolhe uma alternativa sem examinar o restante.

## FOLLOW e o senao opcional

A regra já existente é:

```antlr
condicional : SE expr bloco (SENAO bloco)? ;
```

O grupo opcional aceita `senao` seguido de um bloco ou aceita vazio. Se houver
`SENAO`, o parser deve reconhecer também o bloco alternativo. Se não houver,
o símbolo seguinte ainda precisa fazer sentido no contexto que contém a condicional.

Considerando programas completos, a relação é:

```text
FOLLOW(condicional) = FIRST(instrucao) unido a { FECHA_CHAVE }
```

Isso decorre de `bloco : ABRE_CHAVE instrucao* FECHA_CHAVE`: a próxima coisa
pode ser outra instrução ou `}`. Por exemplo:

```amarra
no "escolha" {
    se verdadeiro { apertar; }
    finalizar "pronto";
}
```

O `senao` está ausente, e `finalizar` inicia a próxima instrução. Também é válido
fechar o bloco imediatamente após a condicional. Já `se verdadeiro {} + 1;`
dentro de um nó é inválido: `+` não inicia uma instrução.

O `EOF` não substitui a chave de fechamento do nó. Ao usar `--regra condicional`,
um fragmento pode terminar em `EOF` depois do próprio `se`; isso corresponde
à regra escolhida como entrada isolada, e não ao contexto de um programa completo.

Não há um calculador próprio de conjuntos FIRST/FOLLOW no projeto. A tabela e
a relação acima explicam a gramática; as decisões de reconhecimento são feitas
pelo código gerado e pelo runtime do ANTLR.

## Verificação realizada

Foram executados novamente os três testes de precedência selecionados por nome
e os quatro testes da classe `TestCondicional`: **7 testes passaram**.

No Windows, a partir da raiz do projeto:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_sintatico.py -k precedencia -v
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_condicionais_regras_rastreamento.py -k TestCondicional -v
```

No Linux/macOS, substitua o executável por `.venv/bin/python`.
A suíte continua com 132 testes; esta revisão acrescenta documentação, sem
criar testes duplicados ou alterar a gramática. A continuação conceitual está
na [Aula 13](aula13.md), sobre diagnósticos, recuperação e preparação do visitor.
