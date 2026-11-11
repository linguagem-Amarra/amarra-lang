"""Contrato do compilador do Studio compartilhado pela API e pelo navegador."""

import json

from src.diagnosticos import ErroAnalise
from src.studio_nos import reconhecer_no
from src.studio_plano import FalhaStudio, compilar


def analisar(codigo, selecionado=0):
    try:
        plano = compilar(codigo, selecionado)
        animacao = reconhecer_no(plano)
        if animacao is not None:
            plano["animacao"] = animacao
        return plano
    except ErroAnalise as erro:
        return {"versao": 1, "ok": False, "passos": [], "diagnosticos": [
            {"fase": item.fase, "linha": item.linha, "coluna": item.coluna,
             "mensagem": str(item), "esperados": item.esperados, "encontrado": item.encontrado}
            for item in erro.diagnosticos
        ]}
    except FalhaStudio as erro:
        return {"versao": 1, "ok": False, "passos": [], "nos": erro.nos or [], "diagnosticos": [
            {"fase": "semantico", "mensagem": str(erro), **erro.origem}
        ]}
    except (RecursionError, OverflowError, ValueError):
        return {"versao": 1, "ok": False, "passos": [], "diagnosticos": [
            {"fase": "limite", "linha": 1, "coluna": 0,
             "mensagem": "A entrada excede os limites de profundidade ou tamanho numérico do Studio."}
        ]}


def analisar_json(codigo, selecionado=0):
    return json.dumps(analisar(codigo, selecionado), ensure_ascii=False, allow_nan=False)
