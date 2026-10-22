"""Verifica senao, regras isoladas e observacao da pilha durante a analise."""

import subprocess
import sys
import unittest
from pathlib import Path

from antlr4 import CommonTokenStream, InputStream, Token

from src.rastreamento import formatar_evento
from src.sintatico import AmarraLexer, AmarraParser, ErroAnalise, analisar


RAIZ = Path(__file__).resolve().parent.parent


class TestCondicional(unittest.TestCase):
    def test_senao_opcional(self):
        for codigo, quantidade in [
            ('se verdadeiro { apertar; }', 1),
            ('se verdadeiro { apertar; } senao { passar_baixo ponta; }', 2),
        ]:
            with self.subTest(codigo=codigo):
                arvore, _ = analisar(codigo, regra="condicional")
                self.assertEqual(len(arvore.bloco()), quantidade)
                self.assertEqual(arvore.SENAO() is not None, quantidade == 2)

    def test_chaves_associam_o_senao_ao_se_correto(self):
        casos = [
            ('se verdadeiro { se falso {} senao {} }', False, True),
            ('se verdadeiro { se falso {} } senao {}', True, False),
            ('se verdadeiro { se falso {} senao {} } senao {}', True, True),
        ]
        for codigo, externo, interno in casos:
            with self.subTest(codigo=codigo):
                arvore, _ = analisar(codigo, regra="condicional")
                filho = arvore.bloco(0).instrucao(0).condicional()
                self.assertEqual(arvore.SENAO() is not None, externo)
                self.assertEqual(filho.SENAO() is not None, interno)

    def test_senao_exige_condicional_e_bloco(self):
        for trecho in [
            "senao {}", "se verdadeiro {} senao", "se verdadeiro {} senao apertar;",
            "se verdadeiro {} senao {} senao {}", "se verdadeiro {}; senao {}",
        ]:
            with self.subTest(trecho=trecho):
                with self.assertRaisesRegex(ErroAnalise, "Erro sintatico"):
                    analisar('no "teste" { ' + trecho + ' }')

    def test_palavra_reservada_preserva_identificadores_maiores(self):
        tokens = CommonTokenStream(AmarraLexer(InputStream("senao senao_extra")))
        tokens.fill()
        self.assertEqual([t.type for t in tokens.tokens],
                         [AmarraLexer.SENAO, AmarraLexer.IDENT, Token.EOF])


class TestRegrasIsoladas(unittest.TestCase):
    def test_todas_as_regras_podem_ser_testadas_separadamente(self):
        fragmentos = {
            "programa": 'no "teste" {}',
            "definicaoNo": 'no "teste" {}',
            "bloco": "{ apertar; }",
            "instrucao": "apertar;",
            "declaracao": "inteiro voltas = 2",
            "atribuicao": "voltas = 3",
            "tipo": "real",
            "comando": "cruzar direita esquerda",
            "repeticao": "repetir 2 {}",
            "condicional": "se verdadeiro {} senao {}",
            "expr": "2 + 3 * (4 - 1)",
        }
        self.assertEqual(set(fragmentos), set(AmarraParser.ruleNames))
        for regra, codigo in fragmentos.items():
            with self.subTest(regra=regra):
                arvore, parser = analisar(codigo, regra=regra)
                self.assertEqual(parser.ruleNames[arvore.getRuleIndex()], regra)
                self.assertEqual(parser.getCurrentToken().type, Token.EOF)

    def test_regra_isolada_rejeita_tokens_restantes(self):
        for regra, codigo in [
            ("expr", "1 2"), ("expr", "2 + 3;"), ("comando", "apertar;"),
            ("bloco", "{} {}"), ("tipo", "real inteiro"),
        ]:
            with self.subTest(regra=regra, codigo=codigo):
                with self.assertRaisesRegex(ErroAnalise, r"esperava fim da entrada \(EOF\)"):
                    analisar(codigo, regra=regra)

    def test_regra_deve_pertencer_a_gramatica(self):
        with self.assertRaisesRegex(ValueError, "Regra desconhecida"):
            analisar("", regra="__class__")

    def test_erro_lexico_e_parentese_ausente_em_fragmento(self):
        for codigo, mensagem in [
            ("2 + @", "Erro lexico"), ("2 + (3 * 4", r"esperava '\)'"),
        ]:
            with self.subTest(codigo=codigo):
                with self.assertRaisesRegex(ErroAnalise, mensagem):
                    analisar(codigo, regra="expr")

    def test_exemplos_de_fragmentos(self):
        for nome, regra in [("expressao", "expr"), ("bloco", "bloco")]:
            with self.subTest(nome=nome):
                codigo = (RAIZ / "exemplos" / "fragmentos" / (nome + ".amr")).read_text(encoding="utf-8")
                analisar(codigo, regra=regra)


