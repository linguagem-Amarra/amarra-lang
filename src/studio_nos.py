"""Reconhecimento de procedimentos visuais sobre movimentos já interpretados."""


def reconhecer_no(plano):
    passos = plano["passos"]
    movimentos = passos[:-1] if passos and passos[-1]["acao"] == "finalizar" else passos
    if [p["acao"] for p in movimentos] != ["cruzar", "passar_baixo", "passar_baixo", "apertar"]:
        return None
    trabalho = movimentos[1]["pontas"][0]
    if movimentos[2]["pontas"] != [trabalho] or trabalho not in movimentos[0]["pontas"]:
        return None
    return {"id": "double-overhand", "nome": "Nó simples duplo", "pontaTrabalho": trabalho,
            "passagens": 2, "versao": 1}
