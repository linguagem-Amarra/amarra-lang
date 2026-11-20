"""Exemplos usados pela API local e pela publicação estática."""

from pathlib import Path


EXEMPLOS = (
    ("no_simples", "Nó simples", "O primeiro encontro entre duas pontas.", "01"),
    ("no_simples_duplo", "Nó reforçado", "Nó simples duplo: duas passagens pelo mesmo laço.", "02"),
    ("no_simples_triplo", "Nó simples triplo", "Três passagens pelo laço antes do aperto.", "03"),
    ("no_oito", "Nó em oito", "Nó de parada: contorne o ramo e passe pelo laço.", "04"),
    ("no_reforcado", "Reforço com voltas", "Cadarço com duas voltas adicionais.", "05"),
    ("no_windsor", "Windsor", "Explore a sequência do nó de gravata.", "06"),
    ("no_rede", "Nó para rede de dormir", "Volta redonda e duas meias-voltas no armador.", "07"),
    ("no_ancora_rede", "Nó de âncora para rede", "Passe a ponta sob a volta antes da meia-volta final.", "08"),
)


def listar_exemplos(raiz: Path):
    return [{"id": ident, "nome": nome, "descricao": descricao, "numero": numero,
             "codigo": (raiz / "exemplos" / (ident + ".amr")).read_text(encoding="utf-8")}
            for ident, nome, descricao, numero in EXEMPLOS]
