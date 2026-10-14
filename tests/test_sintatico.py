"""Verifica a estrutura das arvores, os diagnosticos e a interface de terminal."""

import subprocess
import sys
import unittest
from pathlib import Path

from antlr4 import CommonTokenStream, InputStream, Token

from src.sintatico import (
    AmarraLexer,
    AmarraParser,
    ErroAnalise,
    analisar,
    formatar_arvore,
)


RAIZ = Path(__file__).resolve().parent.parent


def expressao(codigo):
    arvore, _ = analisar('no "teste" { inteiro resultado = ' + codigo + '; }')
    return arvore.definicaoNo(0).bloco().instrucao(0).declaracao().expr()


class TestSintatico(unittest.TestCase):
    def test_exemplos_validos_consumem_ate_o_fim(self):
        for arquivo in sorted((RAIZ / "exemplos").glob("*.amr")):
            with self.subTest(arquivo=arquivo.name):
                arvore, _ = analisar(arquivo.read_text(encoding="utf-8"))
                self.assertEqual(arvore.EOF().getSymbol().type, Token.EOF)
                self.assertEqual(len(arvore.definicaoNo()), 1)

    def test_programa_com_varios_nos_e_bloco_vazio(self):
        arvore, _ = analisar('no "primeiro" {} no "segundo" { apertar; }')
        self.assertEqual(len(arvore.definicaoNo()), 2)
        self.assertEqual(arvore.definicaoNo(0).bloco().instrucao(), [])

    def test_blocos_aninhados(self):
        arvore, _ = analisar('no "teste" { repetir 2 { se verdadeiro { apertar; } } }')
        repeticao = arvore.definicaoNo(0).bloco().instrucao(0).repeticao()
        condicional = repeticao.bloco().instrucao(0).condicional()
        self.assertEqual(condicional.bloco().instrucao(0).comando().getText(), "apertar")

    def test_exemplos_com_erro_lexico(self):
        for arquivo in sorted((RAIZ / "exemplos" / "invalidos").glob("*.amr")):
            with self.subTest(arquivo=arquivo.name):
                with self.assertRaisesRegex(ErroAnalise, r"Erro lexico na linha \d+, coluna \d+"):
                    analisar(arquivo.read_text(encoding="utf-8"))

    def test_exemplos_com_erro_sintatico(self):
        for arquivo in sorted((RAIZ / "exemplos" / "invalidos" / "sintaxe").glob("*.amr")):
            with self.subTest(arquivo=arquivo.name):
                with self.assertRaisesRegex(ErroAnalise, r"Erro sintatico na linha \d+, coluna \d+"):
                    analisar(arquivo.read_text(encoding="utf-8"))

    def test_estrutura_invalida_e_tokens_sobrando(self):
        programas = [
            "", "// apenas comentario", 'no "teste" {} apertar;',
            'no "teste" { cruzar ponta_direita; }',
            'no "teste" { passar_cima; }',
            'no "teste" { enrolar ponta_direita; }',
            'no "teste" { inteiro voltas = (2 + 3; }',
            'no "teste" { no "interno" {} }',
        ]
        for programa in programas:
            with self.subTest(programa=programa):
                with self.assertRaisesRegex(ErroAnalise, "Erro sintatico"):
                    analisar(programa)

    def test_multiplicacao_tem_precedencia_sobre_soma(self):
        raiz = expressao("2 + 3 * 4")
        self.assertIsInstance(raiz, AmarraParser.AditivaContext)
        self.assertEqual(raiz.expr(0).getText(), "2")
        self.assertIsInstance(raiz.expr(1), AmarraParser.MultiplicativaContext)
        self.assertEqual([filho.getText() for filho in raiz.expr(1).expr()], ["3", "4"])

    def test_parenteses_alteram_a_arvore(self):
        raiz = expressao("(2 + 3) * 4")
        self.assertIsInstance(raiz, AmarraParser.MultiplicativaContext)
        self.assertIsInstance(raiz.expr(0), AmarraParser.AgrupadaContext)
        self.assertIsInstance(raiz.expr(0).expr(), AmarraParser.AditivaContext)

    def test_menos_unario_tem_precedencia_sobre_multiplicacao(self):
        raiz = expressao("-2 * 3")
        self.assertIsInstance(raiz, AmarraParser.MultiplicativaContext)
        self.assertIsInstance(raiz.expr(0), AmarraParser.SinalContext)
        self.assertEqual(raiz.expr(0).expr().getText(), "2")

    def test_operadores_do_mesmo_grupo_associam_a_esquerda(self):
        for codigo, classe in [
            ("8 - 3 - 1", AmarraParser.AditivaContext),
            ("8 / 4 / 2", AmarraParser.MultiplicativaContext),
        ]:
            with self.subTest(codigo=codigo):
                raiz = expressao(codigo)
                self.assertIsInstance(raiz, classe)
                self.assertIsInstance(raiz.expr(0), classe)
                self.assertIsInstance(raiz.expr(1), AmarraParser.NumeroContext)

    def test_precedencia_aritmetica_comparacao_e_logica(self):
        raiz = expressao("1 + 2 * 3 > 6 e verdadeiro ou falso")
        self.assertIsInstance(raiz, AmarraParser.DisjuncaoContext)
        conjuncao = raiz.expr(0)
        self.assertIsInstance(conjuncao, AmarraParser.ConjuncaoContext)
        comparacao = conjuncao.expr(0)
        self.assertIsInstance(comparacao, AmarraParser.ComparacaoContext)
        aditiva = comparacao.expr(0)
        self.assertIsInstance(aditiva, AmarraParser.AditivaContext)
        self.assertIsInstance(aditiva.expr(1), AmarraParser.MultiplicativaContext)

    def test_todos_os_operadores_e_literais(self):
        for codigo, classe in [
            ("3.5", AmarraParser.NumeroContext),
            ('"corda"', AmarraParser.TextoContext),
            ("verdadeiro", AmarraParser.BooleanoContext),
            ("falso", AmarraParser.BooleanoContext),
            ("voltas", AmarraParser.IdentificadorContext),
            ("2 < 3", AmarraParser.ComparacaoContext),
            ("2 == 2", AmarraParser.ComparacaoContext),
            ("-(2 + 3)", AmarraParser.SinalContext),
        ]:
            with self.subTest(codigo=codigo):
                self.assertIsInstance(expressao(codigo), classe)

    def test_atribuicao_e_tipos_sao_estruturas_sintaticas(self):
        arvore, _ = analisar(
            'no "teste" { inteiro a = 1; real b = 2.5; texto c = "corda"; '
            'booleano d = verdadeiro; a = a + 1; finalizar c; }'
        )
        instrucoes = arvore.definicaoNo(0).bloco().instrucao()
        self.assertEqual([item.declaracao().tipo().getText() for item in instrucoes[:4]],
                         ["inteiro", "real", "texto", "booleano"])
        self.assertEqual(instrucoes[4].atribuicao().IDENT().getText(), "a")
        # Compatibilidade de tipos e nomes declarados pertencem a analise semantica.
        analisar('no "teste" { inteiro a = "texto"; finalizar desconhecido; }')

    def test_arvore_preserva_regras_tokens_e_pontuacao(self):
        arvore, parser = analisar('no "teste" { apertar; }')
        exibicao = formatar_arvore(arvore, parser)
        self.assertEqual(exibicao.splitlines()[0], "programa")
        for fragmento in ["  definicaoNo", "    bloco", "APERTAR 'apertar'", "PONTOVIRG ';'", "EOF '<EOF>'"]:
            self.assertIn(fragmento, exibicao)

    def test_lexer_continua_reconhecendo_os_exemplos_da_e2(self):
        for nome, quantidade in [("no_simples", 16), ("no_reforcado", 37), ("no_windsor", 28)]:
            with self.subTest(nome=nome):
                codigo = (RAIZ / "exemplos" / (nome + ".amr")).read_text(encoding="utf-8")
                tokens = CommonTokenStream(AmarraLexer(InputStream(codigo)))
                tokens.fill()
                self.assertEqual(len([t for t in tokens.tokens if t.type != Token.EOF]), quantidade)


