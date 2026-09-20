# Diário de bordo

## 09/09

Criamos a ideia principal da linguagem **Amarra**, definindo como domínio as instruções para realizar diferentes tipos de nós, inicialmente com foco em nós de cadarço e gravata. A proposta surgiu a partir da ideia de criar uma linguagem capaz de representar uma sequência de ações para realizar um nó, de forma semelhante ao exemplo de uma linguagem utilizada para comandar um robô.

Também estabelecemos as principais características da linguagem, definindo que ela deveria possuir comandos relacionados aos movimentos necessários para realizar os nós, permitir a identificação do tipo de nó e possibilitar a representação de informações como medidas e descrições durante o processo.

## 16/09

Configuramos o ambiente de desenvolvimento do projeto e instalamos o **ANTLR4**, ferramenta que será utilizada para definir a gramática e gerar o analisador léxico da linguagem **Amarra**. Também verificamos o funcionamento da ferramenta e preparamos o projeto para iniciar a implementação da gramática.

## 20/09

Definimos o domínio: instruções para amarrar nós (cadarço e gravata), inspirado no exemplo de "desenho" do enunciado (robô que executa comandos). Descartamos a ideia original de somente *reconhecer* se uma sequência de movimentos forma um nó válido, porque isso seria um autômato de reconhecimento, e não uma linguagem de programação que executa algo — o projeto pede uma linguagem que comanda, não apenas valida.

Montamos a especificação (`docs/especificacao.md`) e a gramática do lexer (`gramatica/Amarra.g4`). No meio do caminho, percebemos que a especificação inicial excluía números reais, mas o enunciado exige que o lexer reconheça inteiros e reais no mínimo. Corrigimos adicionando o tipo `real`, utilizado para representar medidas, como o comprimento da ponta do cadarço em centímetros.
