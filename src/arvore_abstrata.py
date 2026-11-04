"""Nos da AST independentes do ANTLR, conforme o modelo da Aula 14."""

from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class NoAST:
    classe: str
    linha: int
    coluna: int
    campos: Dict[str, Any]

    def filhos(self):
        """Percorre apenas os nos, na ordem dos campos e das listas."""
        for valor in self.campos.values():
            if isinstance(valor, NoAST):
                yield valor
            elif isinstance(valor, list):
                yield from (item for item in valor if isinstance(item, NoAST))

    def para_dict(self):
        def converter(valor):
            if isinstance(valor, NoAST):
                return valor.para_dict()
            if isinstance(valor, list):
                return [converter(item) for item in valor]
            return valor

        return {
            "classe": self.classe, "linha": self.linha, "coluna": self.coluna,
            "campos": {nome: converter(valor) for nome, valor in self.campos.items()},
        }


def formatar_ast(raiz):
    """Exibe campos e filhos sem tokens de pontuacao ou contextos do parser."""
    linhas = []
    pendentes = [(raiz, 0, "")]
    while pendentes:
        no, nivel, papel = pendentes.pop()
        atributos = []
        filhos = []
        for nome, valor in no.campos.items():
            if isinstance(valor, NoAST):
                filhos.append((valor, nivel + 1, nome + ": "))
            elif isinstance(valor, list):
                filhos.extend((filho, nivel + 1, nome + ": ") for filho in valor)
            else:
                atributos.append(f"{nome}={valor!r}")
        rotulo = " ".join([no.classe, *atributos])
        linhas.append("  " * nivel + papel + rotulo)
        pendentes.extend(reversed(filhos))
    return "\n".join(linhas)
