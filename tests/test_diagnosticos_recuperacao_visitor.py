"""Verifica diagnosticos, recuperacao de erros, visitor e interface de terminal."""

import json
import subprocess
import sys
import unittest
from pathlib import Path

from gerado.AmarraParserVisitor import AmarraParserVisitor
from src.sintatico import ErroAnalise, analisar


RAIZ = Path(__file__).resolve().parent.parent
EXEMPLO = "exemplos/invalidos/sintaxe/multiplos_erros.amr"


class TestDiagnosticos(unittest.TestCase):
    def diagnostico(self, codigo, regra="programa"):
        with self.assertRaises(ErroAnalise) as contexto:
            analisar(codigo, regra=regra)
        self.assertEqual(len(contexto.exception.diagnosticos), 1)
        return contexto.exception.diagnosticos[0]

    def test_terminador_ausente_informa_esperado_encontrado_e_posicao(self):
        erro = self.diagnostico('no "teste" {\n    apertar\n}')
        self.assertEqual((erro.linha, erro.coluna), (3, 0))
        self.assertEqual(erro.esperados, ("';'",))
        self.assertEqual(erro.encontrado, "'}'")
        self.assertEqual(str(erro),
                         "Erro sintatico na linha 3, coluna 0: esperava ';'; encontrou '}'")

    def test_parentese_ausente_informa_o_fechamento(self):
        erro = self.diagnostico('no "teste" { inteiro a = (2 + 3; }')
        self.assertEqual(erro.esperados, ("')'",))
        self.assertEqual(erro.encontrado, "';'")

    def test_nome_de_token_e_traduzido_para_identificador(self):
        erro = self.diagnostico('no "teste" { cruzar ponta; }')
        self.assertEqual(erro.esperados, ("identificador",))
        self.assertEqual(erro.encontrado, "';'")

    def test_fim_de_arquivo_e_descrito(self):
        erro = self.diagnostico('no "teste" { apertar;')
        self.assertIn("'}'", erro.esperados)
        self.assertEqual(erro.encontrado, "fim da entrada (EOF)")

    def test_fragmento_com_sobra_informa_eof_e_token(self):
        erro = self.diagnostico("2 + 3;", regra="expr")
        self.assertEqual(erro.esperados, ("fim da entrada (EOF)",))
        self.assertEqual(erro.encontrado, "';'")
        self.assertEqual((erro.linha, erro.coluna), (1, 5))

    def test_erro_lexico_preserva_caractere_e_posicao(self):
        erro = self.diagnostico('no "teste" {\n    @\n}')
        self.assertEqual((erro.fase, erro.linha, erro.coluna), ("lexico", 2, 4))
        self.assertEqual(erro.esperados, ("um token valido",))
        self.assertEqual(erro.encontrado, "'@'")


class TestRecuperacao(unittest.TestCase):
    def recuperar(self, codigo, regra="programa"):
        eventos = []
        with self.assertRaises(ErroAnalise) as contexto:
            analisar(codigo, regra=regra, recuperar=True, registrar=eventos.append)
        return contexto.exception.diagnosticos, eventos

    def test_exemplo_coleta_tres_erros_e_continua_nos_comandos_validos(self):
        erros, eventos = self.recuperar((RAIZ / EXEMPLO).read_text(encoding="utf-8"))
        self.assertEqual([(e.linha, e.coluna) for e in erros], [(3, 25), (5, 24), (7, 13)])
        consumidos = [e for e in eventos if e.acao == "CONSUMIR"]
        self.assertTrue(any(e.linha == 4 and e.tipo_token == "APERTAR" for e in consumidos))
        self.assertTrue(any(e.linha == 6 and e.tipo_token == "PASSAR_CIMA" for e in consumidos))
        self.assertEqual(consumidos[-1].tipo_token, "EOF")

    def test_expressao_defeituosa_nao_produz_cascata(self):
        erros, eventos = self.recuperar(
            'no "teste" { inteiro a = 1 + ) * ( + 2 * ) + 3; apertar; }'
        )
        self.assertEqual(len(erros), 1)
        self.assertEqual(erros[0].encontrado, "')'")
        self.assertTrue(any(e.tipo_token == "APERTAR" and e.acao == "CONSUMIR" for e in eventos))

    def test_tokens_invalidos_no_inicio_de_instrucoes_nao_travam(self):
        erros, _ = self.recuperar('no "teste" { + * 1; + * 2; passar_cima; }')
        self.assertEqual([e.encontrado for e in erros], ["'+'", "'+'", "';'"])

    def test_erros_em_blocos_aninhados_e_externos(self):
        erros, _ = self.recuperar('no "teste" { repetir 2 { finalizar; } cruzar ponta; }')
        self.assertEqual(len(erros), 2)
        self.assertEqual(erros[1].esperados, ("identificador",))

    def test_chave_do_bloco_externo_e_preservada(self):
        erros, _ = self.recuperar('no "teste" { repetir 2 { inteiro a = } cruzar ponta; }')
        self.assertEqual([e.encontrado for e in erros], ["'}'", "';'"])

    def test_cabecalho_invalido_descarta_blocos_do_se_e_senao(self):
        erros, _ = self.recuperar(
            'no "teste" { se { apertar; } senao { apertar; } finalizar; }'
        )
        self.assertEqual([e.encontrado for e in erros], ["'{'", "';'"])

    def test_erro_no_eof_interrompe_sem_repetir_o_diagnostico(self):
        for codigo in ['no "teste" { inteiro a =', 'no "teste" { repetir 2 { finalizar']:
            with self.subTest(codigo=codigo):
                erros, _ = self.recuperar(codigo)
                self.assertEqual(len(erros), 1)
                self.assertEqual(erros[0].encontrado, "fim da entrada (EOF)")

    def test_recuperacao_preserva_aceitacao_e_rejeicao_dos_72_casos(self):
        casos = json.loads((RAIZ / "tests/casos_sintaticos.json").read_text(encoding="utf-8"))
        for caso in casos:
            with self.subTest(caso=caso["id"]):
                codigo, regra = caso["codigo"], caso["regra"]
                if caso["resultado"] == "valido":
                    arvore, parser = analisar(codigo, regra=regra, recuperar=True)
                    normal, outro = analisar(codigo, regra=regra)
                    self.assertEqual(arvore.toStringTree(recog=parser), normal.toStringTree(recog=outro))
                else:
                    erros, _ = self.recuperar(codigo, regra=regra)
                    self.assertTrue(all(e.fase == caso["resultado"] for e in erros))

    def test_erros_lexicos_sao_coletados_sem_iniciar_o_parser(self):
        erros, eventos = self.recuperar('no "teste" { @; $; }')
        self.assertEqual([e.fase for e in erros], ["lexico", "lexico"])
        self.assertEqual([e.encontrado for e in erros], ["'@'", "'$'"])
        self.assertEqual(eventos, [])

    def test_modo_padrao_continua_parando_no_primeiro_erro(self):
        with self.assertRaises(ErroAnalise) as contexto:
            analisar((RAIZ / EXEMPLO).read_text(encoding="utf-8"))
        self.assertEqual(len(contexto.exception.diagnosticos), 1)

    def test_delimitadores_em_texto_nao_sao_pontos_de_sincronizacao(self):
        erros, _ = self.recuperar('no "teste" { inteiro a = 1 + ) "};" + ; cruzar ponta; }')
        self.assertEqual([e.encontrado for e in erros], ["')'", "';'"])

    def test_muitas_instrucoes_invalidas_avancam_ate_o_fim(self):
        erros, eventos = self.recuperar('no "teste" { ' + 'cruzar ponta; ' * 100 + '}')
        self.assertEqual(len(erros), 100)
        self.assertTrue(any(e.tipo_token == "EOF" and e.acao == "CONSUMIR" for e in eventos))


