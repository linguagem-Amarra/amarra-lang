"""Verifica nomes, escopos e tipos na AST: python src/semantico.py arquivo.amr."""

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.construtor_ast import construir_ast
from src.arvore_abstrata import NoAST, formatar_ast
from src.diagnosticos import ErroAnalise


@dataclass(frozen=True)
class DiagnosticoSemantico:
    codigo: str
    linha: int
    coluna: int
    mensagem: str
    fase: str = "semantico"

    def __str__(self):
        return (f"Erro semantico na linha {self.linha}, coluna {self.coluna} "
                f"[{self.codigo}]: {self.mensagem}")


@dataclass(frozen=True)
class Simbolo:
    nome: str
    tipo: str
    linha: int
    coluna: int
    escopo: int
    definicao: str


@dataclass
class ResultadoSemantico:
    ast: NoAST
    simbolos: tuple


class AnalisadorSemantico:
    NUMERICOS = {"inteiro", "real"}

    def __init__(self):
        self.escopos = []
        self.simbolos = []
        self.diagnosticos = []
        self.numero_escopo = 0
        self.definicao = ""

    def erro(self, no, codigo, mensagem):
        self.diagnosticos.append(DiagnosticoSemantico(codigo, no.linha, no.coluna, mensagem))

    def buscar(self, no):
        nome = no.campos["nome"]
        for _, tabela in reversed(self.escopos):
            if nome in tabela:
                return tabela[nome]
        self.erro(no, "S001", f"variavel '{nome}' usada sem declaracao anterior neste escopo.")
        return None

    @staticmethod
    def compativel(destino, origem):
        return destino == origem or (destino == "real" and origem == "inteiro")

    def exigir_tipo(self, no, obtido, esperado, contexto):
        # None representa um erro ja reportado; evita diagnosticos em cascata.
        if obtido is not None and obtido != esperado:
            self.erro(no, "S004", f"{contexto} exige {esperado}; recebeu {obtido}.")

    def analisar(self, raiz):
        if raiz.classe != "Programa":
            raise ValueError("A analise semantica exige um programa completo.")
        for definicao in raiz.campos["definicoes"]:
            self.definicao = definicao.campos["nome"]
            self.bloco(definicao.campos["corpo"])
        if self.diagnosticos:
            raise ErroAnalise(self.diagnosticos)
        return ResultadoSemantico(raiz, tuple(self.simbolos))

    def bloco(self, no):
        self.numero_escopo += 1
        self.escopos.append((self.numero_escopo, {}))
        try:
            for instrucao in no.campos["instrucoes"]:
                self.instrucao(instrucao)
        finally:
            self.escopos.pop()

    def instrucao(self, no):
        campos = no.campos
        if no.classe == "Declara":
            escopo, tabela = self.escopos[-1]
            anterior = tabela.get(campos["nome"])
            if anterior is not None:
                self.erro(no, "S002", f"variavel '{anterior.nome}' ja declarada neste bloco "
                          f"na linha {anterior.linha}, coluna {anterior.coluna}.")
            # O inicializador ve apenas declaracoes anteriores, inclusive externas.
            tipo = self.expressao(campos["valor"])
            if tipo is not None and not self.compativel(campos["tipo"], tipo):
                self.erro(no, "S003", f"variavel '{campos['nome']}' de tipo {campos['tipo']} "
                          f"nao pode receber {tipo}.")
            if anterior is None:
                simbolo = Simbolo(campos["nome"], campos["tipo"], no.linha, no.coluna,
                                  escopo, self.definicao)
                tabela[simbolo.nome] = simbolo
                self.simbolos.append(simbolo)
        elif no.classe == "Atribui":
            # O destino da atribuicao tambem e um uso, mesmo sem ser um no Var.
            simbolo = self.buscar(no)
            tipo = self.expressao(campos["valor"])
            if simbolo is not None and tipo is not None and not self.compativel(simbolo.tipo, tipo):
                self.erro(no, "S003", f"variavel '{simbolo.nome}' de tipo {simbolo.tipo} "
                          f"nao pode receber {tipo}.")
        elif no.classe == "Se":
            self.exigir_tipo(campos["condicao"], self.expressao(campos["condicao"]),
                             "booleano", "condicao de se")
            self.bloco(campos["entao"])
            if campos["senao"] is not None:
                self.bloco(campos["senao"])
        elif no.classe == "Repetir":
            self.exigir_tipo(campos["quantidade"], self.expressao(campos["quantidade"]),
                             "inteiro", "quantidade de repetir")
            self.bloco(campos["corpo"])
        elif no.classe == "Comando":
            if campos["nome"] in {"enrolar", "finalizar"}:
                esperado = "inteiro" if campos["nome"] == "enrolar" else "texto"
                self.exigir_tipo(campos["valor"], self.expressao(campos["valor"]),
                                 esperado, "argumento de " + campos["nome"])
            # Pontas pertencem ao dominio dos movimentos, nao a tabela de variaveis.
        else:
            raise ValueError(f"Instrucao AST desconhecida: {no.classe}")

    def expressao(self, no):
        campos = no.campos
        if no.classe == "Num":
            return campos["tipo"]
        if no.classe == "Texto":
            return "texto"
        if no.classe == "Booleano":
            return "booleano"
        if no.classe == "Var":
            simbolo = self.buscar(no)
            return simbolo.tipo if simbolo is not None else None
        if no.classe == "Unario":
            tipo = self.expressao(campos["valor"])
            if tipo is None:
                return None
            if tipo not in self.NUMERICOS:
                self.erro(no, "S005", f"operador '-' unario exige numero; recebeu {tipo}.")
                return None
            return tipo
        if no.classe != "Op":
            raise ValueError(f"Expressao AST desconhecida: {no.classe}")

        esquerda = self.expressao(campos["esquerda"])
        direita = self.expressao(campos["direita"])
        if esquerda is None or direita is None:
            return None
        operador = campos["operador"]
        numericos = esquerda in self.NUMERICOS and direita in self.NUMERICOS
        if operador in {"+", "-", "*", "/"} and numericos:
            return "real" if operador == "/" or "real" in {esquerda, direita} else "inteiro"
        if operador in {">", "<"} and numericos:
            return "booleano"
        if operador == "==" and (esquerda == direita or numericos):
            return "booleano"
        if operador in {"e", "ou"} and esquerda == direita == "booleano":
            return "booleano"
        self.erro(no, "S005", f"operador '{operador}' nao aceita {esquerda} e {direita}.")
        return None


