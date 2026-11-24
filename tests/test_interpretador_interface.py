"""Execucao real das instrucoes e contrato usado pela interface publicada."""

import json
import unittest

from src.diagnosticos import ErroAnalise
from src.interpretador import Interpretador
from src.interface_web import analisar_interface, analisar_json
from src.semantico import analisar_semantica


def executar(corpo, **limites):
    ast = analisar_semantica('no "teste" { ' + corpo + ' }').ast
    return Interpretador(**limites).executar(ast)[0]["passos"]


class TestInterpretador(unittest.TestCase):
    def test_comandos_na_ordem_e_posicoes(self):
        passos = executar('cruzar a b; passar_baixo a; apertar; finalizar "pronto";')
        self.assertEqual([p["acao"] for p in passos], ["cruzar", "passar_baixo", "apertar", "finalizar"])
        self.assertEqual(passos[0]["pontas"], ["a", "b"])
        self.assertEqual(passos[-1]["mensagem"], "pronto")
        self.assertEqual(passos[0]["linha"], 1)

    def test_repeticao_e_atribuicao_mudam_roteiro(self):
        passos = executar('inteiro n = 1; repetir 3 { enrolar a n; n = n + 1; }')
        self.assertEqual(len(passos), 6)
        self.assertEqual([p["variaveis"]["n"] for p in passos], [1, 2, 2, 3, 3, 3])

    def test_condicao_seleciona_apenas_um_ramo(self):
        passos = executar('se 2 > 1 { apertar; } senao { finalizar "erro"; }')
        self.assertEqual([p["acao"] for p in passos], ["apertar"])
        self.assertEqual(executar('se falso { apertar; }'), [])

    def test_senao_e_condicao_com_variavel(self):
        passos = executar('booleano a = falso; se a { apertar; } senao { passar_cima b; }')
        self.assertEqual(passos[0]["acao"], "passar_cima")

    def test_escopo_sombreamento_e_inicializador(self):
        passos = executar('inteiro n = 2; se verdadeiro { inteiro n = n + 1; enrolar a n; } enrolar a n;')
        self.assertEqual([p["variaveis"]["n"] for p in passos], [3, 3, 3, 2, 2])

    def test_reais_e_precedencia(self):
        passos = executar('real x = 2 + 3 * 4; x = x / 2; apertar;')
        self.assertEqual(passos[0]["variaveis"]["x"], 7.0)
        self.assertIsInstance(passos[0]["variaveis"]["x"], float)

    def test_igualdade_e_unario(self):
        passos = executar('inteiro x = -2 * 3; se x == -6 { apertar; }')
        self.assertEqual(passos[0]["variaveis"]["x"], -6)

    def test_curto_circuito_logico_evitar_divisao(self):
        passos = executar('se verdadeiro ou 1 / 0 > 0 { apertar; } se falso e 1 / 0 > 0 { apertar; }')
        self.assertEqual(len(passos), 1)

    def test_finalizar_interrompe_blocos_aninhados(self):
        passos = executar('repetir 3 { finalizar "fim"; apertar; } apertar;')
        self.assertEqual(len(passos), 1)
        self.assertEqual(passos[0]["acao"], "finalizar")

    def test_finalizar_nao_interrompe_outras_definicoes(self):
        ast = analisar_semantica('no "a" { finalizar "a"; } no "b" { apertar; }').ast
        planos = Interpretador().executar(ast)
        self.assertEqual([p["nome"] for p in planos], ["a", "b"])
        self.assertEqual(planos[1]["passos"][0]["acao"], "apertar")

    def test_quantidade_zero(self):
        self.assertEqual(executar('repetir 0 { apertar; } enrolar a 0;'), [])

    def test_divisao_zero_posicao(self):
        with self.assertRaises(ErroAnalise) as contexto:
            executar('real x = 1 / 0;')
        self.assertEqual(contexto.exception.diagnosticos[0].codigo, "E001")
        self.assertEqual(contexto.exception.diagnosticos[0].coluna, 24)

    def test_quantidades_negativas(self):
        for corpo in ('repetir -1 {}', 'enrolar a -1;'):
            with self.subTest(corpo=corpo), self.assertRaisesRegex(ErroAnalise, "E002"):
                executar(corpo)

    def test_limite_de_passos(self):
        with self.assertRaisesRegex(ErroAnalise, "E003"):
            executar('repetir 10 { apertar; }', max_passos=5)

    def test_limite_de_operacoes_em_blocos_vazios(self):
        with self.assertRaisesRegex(ErroAnalise, "E003"):
            executar('repetir 10 { repetir 10 {} }', max_operacoes=40)

    def test_limite_numerico(self):
        for corpo in ('inteiro x = ' + '9'*310 + ';', 'real x = ' + '9'*309 + '.0;'):
            with self.subTest(corpo=corpo), self.assertRaisesRegex(ErroAnalise, "E004"):
                executar(corpo)

    def test_pontas_distintas_para_cruzar(self):
        with self.assertRaisesRegex(ErroAnalise, "E005"):
            executar('cruzar a a;')


class TestContratoInterface(unittest.TestCase):
    def test_json_com_tokens_ast_simbolos_e_etapas(self):
        dados = json.loads(analisar_json('no "t" { inteiro n = 2; enrolar ponta n; }'))
        self.assertTrue(dados["ok"])
        self.assertEqual(len(dados["planos"][0]["passos"]), 2)
        self.assertEqual(dados["ast"]["classe"], "Programa")
        self.assertEqual(dados["simbolos"][0]["nome"], "n")
        self.assertEqual(dados["tokens"][0]["tipo"], "NO")

    def test_falhas_das_quatro_fases_sem_resultado_parcial(self):
        for corpo, fase in [('x = @;', 'lexico'), ('apertar', 'sintatico'),
                            ('x = 2;', 'semantico'), ('real x = 1 / 0;', 'execucao')]:
            with self.subTest(fase=fase):
                dados = analisar_interface('no "t" { ' + corpo + ' }')
                self.assertFalse(dados["ok"])
                self.assertEqual(dados["diagnosticos"][0]["fase"], fase)
                self.assertNotIn("planos", dados)

    def test_tamanho_da_entrada(self):
        self.assertEqual(analisar_interface(' '*20001)["diagnosticos"][0]["fase"], "entrada")


if __name__ == "__main__":
    unittest.main()