class TestVisitorGerado(unittest.TestCase):
    def test_visitor_devolve_resultados_das_subexpressoes(self):
        # Demonstra o contrato de retorno do visitor, sem implementar E4.
        class Estrutura(AmarraParserVisitor):
            def visitNumero(self, ctx):
                return ctx.NUMERO().getText()

            def visitAditiva(self, ctx):
                return (ctx.op.text, self.visit(ctx.expr(0)), self.visit(ctx.expr(1)))

            def visitMultiplicativa(self, ctx):
                return (ctx.op.text, self.visit(ctx.expr(0)), self.visit(ctx.expr(1)))

        arvore, _ = analisar("2 + 3 * 4", regra="expr")
        self.assertEqual(Estrutura().visit(arvore), ("+", "2", ("*", "3", "4")))

    def test_visitor_percorre_as_instrucoes_do_programa(self):
        class Comandos(AmarraParserVisitor):
            def __init__(self):
                self.nomes = []

            def visitComando(self, ctx):
                self.nomes.append(ctx.getChild(0).getText())
                return self.visitChildren(ctx)

        codigo = (RAIZ / "exemplos/no_simples.amr").read_text(encoding="utf-8")
        arvore, _ = analisar(codigo)
        visitor = Comandos()
        visitor.visit(arvore)
        self.assertEqual(visitor.nomes, ["cruzar", "passar_baixo", "apertar", "finalizar"])


class TestTerminalDiagnosticos(unittest.TestCase):
    def executar(self, script, *argumentos):
        return subprocess.run(
            [sys.executable, str(RAIZ / "src" / script), *argumentos],
            cwd=RAIZ, capture_output=True, text=True, timeout=15,
        )

    def test_recuperacao_mostra_erros_sem_arvore_ou_sucesso(self):
        resultado = self.executar("sintatico.py", EXEMPLO, "--recuperar", "--rastrear")
        self.assertEqual(resultado.returncode, 1)
        self.assertEqual(resultado.stdout, "")
        self.assertEqual(resultado.stderr.count("Erro sintatico na linha"), 3)
        self.assertIn("esperava identificador; encontrou ';'", resultado.stderr)
        self.assertIn("CONSUMIR", resultado.stderr)
        self.assertNotIn("Traceback", resultado.stderr)

    def test_padrao_mostra_apenas_um_erro(self):
        resultado = self.executar("sintatico.py", EXEMPLO)
        self.assertEqual(resultado.returncode, 1)
        self.assertEqual(resultado.stdout, "")
        self.assertEqual(resultado.stderr.count("Erro sintatico na linha"), 1)

    def test_programa_valido_com_recuperacao_mostra_a_mesma_arvore(self):
        argumentos = ("exemplos/condicional_senao.amr", "--formato", "lisp")
        normal = self.executar("sintatico.py", *argumentos)
        recuperavel = self.executar("sintatico.py", *argumentos, "--recuperar")
        self.assertEqual(recuperavel.returncode, 0, recuperavel.stderr)
        self.assertEqual(recuperavel.stdout, normal.stdout)
        self.assertEqual(recuperavel.stderr, "")

    def test_lexer_usa_o_mesmo_formato_de_diagnostico(self):
        resultado = self.executar("lexico.py", "exemplos/invalidos/caractere_invalido.amr")
        self.assertEqual(resultado.returncode, 1)
        self.assertEqual(resultado.stdout, "")
        self.assertIn("Erro lexico na linha 4, coluna 12: esperava um token valido; encontrou '@'",
                      resultado.stderr)
        self.assertNotIn("Traceback", resultado.stderr)


if __name__ == "__main__":
    unittest.main()