def analisar_semantica(codigo, recuperar=False):
    """Valida a entrada inteira e devolve AST e simbolos somente sem erros."""
    return AnalisadorSemantico().analisar(construir_ast(codigo, recuperar=recuperar))


def formatar_simbolos(simbolos):
    linhas = ["Tabela de simbolos:", "no | escopo | nome | tipo | linha:coluna"]
    for simbolo in simbolos:
        linhas.append(f"{simbolo.definicao!r} | {simbolo.escopo} | {simbolo.nome} | "
                      f"{simbolo.tipo} | {simbolo.linha}:{simbolo.coluna}")
    if not simbolos:
        linhas.append("(nenhuma variavel declarada)")
    return "\n".join(linhas)


def main(argv=None):
    argumentos = argparse.ArgumentParser(description="Valida nomes, escopos e tipos da Amarra.")
    argumentos.add_argument("arquivo", type=Path)
    argumentos.add_argument("--ast", action="store_true", help="mostra a AST apos a validacao")
    argumentos.add_argument("--simbolos", action="store_true", help="mostra as declaracoes por escopo")
    argumentos.add_argument("--recuperar", action="store_true", help="coleta erros de sintaxe antes de encerrar")
    args = argumentos.parse_args(argv)
    try:
        resultado = analisar_semantica(args.arquivo.read_text(encoding="utf-8"), args.recuperar)
    except (OSError, UnicodeError) as erro:
        print(f"Nao foi possivel ler '{args.arquivo}': {erro}", file=sys.stderr)
        return 1
    except ErroAnalise as erro:
        print(erro, file=sys.stderr)
        return 1
    print("Analise semantica concluida sem erros.")
    if args.ast:
        print("Arvore sintatica abstrata (AST):")
        print(formatar_ast(resultado.ast))
    if args.simbolos:
        print(formatar_simbolos(resultado.simbolos))
    return 0


if __name__ == "__main__":
    sys.exit(main())
