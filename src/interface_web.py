"""Contrato JSON compartilhado pelo navegador e pelos testes locais."""

import json
from dataclasses import asdict

from antlr4 import CommonTokenStream, InputStream, Token

from src.arvore_abstrata import formatar_ast
from src.sintatico import AmarraLexer, ErroAnalise
from src.semantico import analisar_semantica
from src.interpretador import Interpretador


def analisar_interface(codigo):
    if not isinstance(codigo, str) or len(codigo) > 20000:
        return {"ok": False, "diagnosticos": [{"fase": "entrada", "linha": 1, "coluna": 0,
                 "mensagem": "Use um programa com ate 20.000 caracteres."}]}
    try:
        resultado = analisar_semantica(codigo, recuperar=True)
        planos = Interpretador().executar(resultado.ast)
        lexer = AmarraLexer(InputStream(codigo))
        tokens = CommonTokenStream(lexer)
        tokens.fill()
        return {"ok": True, "planos": planos, "ast": resultado.ast.para_dict(),
                "arvore": formatar_ast(resultado.ast),
                "simbolos": [asdict(s) for s in resultado.simbolos],
                "tokens": [{"tipo": lexer.symbolicNames[t.type], "texto": t.text,
                            "linha": t.line, "coluna": t.column}
                           for t in tokens.tokens if t.type != Token.EOF]}
    except ErroAnalise as erro:
        diagnosticos = []
        for item in erro.diagnosticos:
            dados = asdict(item)
            dados["mensagem"] = str(item)
            diagnosticos.append(dados)
        return {"ok": False, "diagnosticos": diagnosticos}
    except (RecursionError, MemoryError):
        return {"ok": False, "diagnosticos": [{"fase": "limite", "linha": 1, "coluna": 0,
                 "mensagem": "Programa muito complexo. Reduza o aninhamento ou as expressoes."}]}


def analisar_json(codigo):
    return json.dumps(analisar_interface(codigo), ensure_ascii=False, allow_nan=False)
