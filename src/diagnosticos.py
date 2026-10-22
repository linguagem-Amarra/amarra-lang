"""Diagnosticos com localizacao, simbolos esperados e entrada encontrada."""

from dataclasses import dataclass
from typing import Tuple

from antlr4 import Token
from antlr4.error.ErrorListener import ErrorListener


@dataclass(frozen=True)
class Diagnostico:
    fase: str
    linha: int
    coluna: int
    esperados: Tuple[str, ...]
    encontrado: str

    def __str__(self):
        esperado = " ou ".join(self.esperados)
        return (
            f"Erro {self.fase} na linha {self.linha}, coluna {self.coluna}: "
            f"esperava {esperado}; encontrou {self.encontrado}"
        )


class ErroAnalise(ValueError):
    """Um ou mais diagnosticos; nunca representa uma arvore aceita."""

    def __init__(self, diagnosticos):
        self.diagnosticos = tuple(diagnosticos)
        super().__init__("\n".join(str(item) for item in self.diagnosticos))


def nome_token(parser, tipo):
    if tipo == Token.EOF:
        return "fim da entrada (EOF)"
    nomes = {
        "IDENT": "identificador",
        "NUMERO": "numero",
        "TEXTO": "texto entre aspas",
    }
    simbolico = parser.symbolicNames[tipo]
    if simbolico in nomes:
        return nomes[simbolico]
    return parser.literalNames[tipo]


def erro_sintatico(parser, token, esperados):
    return Diagnostico(
        fase="sintatico", linha=token.line, coluna=token.column,
        esperados=tuple(nome_token(parser, tipo) for tipo in esperados),
        encontrado="fim da entrada (EOF)" if token.type == Token.EOF else repr(token.text),
    )


class ErroAnaliseListener(ErrorListener):
    def __init__(self, fase, coletar=None):
        super().__init__()
        self.fase = fase
        self.coletar = coletar

    def syntaxError(self, recognizer, offendingSymbol, line, column, msg, e):
        if self.fase == "lexico":
            # Mesmos limites usados pelo Lexer.notifyListeners do ANTLR.
            entrada = recognizer.inputStream
            trecho = entrada.getText(recognizer._tokenStartCharIndex, entrada.index)
            diagnostico = Diagnostico(
                "lexico", line, column, ("um token valido",), repr(trecho),
            )
        else:
            esperados = e.getExpectedTokens() if e is not None else None
            if esperados is None:
                esperados = recognizer.getExpectedTokens()
            diagnostico = erro_sintatico(recognizer, offendingSymbol, esperados)
        if self.coletar is not None:
            self.coletar(diagnostico)
        else:
            # Desempilha ate o limite da instrucao no modo de recuperacao.
            raise ErroAnalise([diagnostico])
