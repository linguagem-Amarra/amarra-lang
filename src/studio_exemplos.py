"""Exemplos usados pela API local e pela publicação estática."""

from pathlib import Path


EXEMPLOS = (
    ("no_simples", "Nó simples", "O primeiro encontro entre duas pontas.", "01"),
    ("no_simples_duplo", "Nó reforçado", "Nó simples duplo: duas passagens pelo mesmo laço.", "02"),
    ("no_windsor", "Windsor", "Explore a sequência do nó de gravata.", "03"),
)


def listar_exemplos(raiz: Path):
    return [{"id": ident, "nome": nome, "descricao": descricao, "numero": numero,
             "codigo": (raiz / "exemplos" / (ident + ".amr")).read_text(encoding="utf-8")}
            for ident, nome, descricao, numero in EXEMPLOS]
