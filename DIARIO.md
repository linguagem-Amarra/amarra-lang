# Diário de bordo

## 20/09
Definimos o domínio: instruções para amarrar nós (cadarço e gravata), inspirado
no exemplo de "desenho" do enunciado (robô que executa comandos). Descartamos a
ideia original de só *reconhecer* se uma sequência de movimentos forma um nó
válido, porque isso seria um autômato de reconhecimento, não uma linguagem de
programação que executa algo — o projeto pede uma linguagem que comanda, não só
valida.

Montamos a especificação (`docs/especificacao.md`) e a gramática do lexer
(`gramatica/Amarra.g4`). No meio do caminho percebemos que a especificação
inicial excluía números reais, mas o enunciado exige que o lexer reconheça
inteiros e reais no mínimo — corrigimos adicionando o tipo `real`, usado para
medir o comprimento da ponta em centímetros.
