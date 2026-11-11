"""Regressão da integração do Studio, sem alterar os contratos do compilador E3."""

import unittest
from importlib.util import find_spec
from pathlib import Path

if any(find_spec(nome) is None for nome in ("fastapi", "httpx")):
    raise unittest.SkipTest("Testes opcionais do Studio: instale requirements-studio.txt.")

from fastapi.testclient import TestClient

from src.studio_api import app
from src.studio_plano import FalhaStudio, compilar
from src.studio_nos import reconhecer_no


RAIZ = Path(__file__).resolve().parent.parent


def programa(corpo):
    return 'no "teste" { ' + corpo + ' }'


class TestPlanoStudio(unittest.TestCase):
    def test_exemplos_originais_e_origem_dos_movimentos(self):
        for nome, quantidade in [("no_simples", 4), ("no_reforcado", 7), ("no_windsor", 6)]:
            with self.subTest(nome=nome):
                codigo = (RAIZ / "exemplos" / (nome + ".amr")).read_text(encoding="utf-8")
                plano = compilar(codigo)
                self.assertEqual(len(plano["passos"]), quantidade)
                self.assertEqual(plano["passos"][0]["origem"]["coluna"], 4)
                self.assertEqual(plano["passos"][-1]["acao"], "finalizar")
                self.assertEqual(plano["passos"][-1]["valor"], "windsor pronto" if nome == "no_windsor" else "no reforcado pronto" if nome == "no_reforcado" else "no pronto")

    def test_precedencia_atribuicao_e_repeticao_resolvem_os_valores(self):
        plano = compilar(programa("inteiro n = 1 + 2 * 2; n = n - 2; cruzar a b; repetir n { enrolar a n; }"))
        self.assertEqual(len(plano["passos"]), 4)
        self.assertEqual([p["valor"] for p in plano["passos"][1:]], [3, 3, 3])
        self.assertEqual(plano["variaveis"]["n"]["valor"], 3)

    def test_condicional_executa_somente_o_ramo_selecionado(self):
        plano = compilar(programa('cruzar a b; se falso { passar_baixo inexistente; } senao { passar_cima a; }'))
        self.assertEqual([p["acao"] for p in plano["passos"]], ["cruzar", "passar_cima"])

    def test_operadores_logicos_fazem_curto_circuito(self):
        plano = compilar(programa("booleano a = verdadeiro ou 1 / 0 > 2; booleano b = falso e desconhecido;"))
        self.assertIs(plano["variaveis"]["a"]["valor"], True)
        self.assertIs(plano["variaveis"]["b"]["valor"], False)

    def test_escopo_local_na_repeticao_e_atribuicao_externa(self):
        plano = compilar(programa("inteiro total = 0; repetir 3 { inteiro local = 2; total = total + local; }"))
        self.assertEqual(plano["variaveis"], {"total": {"tipo": "inteiro", "valor": 6}})

    def test_semantica_rejeita_nomes_tipos_condicoes_e_divisao(self):
        for corpo, mensagem in [
            ("inteiro n = verdadeiro;", "incompatível"),
            ("inteiro n = 1; inteiro n = 2;", "já declarada"),
            ("n = 1;", "não declarada"),
            ("real n = 1 / 0;", "Divisão por zero"),
            ("se 1 {}", "booleano"),
            ("inteiro n = verdadeiro + 2;", "número finito"),
            ("booleano b = verdadeiro == 1;", "tipos compatíveis"),
        ]:
            with self.subTest(corpo=corpo), self.assertRaisesRegex(FalhaStudio, mensagem):
                compilar(programa(corpo))

    def test_pontas_e_cruzamento_sao_verificados(self):
        for corpo in ["cruzar a a;", "passar_baixo a;", "cruzar a b; enrolar c 2;", "cruzar a b; cruzar c d;"]:
            with self.subTest(corpo=corpo), self.assertRaises(FalhaStudio):
                compilar(programa(corpo))

    def test_limites_de_repeticao_movimentos_e_voltas(self):
        for corpo in ["repetir -1 {}", "repetir 2.5 {}", "repetir verdadeiro {}",
                      "repetir 100 { repetir 100 {} }", "cruzar a b; repetir 501 { apertar; }",
                      "cruzar a b; enrolar a 0;", "cruzar a b; enrolar a 13;"]:
            with self.subTest(corpo=corpo), self.assertRaises(FalhaStudio):
                compilar(programa(corpo))

    def test_finalizar_interrompe_blocos_e_programa(self):
        plano = compilar(programa('repetir 3 { finalizar "pronto"; } passar_baixo inexistente;'))
        self.assertEqual(len(plano["passos"]), 1)

    def test_definicoes_com_nomes_iguais_sao_selecionadas_por_indice(self):
        codigo = 'no "igual" { finalizar 1; } no "igual" { finalizar 2; }'
        self.assertEqual(compilar(codigo, 1)["passos"][0]["valor"], 2)
        with self.assertRaises(FalhaStudio):
            compilar(codigo, 2)


