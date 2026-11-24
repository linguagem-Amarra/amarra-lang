"""Verifica a AST efetiva, a precedencia e a interface de exibicao."""

import json
import subprocess
import sys
import unittest
from pathlib import Path

from src.arvore_abstrata import NoAST, formatar_ast
from src.construtor_ast import construir_ast
from src.sintatico import analisar, ErroAnalise


RAIZ = Path(__file__).resolve().parent.parent


def forma(no):
    if no.classe == "Op":
        return (no.campos["operador"], forma(no.campos["esquerda"]), forma(no.campos["direita"]))
    if no.classe == "Unario":
        return ("unario", forma(no.campos["valor"]))
    return no.campos.get("valor", no.campos.get("nome"))


class TestAST(unittest.TestCase):
    def test_precedencia_gera_a_estrutura_da_aula(self):
        ast = construir_ast("x + y * 2", regra="expr")
        self.assertEqual(forma(ast), ("+", "x", ("*", "y", "2")))

    def test_parenteses_somem_mas_alteram_a_estrutura(self):
        ast = construir_ast("(2 + 3) * 4", regra="expr")
        self.assertEqual(forma(ast), ("*", ("+", "2", "3"), "4"))
        self.assertEqual(forma(construir_ast("(((2)))", regra="expr")), "2")

    def test_associatividade_e_unario(self):
        self.assertEqual(forma(construir_ast("8 - 3 - 1", regra="expr")),
                         ("-", ("-", "8", "3"), "1"))
        self.assertEqual(forma(construir_ast("-2 * 3", regra="expr")),
                         ("*", ("unario", "2"), "3"))
        self.assertEqual(forma(construir_ast("8 / 4 / 2", regra="expr")),
                         ("/", ("/", "8", "4"), "2"))

    def test_comparacao_conjuncao_disjuncao(self):
        self.assertEqual(forma(construir_ast("1 + 2 > 0 e verdadeiro ou falso", regra="expr")),
                         ("ou", ("e", (">", ("+", "1", "2"), "0"), True), False))
        self.assertEqual(forma(construir_ast("x < y == verdadeiro", regra="expr")),
                         ("==", ("<", "x", "y"), True))

    def test_literais_preservam_conteudo_e_precisao(self):
        for codigo, classe, valor in [
            ('"nó pronto"', "Texto", "nó pronto"),
            (r'"a\nb"', "Texto", r"a\nb"),
            ("falso", "Booleano", False),
            ("123456789.123456789", "Num", "123456789.123456789"),
            ("0002", "Num", "0002"),
        ]:
            with self.subTest(codigo=codigo):
                ast = construir_ast(codigo, regra="expr")
                self.assertEqual((ast.classe, ast.campos["valor"]), (classe, valor))

    def test_posicoes_de_identificadores_e_operadores(self):
        ast = construir_ast('no "t" {\n    inteiro x = 2 + 3;\n    x = -x;\n}')
        declaracao, atribuicao = ast.campos["definicoes"][0].campos["corpo"].campos["instrucoes"]
        self.assertEqual((declaracao.linha, declaracao.coluna), (2, 12))
        self.assertEqual((declaracao.campos["valor"].linha, declaracao.campos["valor"].coluna), (2, 18))
        self.assertEqual((atribuicao.linha, atribuicao.coluna), (3, 4))
        variavel = atribuicao.campos["valor"].campos["valor"]
        self.assertEqual((variavel.linha, variavel.coluna), (3, 9))

    def test_todos_os_comandos_e_pontas(self):
        ast = construir_ast('{ cruzar a b; passar_baixo a; passar_cima b; '
                            'enrolar a 2; apertar; finalizar "ok"; }', regra="bloco")
        comandos = ast.campos["instrucoes"]
        self.assertEqual([n.campos["nome"] for n in comandos],
                         ["cruzar", "passar_baixo", "passar_cima", "enrolar", "apertar", "finalizar"])
        self.assertEqual([p.classe for p in comandos[0].campos["pontas"]], ["Ponta", "Ponta"])
        self.assertEqual([p.campos["nome"] for p in comandos[0].campos["pontas"]], ["a", "b"])
        self.assertNotIn("valor", comandos[4].campos)
        self.assertEqual(comandos[5].campos["valor"].classe, "Texto")

    def test_blocos_repeticao_condicional_e_senao_opcional(self):
        ast = construir_ast('{ repetir 2 { se verdadeiro {} senao { apertar; } } '
                            'se falso {} }', regra="bloco")
        repeticao, condicional = ast.campos["instrucoes"]
        self.assertEqual(repeticao.classe, "Repetir")
        interno = repeticao.campos["corpo"].campos["instrucoes"][0]
        self.assertEqual(interno.campos["senao"].campos["instrucoes"][0].classe, "Comando")
        self.assertIsNone(condicional.campos["senao"])

    def test_arvore_independente_e_menor_que_a_concreta(self):
        codigo = 'no "aula" { inteiro x = 10; inteiro y = 20; z = x + y * 2; }'
        concreta, _ = analisar(codigo)
        ast = construir_ast(codigo)
        pendentes, total_concreta = [concreta], 0
        while pendentes:
            no = pendentes.pop()
            total_concreta += 1
            if hasattr(no, "getChildren"):
                pendentes.extend(no.getChildren())
        pendentes, total_ast = [ast], 0
        while pendentes:
            no = pendentes.pop()
            self.assertIsInstance(no, NoAST)
            total_ast += 1
            pendentes.extend(no.filhos())
        self.assertEqual(total_ast, 13)  # 11 da aula + definicao de no + bloco.
        self.assertLess(total_ast, total_concreta)
        exibicao = formatar_ast(ast)
        for proibido in ("PONTOVIRG", "EOF", "ABRE_CHAVE", "Context"):
            self.assertNotIn(proibido, exibicao)

    def test_json_preserva_campos_e_varias_definicoes(self):
        ast = construir_ast('no "um" {} no "dois" { apertar; }')
        dados = json.loads(json.dumps(ast.para_dict()))
        self.assertEqual([n["campos"]["nome"] for n in dados["campos"]["definicoes"]], ["um", "dois"])
        self.assertEqual(dados["classe"], "Programa")

    def test_erros_impedem_ast_inclusive_com_recuperacao(self):
        for recuperar in (False, True):
            for codigo in ('no "t" { @; }', 'no "t" { cruzar a; finalizar; }', 'no "t" {} 2'):
                with self.subTest(codigo=codigo, recuperar=recuperar):
                    with self.assertRaises(ErroAnalise):
                        construir_ast(codigo, recuperar=recuperar)

    def test_regra_desconhecida_rejeitada(self):
        with self.assertRaises(ValueError):
            construir_ast("inteiro", regra="tipo")


