"""
lexico.py - le um programa em Amarra e imprime os tokens reconhecidos.

Uso:
    python src/lexico.py exemplos/no_simples.amr
"""

import sys
import os

# permite importar o pacote gerado/ (código do ANTLR) a partir da raiz do repo
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from antlr4 import FileStream, CommonTokenStream
from antlr4.error.ErrorListener import ErrorListener
from gerado.AmarraLexer import AmarraLexer


class ErroLexicoListener(ErrorListener):
    """Reporta caracteres não reconhecidos apontando linha e coluna."""

    def syntaxError(self, recognizer, offendingSymbol, line, column, msg, e):
        print(f"Erro lexico na linha {line}, coluna {column}: {msg}")
        sys.exit(1)


def main():
    if len(sys.argv) != 2:
        print("uso: python src/lexico.py <arquivo.amr>")
        sys.exit(1)

    caminho = sys.argv[1]

    entrada = FileStream(caminho, encoding="utf-8")
    lexer = AmarraLexer(entrada)

    lexer.removeErrorListeners()
    lexer.addErrorListener(ErroLexicoListener())

    stream = CommonTokenStream(lexer)
    stream.fill()

    total = 0
    for token in stream.tokens:
        if token.type == -1:  # EOF
            continue
        nome = AmarraLexer.symbolicNames[token.type]
        print(f"{nome} '{token.text}' linha {token.line}")
        total += 1

    print(f"{total} tokens reconhecidos")


if __name__ == "__main__":
    main()
