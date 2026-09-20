"""
lexico.py - le um programa em Amarra e imprime os tokens reconhecidos.

Uso:
    python src/lexico.py exemplos/no_simples.amr
"""

import sys
import os

# permite importar o pacote gerado/ (código do ANTLR) a partir da raiz do repo
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    from antlr4 import FileStream, CommonTokenStream
    from antlr4.error.ErrorListener import ErrorListener
except ModuleNotFoundError as erro:
    if erro.name != "antlr4":
        raise
    sys.exit(
        "Biblioteca antlr4 ausente. Use o Python do ambiente .venv e instale "
        "as dependencias com: python -m pip install -r requirements.txt"
    )

try:
    from gerado.AmarraLexer import AmarraLexer
except ModuleNotFoundError as erro:
    if erro.name not in {"gerado", "gerado.AmarraLexer"}:
        raise
    sys.exit("Lexer nao gerado. Na raiz do projeto, execute: python gerar.py")


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

    try:
        entrada = FileStream(caminho, encoding="utf-8")
    except OSError as erro:
        sys.exit(f"Nao foi possivel abrir '{caminho}': {erro.strerror}")
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
