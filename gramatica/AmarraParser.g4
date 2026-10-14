parser grammar AmarraParser;

options { tokenVocab = AmarraLexer; }

// Regra inicial: consome o arquivo inteiro, inclusive o fim da entrada.
programa : definicaoNo+ EOF ;

definicaoNo : NO TEXTO bloco ;
bloco : ABRE_CHAVE instrucao* FECHA_CHAVE ;

instrucao
    : declaracao PONTOVIRG
    | atribuicao PONTOVIRG
    | comando PONTOVIRG
    | repeticao
    | condicional
    ;

declaracao : tipo IDENT ATRIB expr ;
atribuicao : IDENT ATRIB expr ;
tipo : TIPO_INTEIRO | TIPO_REAL | TIPO_TEXTO | TIPO_BOOLEANO ;

comando
    : CRUZAR IDENT IDENT
    | PASSAR_BAIXO IDENT
    | PASSAR_CIMA IDENT
    | ENROLAR IDENT expr
    | APERTAR
    | FINALIZAR expr
    ;

// A recursao bloco -> instrucao -> repeticao/condicional -> bloco
// permite repetir e se aninhados.
repeticao : REPETIR expr bloco ;
condicional : SE expr bloco ;

// Nas alternativas recursivas, a ordem determina a precedencia no ANTLR.
// Operadores do mesmo grupo associam a esquerda.
expr
    : ABRE_PAREN expr FECHA_PAREN       # agrupada
    | MENOS expr                        # sinal
    | expr op=(VEZES | DIVISAO) expr     # multiplicativa
    | expr op=(MAIS | MENOS) expr        # aditiva
    | expr op=(MAIOR | MENOR | IGUAL) expr # comparacao
    | expr E expr                       # conjuncao
    | expr OU expr                      # disjuncao
    | NUMERO                            # numero
    | TEXTO                             # texto
    | (VERDADEIRO | FALSO)               # booleano
    | IDENT                             # identificador
    ;
