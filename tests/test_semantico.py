"""Nomes, escopos, tipos, diagnosticos e interface do analisador semantico."""

import json
import subprocess
import sys
import unittest
from pathlib import Path

from src.construtor_ast import construir_ast
from src.semantico import AnalisadorSemantico, analisar_semantica
from src.sintatico import analisar, ErroAnalise


RAIZ = Path(__file__).resolve().parent.parent
CASOS = json.loads((RAIZ / "tests/casos_semanticos.json").read_text(encoding="utf-8"))


class TestCasosSemanticos(unittest.TestCase):
    """Cada entrada do corpus tem sintaxe valida e resultado semantico definido."""


def criar_teste(caso):
    def testar(self):
        analisar(caso["codigo"])  # Um erro de sintaxe nao satisfaz o teste semantico.
        if not caso["erros"]:
            resultado = analisar_semantica(caso["codigo"])
            self.assertEqual(resultado.ast.classe, "Programa")
        else:
            with self.assertRaises(ErroAnalise) as contexto:
                analisar_semantica(caso["codigo"])
            erros = contexto.exception.diagnosticos
            self.assertEqual([e.codigo for e in erros], caso["erros"])
            self.assertTrue(all(e.fase == "semantico" for e in erros))
    testar.__doc__ = caso["id"] + ": " + caso["descricao"]
    return testar


for caso in CASOS:
    nome = "test_" + caso["id"]
    if hasattr(TestCasosSemanticos, nome):
        raise ValueError("ID semantico repetido: " + caso["id"])
    if not set(caso["erros"]) <= {"S001", "S002", "S003", "S004", "S005"}:
        raise ValueError("Diagnostico desconhecido: " + caso["id"])
    setattr(TestCasosSemanticos, nome, criar_teste(caso))


class TestAnaliseSemantica(unittest.TestCase):
    def test_todos_os_exemplos_validos(self):
        for arquivo in sorted((RAIZ / "exemplos").glob("*.amr")):
            with self.subTest(arquivo=arquivo.name):
                analisar_semantica(arquivo.read_text(encoding="utf-8"))

    def test_exemplos_semanticos_invalidos_tem_sintaxe_valida(self):
        for arquivo in sorted((RAIZ / "exemplos/invalidos/semantica").glob("*.amr")):
            with self.subTest(arquivo=arquivo.name):
                codigo = arquivo.read_text(encoding="utf-8")
                analisar(codigo)
                with self.assertRaisesRegex(ErroAnalise, "Erro semantico"):
                    analisar_semantica(codigo)

    def test_destino_da_atribuicao_com_posicao_exata(self):
        codigo = 'no "aula" {\n    inteiro x = 10;\n    inteiro y = 20;\n    z = x + y * 2;\n}'
        with self.assertRaises(ErroAnalise) as contexto:
            analisar_semantica(codigo)
        erros = contexto.exception.diagnosticos
        self.assertEqual(len(erros), 1)
        self.assertEqual((erros[0].codigo, erros[0].linha, erros[0].coluna), ("S001", 4, 4))
        self.assertIn("'z'", erros[0].mensagem)

    def test_posicao_de_variavel_em_expressao_e_operador(self):
        for codigo, esperado in [
            ('no "t" {\n    finalizar ausente;\n}', (2, 14)),
            ('no "t" {\n    inteiro x = 1 + verdadeiro;\n}', (2, 18)),
        ]:
            with self.subTest(codigo=codigo):
                with self.assertRaises(ErroAnalise) as contexto:
                    analisar_semantica(codigo)
                erro = contexto.exception.diagnosticos[0]
                self.assertEqual((erro.linha, erro.coluna), esperado)

    def test_redeclaracao_preserva_tipo_da_primeira(self):
        with self.assertRaises(ErroAnalise) as contexto:
            analisar_semantica('no "t" { inteiro x = 1; texto x = "a"; x = 2; }')
        self.assertEqual([e.codigo for e in contexto.exception.diagnosticos], ["S002"])

    def test_tabela_registra_tipo_posicao_e_escopos_distintos(self):
        resultado = analisar_semantica('no "t" { inteiro x = 1; se verdadeiro { texto x = "a"; } }')
        externo, interno = resultado.simbolos
        self.assertEqual((externo.nome, externo.tipo, externo.escopo, externo.definicao),
                         ("x", "inteiro", 1, "t"))
        self.assertEqual((externo.linha, externo.coluna), (1, 17))
        self.assertEqual((interno.nome, interno.tipo, interno.escopo), ("x", "texto", 2))

    def test_multiplos_erros_independentes_sem_cascata(self):
        codigo = (RAIZ / "exemplos/invalidos/semantica/multiplos_erros.amr").read_text(encoding="utf-8")
        with self.assertRaises(ErroAnalise) as contexto:
            analisar_semantica(codigo)
        self.assertEqual([e.codigo for e in contexto.exception.diagnosticos],
                         ["S003", "S002", "S001", "S004", "S004"])

    def test_analise_nao_executa_repeticoes(self):
        # Uma declaracao por bloco, mesmo com uma quantidade enorme de repeticoes.
        resultado = analisar_semantica('no "t" { repetir 999999999999999999999 { inteiro x = 1; } }')
        self.assertEqual(len(resultado.simbolos), 1)

    def test_rejeita_fragmento_na_fase_semantica(self):
        with self.assertRaises(ValueError):
            AnalisadorSemantico().analisar(construir_ast("2 + 3", regra="expr"))

    def test_recuperacao_sintatica_nao_gera_erros_semanticos(self):
        codigo = (RAIZ / "exemplos/invalidos/sintaxe/multiplos_erros.amr").read_text(encoding="utf-8")
        with self.assertRaises(ErroAnalise) as contexto:
            analisar_semantica(codigo, recuperar=True)
        self.assertEqual([e.fase for e in contexto.exception.diagnosticos], ["sintatico"] * 3)

    def test_erro_lexico_impede_analise_semantica(self):
        with self.assertRaises(ErroAnalise) as contexto:
            analisar_semantica('no "t" { x = @; }', recuperar=True)
        self.assertEqual([e.fase for e in contexto.exception.diagnosticos], ["lexico"])