class TestTerminal(unittest.TestCase):
    def executar(self, *argumentos):
        return subprocess.run(
            [sys.executable, str(RAIZ / "src" / "sintatico.py"), *argumentos],
            cwd=RAIZ, capture_output=True, text=True,
        )

    def test_sucesso_nos_dois_formatos(self):
        for formato, trecho in [("indentado", "  definicaoNo"), ("lisp", "(programa (definicaoNo")]:
            with self.subTest(formato=formato):
                resultado = self.executar("exemplos/no_simples.amr", "--formato", formato)
                self.assertEqual(resultado.returncode, 0, resultado.stderr)
                self.assertIn("Analise sintatica concluida sem erros.", resultado.stdout)
                self.assertIn(trecho, resultado.stdout)
                self.assertEqual(resultado.stderr, "")

    def test_erros_nao_imprimem_sucesso_nem_arvore(self):
        casos = [
            ("exemplos/invalidos/caractere_invalido.amr", "Erro lexico na linha 4, coluna 12"),
            ("exemplos/invalidos/sintaxe/sem_ponto_virgula.amr", "Erro sintatico na linha 4, coluna 4"),
            ("exemplos/arquivo_inexistente.amr", "Nao foi possivel ler"),
        ]
        for caminho, mensagem in casos:
            with self.subTest(caminho=caminho):
                resultado = self.executar(caminho)
                self.assertEqual(resultado.returncode, 1)
                self.assertIn(mensagem, resultado.stderr)
                self.assertEqual(resultado.stdout, "")
                self.assertNotIn("Traceback", resultado.stderr)


if __name__ == "__main__":
    unittest.main()