class TestAPIStudio(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contexto = TestClient(app)
        cls.client = cls.contexto.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.contexto.__exit__(None, None, None)

    def test_health_e_exemplos_lidos_do_repositorio(self):
        self.assertEqual(self.client.get("/api/health").json()["status"], "ok")
        exemplos = self.client.get("/api/exemplos").json()
        self.assertEqual(len(exemplos), 3)
        for item in exemplos:
            self.assertEqual(item["codigo"], (RAIZ / "exemplos" / (item["id"] + ".amr")).read_text(encoding="utf-8"))
            resposta = self.client.post("/api/compilar", json={"codigo": item["codigo"]})
            self.assertTrue(resposta.json()["ok"])

    def test_erros_lexico_sintatico_e_semantico_nao_devolvem_movimentos(self):
        for corpo, fase in [("@", "lexico"), ("apertar", "sintatico"), ("passar_baixo a;", "semantico")]:
            with self.subTest(fase=fase):
                resultado = self.client.post("/api/compilar", json={"codigo": programa(corpo)}).json()
                self.assertFalse(resultado["ok"])
                self.assertEqual(resultado["passos"], [])
                self.assertEqual(resultado["diagnosticos"][0]["fase"], fase)

    def test_recuperacao_de_multiplos_erros(self):
        codigo = (RAIZ / "exemplos/invalidos/sintaxe/multiplos_erros.amr").read_text(encoding="utf-8")
        resultado = self.client.post("/api/compilar", json={"codigo": codigo}).json()
        self.assertEqual(len(resultado["diagnosticos"]), 3)

    def test_catalogo_disponivel_mesmo_com_falha_semantica(self):
        codigo = 'no "invalido" { passar_baixo a; } no "valido" { finalizar "ok"; }'
        resposta = self.client.post("/api/compilar", json={"codigo": codigo}).json()
        self.assertFalse(resposta["ok"])
        self.assertEqual(len(resposta["nos"]), 2)
        self.assertTrue(self.client.post("/api/compilar", json={"codigo": codigo, "selecionado": 1}).json()["ok"])

    def test_limites_da_requisicao(self):
        for entrada in [{"codigo": "a" * 32001}, {"codigo": "", "selecionado": -1}, {}]:
            self.assertEqual(self.client.post("/api/compilar", json=entrada).status_code, 422)

    def test_simples_duplo_integra_programa_real_e_registro(self):
        codigo = (RAIZ / "exemplos/no_simples_duplo.amr").read_text(encoding="utf-8")
        plano = self.client.post("/api/compilar", json={"codigo": codigo}).json()
        self.assertTrue(plano["ok"])
        self.assertEqual(len(plano["passos"]), 5)
        self.assertEqual(plano["animacao"]["id"], "double-overhand")
        self.assertEqual(plano["animacao"]["pontaTrabalho"], "ponta_trabalho")

    def test_registro_considera_acoes_resolvidas_e_nao_nome(self):
        codigo = 'no "outro nome" { cruzar a b; repetir 2 { passar_baixo b; } apertar; }'
        resultado = self.client.post("/api/compilar", json={"codigo": codigo}).json()
        self.assertEqual(resultado["animacao"]["passagens"], 2)
        self.assertEqual(reconhecer_no(compilar(codigo))["id"], "double-overhand")

    def test_sequencia_diferente_nao_e_reconhecida_como_duplo(self):
        for corpo in ["cruzar a b; passar_baixo b; apertar;",
                      "cruzar a b; passar_baixo a; passar_baixo b; apertar;",
                      "cruzar a b; passar_baixo b; apertar; passar_baixo b; apertar;",
                      "cruzar a b; passar_cima b; passar_cima b; apertar;"]:
            with self.subTest(corpo=corpo):
                codigo = 'no "no simples duplo" { ' + corpo + ' }'
                resposta = self.client.post("/api/compilar", json={"codigo": codigo}).json()
                self.assertTrue(resposta["ok"])
                self.assertNotIn("animacao", resposta)


if __name__ == "__main__":
    unittest.main()
