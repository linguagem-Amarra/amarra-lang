"""Executa a AST validada e produz um roteiro de movimentos, sem eval/exec."""

import math
from dataclasses import dataclass

from src.diagnosticos import ErroAnalise


@dataclass(frozen=True)
class DiagnosticoExecucao:
    codigo: str
    linha: int
    coluna: int
    mensagem: str
    fase: str = "execucao"

    def __str__(self):
        return (f"Erro de execucao na linha {self.linha}, coluna {self.coluna} "
                f"[{self.codigo}]: {self.mensagem}")


class Finalizacao(Exception):
    """Encerra somente a definicao de no atual, inclusive dentro de blocos."""


class Interpretador:
    def __init__(self, max_passos=300, max_operacoes=20000):
        self.max_passos = max_passos
        self.max_operacoes = max_operacoes
        self.operacoes = 0
        self.total_passos = 0
        self.escopos = []
        self.passos = []

    def erro(self, no, codigo, mensagem):
        raise ErroAnalise([DiagnosticoExecucao(codigo, no.linha, no.coluna, mensagem)])

    def contar(self, no):
        self.operacoes += 1
        if self.operacoes > self.max_operacoes:
            self.erro(no, "E003", "Limite de operacoes atingido. Reduza as repeticoes.")

    def numero(self, no, valor):
        if ((isinstance(valor, float) and not math.isfinite(valor)) or
                (type(valor) is int and valor.bit_length() > 1000)):
            self.erro(no, "E004", "Numero fora do limite suportado pela demonstracao.")
        return valor

    def expressao(self, no):
        self.contar(no)
        c = no.campos
        if no.classe == "Num":
            if len(c["valor"]) > 310:
                self.erro(no, "E004", "Literal numerico muito longo.")
            return self.numero(no, float(c["valor"]) if c["tipo"] == "real" else int(c["valor"]))
        if no.classe in {"Texto", "Booleano"}:
            return c["valor"]
        if no.classe == "Var":
            return self.localizar(c["nome"])[c["nome"]][1]
        if no.classe == "Unario":
            return self.numero(no, -self.expressao(c["valor"]))
        a = self.expressao(c["esquerda"])
        op = c["operador"]
        if op == "e":
            return a and self.expressao(c["direita"])
        if op == "ou":
            return a or self.expressao(c["direita"])
        b = self.expressao(c["direita"])
        if op == "/" and b == 0:
            self.erro(no, "E001", "Divisao por zero.")
        operacoes = {"+": lambda: a + b, "-": lambda: a - b, "*": lambda: a * b,
                     "/": lambda: a / b, ">": lambda: a > b, "<": lambda: a < b,
                     "==": lambda: a == b}
        try:
            return self.numero(no, operacoes[op]())
        except OverflowError:
            self.erro(no, "E004", "Resultado numerico fora do limite suportado.")

    def localizar(self, nome):
        for tabela in reversed(self.escopos):
            if nome in tabela:
                return tabela
        raise ValueError("A AST precisa passar pela analise semantica antes da execucao.")

    def quantidade(self, no, expressao):
        valor = self.expressao(expressao)
        if valor < 0:
            self.erro(no, "E002", "A quantidade de repeticoes ou voltas nao pode ser negativa.")
        if valor > self.max_operacoes:
            self.erro(no, "E003", "Quantidade muito grande para a demonstracao.")
        return valor

    def registrar(self, no, pontas, **extras):
        self.total_passos += 1
        if self.total_passos > self.max_passos:
            self.erro(no, "E003", f"O roteiro ultrapassa {self.max_passos} etapas. Reduza as repeticoes.")
        variaveis = {}
        for tabela in self.escopos:
            variaveis.update({nome: valor for nome, (_, valor) in tabela.items()})
        self.passos.append(dict(acao=no.campos["nome"], pontas=pontas, linha=no.linha,
                                coluna=no.coluna, variaveis=variaveis, **extras))

    def bloco(self, no):
        self.escopos.append({})
        try:
            for item in no.campos["instrucoes"]:
                self.contar(item)
                c = item.campos
                if item.classe == "Declara":
                    valor = self.expressao(c["valor"])
                    if c["tipo"] == "real":
                        valor = self.numero(item, float(valor))
                    self.escopos[-1][c["nome"]] = (c["tipo"], valor)
                elif item.classe == "Atribui":
                    tabela = self.localizar(c["nome"])
                    tipo = tabela[c["nome"]][0]
                    valor = self.expressao(c["valor"])
                    if tipo == "real":
                        valor = self.numero(item, float(valor))
                    tabela[c["nome"]] = (tipo, valor)
                elif item.classe == "Se":
                    ramo = c["entao"] if self.expressao(c["condicao"]) else c["senao"]
                    if ramo is not None:
                        self.bloco(ramo)
                elif item.classe == "Repetir":
                    for _ in range(self.quantidade(item, c["quantidade"])):
                        self.contar(item)
                        self.bloco(c["corpo"])
                elif item.classe == "Comando":
                    pontas = [p.campos["nome"] for p in c["pontas"]]
                    if c["nome"] == "enrolar":
                        quantidade = self.quantidade(item, c["valor"])
                        for volta in range(quantidade):
                            self.registrar(item, pontas, volta=volta + 1, quantidade=quantidade)
                    elif c["nome"] == "finalizar":
                        self.registrar(item, pontas, mensagem=self.expressao(c["valor"]))
                        raise Finalizacao()
                    else:
                        if c["nome"] == "cruzar" and pontas[0] == pontas[1]:
                            self.erro(item, "E005", "Use duas pontas diferentes no comando cruzar.")
                        self.registrar(item, pontas)
        finally:
            self.escopos.pop()

    def executar(self, ast):
        planos = []
        for definicao in ast.campos["definicoes"]:
            self.passos = []
            try:
                self.bloco(definicao.campos["corpo"])
            except Finalizacao:
                pass
            nomes = list(dict.fromkeys(p for passo in self.passos for p in passo["pontas"]))
            planos.append(dict(nome=definicao.campos["nome"], passos=self.passos, pontas=nomes))
        return planos
