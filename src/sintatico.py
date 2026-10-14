"""Analisa um programa Amarra e apresenta sua arvore sintatica concreta.

Uso: python src/sintatico.py exemplos/no_simples.amr
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from antlr4 import CommonTokenStream, InputStream, Token
    from antlr4.error.ErrorListener import ErrorListener
    from antlr4.tree.Tree import TerminalNode
except ModuleNotFoundError as erro:
    if erro.name != "antlr4":
        raise
    sys.exit(
        "Biblioteca antlr4 ausente. Use o Python do ambiente .venv e instale "
        "as dependencias com: python -m pip install -r requirements.txt"
    )

try:
    from gerado.AmarraLexer import AmarraLexer
    from gerado.AmarraParser import AmarraParser
except ModuleNotFoundError as erro:
    if erro.name not in {"gerado", "gerado.AmarraLexer", "gerado.AmarraParser"}:
        raise
    sys.exit("Analisadores nao gerados. Na raiz do projeto, execute: python gerar.py")

from src.rastreamento import RastreadorPilha, formatar_evento


class ErroAnalise(ValueError):
    """Erro lexico ou sintatico com a localizacao no programa de entrada."""


class ErroAnaliseListener(ErrorListener):
    def __init__(self, fase):
        super().__init__()
        self.fase = fase

    def syntaxError(self, recognizer, offendingSymbol, line, column, msg, e):
        # Interrompe antes de o ANTLR recuperar o erro e produzir uma arvore parcial.
        raise ErroAnalise(
            f"Erro {self.fase} na linha {line}, coluna {column}: {msg}"
        )


def analisar(codigo, regra="programa", registrar=None):
    """Analisa toda a entrada pela regra escolhida; registrar recebe eventos opcionais."""
    if regra not in AmarraParser.ruleNames:
        raise ValueError(f"Regra desconhecida: {regra}")

    lexer = AmarraLexer(InputStream(codigo))
    lexer.removeErrorListeners()
    lexer.addErrorListener(ErroAnaliseListener("lexico"))

    tokens = CommonTokenStream(lexer)
    tokens.fill()
    tokens.seek(0)

    parser = AmarraParser(tokens)
    parser.removeErrorListeners()
    parser.addErrorListener(ErroAnaliseListener("sintatico"))
    if registrar is not None:
        parser.addParseListener(RastreadorPilha(parser, registrar))

    arvore = getattr(parser, regra)()
    # As regras isoladas nao incluem EOF; confira tambem o restante do arquivo.
    token = parser.getCurrentToken()
    if token.type != Token.EOF:
        parser.notifyErrorListeners(f"extraneous input {token.text!r} expecting <EOF>")
    return arvore, parser


def formatar_arvore(arvore, parser):
    """Mostra regras nos nos internos e tipos/textos dos tokens nas folhas."""
    linhas = []
    pendentes = [(arvore, 0)]
    while pendentes:
        no, nivel = pendentes.pop()
        if isinstance(no, TerminalNode):
            token = no.getSymbol()
            nome = "EOF" if token.type == Token.EOF else parser.symbolicNames[token.type]
            rotulo = f"{nome} {token.text!r}"
        else:
            rotulo = parser.ruleNames[no.getRuleIndex()]
            pendentes.extend((filho, nivel + 1) for filho in reversed(list(no.getChildren())))
        linhas.append("  " * nivel + rotulo)
    return "\n".join(linhas)


def main(argv=None):
    argumentos = argparse.ArgumentParser(
        description="Valida a sintaxe de um programa Amarra e mostra sua arvore."
    )
    argumentos.add_argument("arquivo", type=Path, help="programa ou fragmento salvo em UTF-8")
    argumentos.add_argument(
        "--regra", choices=AmarraParser.ruleNames, default="programa",
        help="regra inicial para depurar um fragmento (padrao: programa)",
    )
    argumentos.add_argument(
        "--rastrear", action="store_true",
        help="mostra entradas, saidas e consumo de tokens com a pilha de contextos",
    )
    argumentos.add_argument(
        "--formato", choices=("indentado", "lisp"), default="indentado",
        help="formato da arvore (padrao: indentado)",
    )
    args = argumentos.parse_args(argv)

    def registrar(evento):
        print(formatar_evento(evento), file=sys.stderr)

    try:
        codigo = args.arquivo.read_text(encoding="utf-8")
        arvore, parser = analisar(
            codigo, regra=args.regra, registrar=registrar if args.rastrear else None,
        )
    except (OSError, UnicodeError) as erro:
        print(f"Nao foi possivel ler '{args.arquivo}': {erro}", file=sys.stderr)
        return 1
    except ErroAnalise as erro:
        print(erro, file=sys.stderr)
        return 1

    print("Analise sintatica concluida sem erros.")
    print("Arvore sintatica:")
    if args.formato == "lisp":
        print(arvore.toStringTree(recog=parser))
    else:
        print(formatar_arvore(arvore, parser))
    return 0


if __name__ == "__main__":
    sys.exit(main())
