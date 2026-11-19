"""Reconhecimento de procedimentos visuais sobre movimentos já interpretados."""


def reconhecer_no(plano):
    passos = plano["passos"]
    movimentos = passos[:-1] if passos and passos[-1]["acao"] == "finalizar" else passos
    if [p["acao"] for p in movimentos] == ["passar_em", "dar_volta", "meia_volta", "meia_volta", "apertar"]:
        if (movimentos[0]["pontas"] == ["punho"] and movimentos[1]["pontas"] == ["gancho"]
                and movimentos[1]["valor"] == 2 and all(p["pontas"] == ["parte_firme"] for p in movimentos[2:4])):
            return {"id": "hammock-round-turn", "nome": "Volta redonda e duas meias-voltas",
                    "pontaTrabalho": "ponta_trabalho", "passagens": 2, "versao": 1}
    if [p["acao"] for p in movimentos] == ["cruzar", "passar_baixo", "passar_cima", "apertar"]:
        trabalho = movimentos[1]["pontas"][0]
        if movimentos[2]["pontas"] == [trabalho] and trabalho in movimentos[0]["pontas"]:
            return {"id": "figure-eight", "nome": "Nó em oito", "pontaTrabalho": trabalho,
                    "passagens": 1, "versao": 1}
    if [p["acao"] for p in movimentos] != ["cruzar", "passar_baixo", "passar_baixo", "apertar"]:
        return None
    trabalho = movimentos[1]["pontas"][0]
    if movimentos[2]["pontas"] != [trabalho] or trabalho not in movimentos[0]["pontas"]:
        return None
    return {"id": "double-overhand", "nome": "Nó simples duplo", "pontaTrabalho": trabalho,
            "passagens": 2, "versao": 1}
