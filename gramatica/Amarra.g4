grammar Amarra;

// ---- LEXER: MAIUSCULAS ----

// Palavras-chave de comando (precisam vir antes de IDENT)
NO            : 'no' ;
CRUZAR        : 'cruzar' ;
PASSAR_BAIXO  : 'passar_baixo' ;
PASSAR_CIMA   : 'passar_cima' ;
ENROLAR       : 'enrolar' ;
APERTAR       : 'apertar' ;
REPETIR       : 'repetir' ;
SE            : 'se' ;
FINALIZAR     : 'finalizar' ;

// Palavras-chave de tipo
TIPO_INTEIRO  : 'inteiro' ;
TIPO_REAL     : 'real' ;
TIPO_TEXTO    : 'texto' ;
TIPO_BOOLEANO : 'booleano' ;

// Literais booleanos
VERDADEIRO : 'verdadeiro' ;
FALSO      : 'falso' ;

// Operadores
MAIS    : '+' ;
MENOS   : '-' ;
VEZES   : '*' ;
DIVISAO : '/' ;
MAIOR   : '>' ;
MENOR   : '<' ;
IGUAL   : '==' ;
ATRIB   : '=' ;

// Delimitadores
ABRE_CHAVE  : '{' ;
FECHA_CHAVE : '}' ;
PONTOVIRG   : ';' ;

// Identificadores e literais (vêm depois das palavras-chave)
IDENT  : [a-zA-Z_][a-zA-Z_0-9]* ;
NUMERO : [0-9]+ ('.' [0-9]+)? ;
TEXTO  : '"' ~["\r\n]* '"' ;

// Descartáveis
COMENT : '//' ~[\r\n]* -> skip ;
ESPACO : [ \t\r\n]+ -> skip ;