class TestRastreamento(unittest.TestCase):
    def test_pilha_cresce_no_aninhamento_e_termina_vazia(self):
        eventos = []
        analisar('no "teste" { repetir 2 { se verdadeiro { apertar; } } }', registrar=eventos.append)
        self.assertEqual((eventos[0].acao, eventos[0].pilha), ("ENTRAR", ("programa",)))
        self.assertEqual((eventos[-1].acao, eventos[-1].regra, eventos[-1].pilha),
                         ("SAIR", "programa", ()))
        mais_profundo = max(eventos, key=lambda e: len(e.pilha))
        self.assertEqual(mais_profundo.pilha.count("bloco"), 3)
        self.assertIn("repeticao", mais_profundo.pilha)
        self.assertIn("condicional", mais_profundo.pilha)
        self.assertIn("(vazia)", formatar_evento(eventos[-1]))

    def test_consumo_dos_tokens_e_posicoes(self):
        eventos = []
        analisar('// comentario\nno "teste" { apertar; }', registrar=eventos.append)
        consumidos = [evento for evento in eventos if evento.acao == "CONSUMIR"]
        self.assertEqual([e.texto_token for e in consumidos],
                         ['no', '"teste"', '{', 'apertar', ';', '}', '<EOF>'])
        self.assertEqual((consumidos[0].tipo_token, consumidos[0].linha, consumidos[0].coluna),
                         ("NO", 2, 0))
        self.assertIn("lido=NO 'no'", formatar_evento(consumidos[0]))

    def test_parenteses_aumentam_a_profundidade(self):
        profundidades = []
        for codigo in ["2", "((2))"]:
            eventos = []
            analisar(codigo, regra="expr", registrar=eventos.append)
            profundidades.append(max(len(e.pilha) for e in eventos))
        self.assertGreater(profundidades[1], profundidades[0])

    def test_rastro_nao_altera_a_arvore(self):
        for arquivo in sorted((RAIZ / "exemplos").glob("*.amr")):
            with self.subTest(arquivo=arquivo.name):
                codigo = arquivo.read_text(encoding="utf-8")
                arvore, parser = analisar(codigo)
                eventos = []
                rastreada, outro_parser = analisar(codigo, registrar=eventos.append)
                self.assertEqual(arvore.toStringTree(recog=parser),
                                 rastreada.toStringTree(recog=outro_parser))
                self.assertTrue(eventos)

    def test_recursao_esquerda_consumindo_expressao_longa(self):
        eventos = []
        analisar(" + ".join(["1"] * 80), regra="expr", registrar=eventos.append)
        consumidos = [e for e in eventos if e.acao == "CONSUMIR"]
        self.assertEqual(len(consumidos), 159)
        self.assertEqual(eventos[-1].pilha, ())

    def test_rastro_disponivel_ate_um_erro_sintatico(self):
        eventos = []
        with self.assertRaisesRegex(ErroAnalise, "Erro sintatico"):
            analisar('no "teste" { apertar }', registrar=eventos.append)
        self.assertTrue(any(e.acao == "CONSUMIR" and e.texto_token == "apertar" for e in eventos))


class TestTerminalRegrasRastreamento(unittest.TestCase):
    def executar(self, *argumentos):
        return subprocess.run(
            [sys.executable, str(RAIZ / "src" / "sintatico.py"), *argumentos],
            cwd=RAIZ, capture_output=True, text=True,
        )

    def test_fragmento_com_rastro(self):
        resultado = self.executar("exemplos/fragmentos/expressao.amr", "--regra", "expr",
                                  "--rastrear", "--formato", "lisp")
        self.assertEqual(resultado.returncode, 0, resultado.stderr)
        self.assertIn("Analise sintatica concluida sem erros.", resultado.stdout)
        self.assertIn("(expr (expr 2) +", resultado.stdout)
        self.assertIn("CONSUMIR", resultado.stderr)
        self.assertIn("pilha[0]: (vazia)", resultado.stderr)
        self.assertNotIn("pilha[", resultado.stdout)

    def test_fragmento_sem_regra_adequada_e_rejeitado(self):
        resultado = self.executar("exemplos/fragmentos/expressao.amr")
        self.assertEqual(resultado.returncode, 1)
        self.assertIn("Erro sintatico", resultado.stderr)
        self.assertEqual(resultado.stdout, "")

    def test_regra_inexistente_e_rejeitada_pela_cli(self):
        resultado = self.executar("exemplos/fragmentos/expressao.amr", "--regra", "inexistente")
        self.assertEqual(resultado.returncode, 2)
        self.assertIn("invalid choice", resultado.stderr)
        self.assertNotIn("Traceback", resultado.stderr)

    def test_erro_com_rastro_nao_imprime_arvore(self):
        resultado = self.executar("exemplos/invalidos/sintaxe/parentese_sem_fechar.amr", "--rastrear")
        self.assertEqual(resultado.returncode, 1)
        self.assertEqual(resultado.stdout, "")
        self.assertIn("ENTRAR", resultado.stderr)
        self.assertIn("Erro sintatico", resultado.stderr)
        self.assertIn("')'", resultado.stderr)
        self.assertNotIn("Traceback", resultado.stderr)


if __name__ == "__main__":
    unittest.main()