class TestTerminalSemantico(unittest.TestCase):
    def executar(self, *args):
        return subprocess.run([sys.executable, str(RAIZ / "src/semantico.py"), *args],
                              cwd=RAIZ, capture_output=True, text=True, timeout=15)

    def test_sucesso_com_ast_e_simbolos(self):
        resultado = self.executar("exemplos/escopos.amr", "--ast", "--simbolos")
        self.assertEqual(resultado.returncode, 0, resultado.stderr)
        self.assertEqual(resultado.stderr, "")
        for trecho in ("Analise semantica concluida sem erros.", "Arvore sintatica abstrata", "Tabela de simbolos:", "voltas | inteiro"):
            self.assertIn(trecho, resultado.stdout)

    def test_erro_semantico_nao_mostra_ast_ou_sucesso(self):
        resultado = self.executar("exemplos/invalidos/semantica/multiplos_erros.amr", "--ast", "--simbolos")
        self.assertEqual(resultado.returncode, 1)
        self.assertEqual(resultado.stdout, "")
        self.assertEqual(resultado.stderr.count("Erro semantico"), 5)
        self.assertNotIn("Traceback", resultado.stderr)

    def test_erros_sintaticos_e_de_leitura(self):
        for caminho in ("exemplos/invalidos/sintaxe/multiplos_erros.amr", "exemplos/inexistente.amr"):
            with self.subTest(caminho=caminho):
                resultado = self.executar(caminho, "--recuperar")
                self.assertEqual(resultado.returncode, 1)
                self.assertEqual(resultado.stdout, "")
                self.assertNotIn("Traceback", resultado.stderr)

    def test_programa_sem_variaveis(self):
        resultado = self.executar("exemplos/no_simples.amr", "--simbolos")
        self.assertEqual(resultado.returncode, 0, resultado.stderr)
        self.assertIn("nenhuma variavel declarada", resultado.stdout)


if __name__ == "__main__":
    unittest.main()
