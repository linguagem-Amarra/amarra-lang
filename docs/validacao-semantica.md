# Validação da AST e da análise semântica

Data da execução: **04/11/2026**. Ambiente: Windows, Python 3.11.2 e ANTLR 4.13.2.

A implementação da [Aula 14](aula14.md) foi validada com **224 testes, todos
aprovados**. A suíte anterior de 132 testes permanece incluída, verificando
compatibilidade com a análise léxica, a sintática e a recuperação de erros.

## Como reproduzir

Depois de instalar as dependências e gerar os analisadores, execute na raiz:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

No Linux/macOS, use `.venv/bin/python`. Resultado observado na execução completa:

```text
Ran 224 tests in 14.267s

OK
```

| Conjunto | Testes independentes |
| :--- | ---: |
| Suíte anterior: sintaxe, léxico, rastreamento, recuperação e visitor | 132 |
| `test_ast.py`: estrutura, posições, precedência, JSON e terminal | 15 |
| `test_semantico.py`: casos SV01–SV23 válidos | 23 |
| `test_semantico.py`: casos SI01–SI39 inválidos | 39 |
| `test_semantico.py`: verificações adicionais de API e terminal | 15 |
| **Total** | **224** |

Os subtestes internos não aumentam essa contagem. O [relatório sintático
anterior](validacao-sintatica.md) preserva a matriz e a execução da etapa E3.

## Critérios

- A AST preserva precedência, associatividade, comandos e blocos; não contém
  contextos do ANTLR nem nós de pontuação. As posições permanecem disponíveis.
- Cada entrada semântica é primeiro submetida ao parser, que deve aceitá-la.
  Uma falha léxica ou sintática não pode satisfazer um caso de erro semântico.
- Para entradas válidas, a análise deve devolver a AST e a tabela de símbolos.
- Para entradas inválidas, os códigos e a quantidade de diagnósticos precisam
  corresponder exatamente ao resultado esperado. Um `Traceback` não é aceito.
- Testes adicionais verificam posições exatas, escopos, múltiplos erros,
  exemplos existentes, ausência de execução e bloqueio após erro sintático.
- A CLI deve retornar 0 em sucesso ou 1 em erro, com diagnósticos em `stderr`.
  Em erro, não imprime árvore, tabela ou mensagem de sucesso.

## Matriz de entradas semânticas

O código completo está em [casos_semanticos.json](../tests/casos_semanticos.json).
Cada ID corresponde a um teste independente, executado por
[test_semantico.py](../tests/test_semantico.py). Os códigos são: `S001` nome
não declarado, `S002` duplicidade, `S003` atribuição incompatível, `S004` tipo
inadequado em condição/comando e `S005` operador incompatível.

| ID | Cenário | Resultado esperado e obtido |
| :--- | :--- | :--- |
| SV01 | Quatro tipos declarados | Aceito |
| SV02 | Atribuicao usa declaracao anterior | Aceito |
| SV03 | Promocao de inteiro para real | Aceito |
| SV04 | Divisao produz real | Aceito |
| SV05 | Operacoes numericas e sinal | Aceito |
| SV06 | Logica e precedencia | Aceito |
| SV07 | Comparacoes numericas mistas | Aceito |
| SV08 | Igualdade entre textos | Aceito |
| SV09 | Igualdade entre booleanos | Aceito |
| SV10 | Sombreamento em bloco interno | Aceito |
| SV11 | Mesmo nome em blocos irmaos | Aceito |
| SV12 | Atribuicao consulta escopo externo | Aceito |
| SV13 | Declaracao dentro da repeticao | Aceito |
| SV14 | Bloco vazio e permitido | Aceito |
| SV15 | Pontas simbolicas independem de variaveis | Aceito |
| SV16 | Quantidade inteira em expressao | Aceito |
| SV17 | Condicional booleano com dois ramos | Aceito |
| SV18 | Atribuicao promove inteiro | Aceito |
| SV19 | Inicializador ve declaracao externa | Aceito |
| SV20 | Comentarios e texto Unicode | Aceito |
| SV21 | Ponta nao conflita com nome de variavel | Aceito |
| SV22 | Semantica estatica nao executa divisoes | Aceito |
| SV23 | Dois nos possuem tabelas independentes | Aceito |
| SI01 | Destino da atribuicao nao declarado | S001 |
| SI02 | Referencia nao declarada na expressao | S001 |
| SI03 | Uso antes da declaracao | S001 |
| SI04 | Autorreferencia sem declaracao anterior | S001 |
| SI05 | Declaracao repetida no mesmo bloco | S002 |
| SI06 | Redeclaracao interna repetida | S002 |
| SI07 | Texto atribuido a inteiro | S003 |
| SI08 | Real atribuido a inteiro | S003 |
| SI09 | Numero atribuido a texto | S003 |
| SI10 | Booleano atribuido a real | S003 |
| SI11 | Inteiro atribuido a booleano | S003 |
| SI12 | Atribuicao altera tipo declarado | S003 |
| SI13 | Soma de textos nao e concatenacao | S005 |
| SI14 | Multiplicacao com booleano | S005 |
| SI15 | Sinal negativo em booleano | S005 |
| SI16 | Comparacao de ordem entre textos | S005 |
| SI17 | Igualdade de tipos incompativeis | S005 |
| SI18 | Conjuncao com numero | S005 |
| SI19 | Disjuncao com numero | S005 |
| SI20 | Condicao numerica | S004 |
| SI21 | Repeticao com real | S004 |
| SI22 | Repeticao com booleano | S004 |
| SI23 | Enrolar com real | S004 |
| SI24 | Finalizar com numero | S004 |
| SI25 | Variavel ausente no comando | S001 |
| SI26 | Variavel do se nao vaza | S001 |
| SI27 | Variavel do repetir nao vaza | S001 |
| SI28 | Senao nao enxerga declaracao do entao | S001 |
| SI29 | Ambos operandos ausentes sem cascata | S001, S001 |
| SI30 | Divisao exige destino real | S003 |
| SI31 | Nomes diferenciam maiusculas | S001 |
| SI32 | Subtracao com texto | S005 |
| SI33 | Divisao com booleano | S005 |
| SI34 | Comparacao de ordem entre booleanos | S005 |
| SI35 | Enrolar com texto | S004 |
| SI36 | Finalizar com booleano | S004 |
| SI37 | Bloco inacessivel tambem e verificado | S001 |
| SI38 | Tipo interno nao modifica o externo | S004 |
| SI39 | Variavel de um no nao existe em outro | S001 |

Para executar um caso isolado, por exemplo o destino não declarado:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_semantico.py -k SI01 -v
```

## Limites da validação

A análise é estática e verifica nomes e tipos. Não avalia expressões, não
executa repetições nem valida a física dos movimentos. O caso SV22 registra
explicitamente que divisão por zero é assunto da futura execução. Quantidades
negativas e a necessidade de `finalizar` em todos os caminhos também ficam
fora desta etapa. Os nomes das pontas são simbólicos e não são variáveis.

Os casos sintáticos V19/V20 que permitem nomes ausentes ou tipos incompatíveis
continuam sendo testes de sintaxe; o novo comando semântico é o responsável
pela verificação adicional. Consulte as regras completas na
[especificação](especificacao.md#9-regras-semânticas-e-início-da-e4).
