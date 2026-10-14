"""Gera o lexer e o parser no Windows, Linux ou macOS: python gerar.py."""

import sys
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path


def main():
    try:
        import antlr4_tool_runner

        versao = version("antlr4-python3-runtime")
    except (ModuleNotFoundError, PackageNotFoundError):
        print(
            "Dependencias ausentes. Instale com o mesmo Python usado neste comando:\n"
            "python -m pip install -r requirements.txt",
            file=sys.stderr,
        )
        return 1

    raiz = Path(__file__).resolve().parent
    saida = raiz / "gerado"
    saida.mkdir(exist_ok=True)
    # Usa a mesma versao do runtime e grava diretamente em gerado/.
    sys.argv = [
        "antlr4",
        "-v", versao,
        "-Dlanguage=Python3",
        "-no-listener",
        "-encoding", "UTF-8",
        "-Xexact-output-dir",
        "-o", str(saida),
        "-lib", str(saida),
        str(raiz / "gramatica" / "AmarraLexer.g4"),
        str(raiz / "gramatica" / "AmarraParser.g4"),
    ]
    antlr4_tool_runner.tool()


if __name__ == "__main__":
    sys.exit(main())
