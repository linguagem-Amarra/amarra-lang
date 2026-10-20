"""Cada entrada do corpus vira um teste independente, identificado pelo seu ID."""

import json
import unittest
from pathlib import Path

from antlr4 import Token

from src.sintatico import AmarraParser, ErroAnalise, analisar


CAMINHO_CASOS = Path(__file__).with_name("casos_sintaticos.json")
CASOS = json.loads(CAMINHO_CASOS.read_text(encoding="utf-8"))


class TestCasosSintaticos(unittest.TestCase):
    """Aceitação completa da entrada ou rejeição na fase esperada."""


def criar_teste(caso):
    def testar(self):
        codigo = caso["codigo"]
        regra = caso["regra"]
        esperado = caso["resultado"]
        if esperado == "valido":
            arvore, parser = analisar(codigo, regra=regra)
            self.assertEqual(parser.getNumberOfSyntaxErrors(), 0)
            self.assertEqual(parser.getCurrentToken().type, Token.EOF)
            self.assertEqual(parser.ruleNames[arvore.getRuleIndex()], regra)
        else:
            # Um caso sintaticamente inválido deve chegar ao parser: um erro
            # léxico ou uma exceção inesperada não satisfaz esta verificação.
            with self.assertRaisesRegex(
                ErroAnalise,
                rf"^Erro {esperado} na linha [1-9]\d*, coluna \d+: .+",
            ) as contexto:
                analisar(codigo, regra=regra)
            if "posicao" in caso:
                linha, coluna = caso["posicao"]
                self.assertIn(
                    f"na linha {linha}, coluna {coluna}:",
                    str(contexto.exception),
                )

    testar.__doc__ = f'{caso["id"]}: {caso["descricao"]}'
    return testar


# Registrar métodos mantém cada caso visível no unittest -v e permite filtrar
# um ID com -k. IDs repetidos interrompem a descoberta, sem ocultar testes.
for caso in CASOS:
    nome = "test_" + caso["id"]
    if hasattr(TestCasosSintaticos, nome):
        raise ValueError(f'ID de teste repetido: {caso["id"]}')
    if caso["resultado"] not in {"valido", "sintatico", "lexico"}:
        raise ValueError(f'Resultado desconhecido no caso {caso["id"]}')
    if caso["regra"] not in AmarraParser.ruleNames:
        raise ValueError(f'Regra desconhecida no caso {caso["id"]}')
    setattr(TestCasosSintaticos, nome, criar_teste(caso))


if __name__ == "__main__":
    unittest.main()