class TestTerminalAST(unittest.TestCase):
    def executar(self, *args):
        return subprocess.run([sys.executable, str(RAIZ / "src/construtor_ast.py"), *args],
                              cwd=RAIZ, capture_output=True, text=True, timeout=15)

    def test_json_e_fragmento(self):
        resultado = self.executar("exemplos/fragmentos/expressao.amr", "--regra", "expr", "--formato", "json")
        self.assertEqual(resultado.returncode, 0, resultado.stderr)
        self.assertEqual(json.loads(resultado.stdout)["campos"]["operador"], "+")
        self.assertEqual(resultado.stderr, "")

    def test_programa_indentado(self):
        resultado = self.executar("exemplos/no_simples.amr")
        self.assertEqual(resultado.returncode, 0, resultado.stderr)
        self.assertIn("DefinicaoNo nome='cadarco simples'", resultado.stdout)
        self.assertNotIn("EOF", resultado.stdout)

    def test_erro_e_arquivo_inexistente(self):
        for caminho in ("exemplos/invalidos/sintaxe/multiplos_erros.amr", "exemplos/inexistente.amr"):
            resultado = self.executar(caminho, "--recuperar")
            self.assertEqual(resultado.returncode, 1)
            self.assertEqual(resultado.stdout, "")
            self.assertNotIn("Traceback", resultado.stderr)


if __name__ == "__main__":
    unittest.main()
