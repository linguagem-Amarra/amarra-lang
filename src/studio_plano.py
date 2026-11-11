"""AST e interpretador do Studio. A gramática e o analisador E3 permanecem intactos.

O plano contém operações resolvidas, nunca objetos ANTLR ou código Python executável.
"""

import math
from dataclasses import dataclass

from gerado.AmarraParserVisitor import AmarraParserVisitor
from src.sintatico import analisar


@dataclass
class FalhaStudio(Exception):
    mensagem: str
    origem: dict
    nos: object = None

    def __str__(self):
        return self.mensagem


def origem(ctx):
    return {
        "linha": ctx.start.line, "coluna": ctx.start.column,
        "fimLinha": ctx.stop.line,
        "fimColuna": ctx.stop.column + len(ctx.stop.text or ""),
    }


class ConstruirAST(AmarraParserVisitor):
    """Retira pontuação, mantendo estrutura, precedência e posições do programa."""

    def node(self, ctx, kind, **campos):
        return {"tipo": kind, "origem": origem(ctx), **campos}

    def visitPrograma(self, ctx):
        return [self.visit(item) for item in ctx.definicaoNo()]

    def visitDefinicaoNo(self, ctx):
        return self.node(ctx, "no", nome=ctx.TEXTO().getText()[1:-1], corpo=self.visit(ctx.bloco()))

    def visitBloco(self, ctx):
        return [self.visit(item) for item in ctx.instrucao()]

    def visitInstrucao(self, ctx):
        return self.visit(ctx.getChild(0))

    def visitDeclaracao(self, ctx):
        return self.node(ctx, "declaracao", nome=ctx.IDENT().getText(),
                         tipoValor=ctx.tipo().getText(), valor=self.visit(ctx.expr()))

    def visitAtribuicao(self, ctx):
        return self.node(ctx, "atribuicao", nome=ctx.IDENT().getText(), valor=self.visit(ctx.expr()))

    def visitComando(self, ctx):
        return self.node(ctx, "comando", acao=ctx.getChild(0).getText(),
                         pontas=[item.getText() for item in ctx.IDENT()],
                         valor=self.visit(ctx.expr()) if ctx.expr() else None)

    def visitRepeticao(self, ctx):
        return self.node(ctx, "repeticao", valor=self.visit(ctx.expr()), corpo=self.visit(ctx.bloco()))

    def visitCondicional(self, ctx):
        return self.node(ctx, "condicional", valor=self.visit(ctx.expr()),
                         entao=self.visit(ctx.bloco(0)),
                         senao=self.visit(ctx.bloco(1)) if len(ctx.bloco()) == 2 else [])

    def visitAgrupada(self, ctx):
        return self.visit(ctx.expr())

    def visitSinal(self, ctx):
        return self.node(ctx, "unaria", valor=self.visit(ctx.expr()))

    def binaria(self, ctx):
        return self.node(ctx, "binaria", operador=ctx.getChild(1).getText(),
                         esquerda=self.visit(ctx.expr(0)), direita=self.visit(ctx.expr(1)))

    visitMultiplicativa = binaria
    visitAditiva = binaria
    visitComparacao = binaria
    visitConjuncao = binaria
    visitDisjuncao = binaria

    def visitNumero(self, ctx):
        texto = ctx.getText()
        return self.node(ctx, "literal", valor=float(texto) if "." in texto else int(texto))

    def visitTexto(self, ctx):
        return self.node(ctx, "literal", valor=ctx.getText()[1:-1])

    def visitBooleano(self, ctx):
        return self.node(ctx, "literal", valor=ctx.getText() == "verdadeiro")

    def visitIdentificador(self, ctx):
        return self.node(ctx, "identificador", nome=ctx.getText())


class Interpretador:
    MAX_PASSOS = 500
    MAX_ITERACOES = 2000

    def __init__(self):
        self.escopos = [{}]
        self.passos = []
        self.pontas = None
        self.cruzamento = False
        self.finalizado = False
        self.iteracoes = 0

    def falhar(self, no, mensagem):
        raise FalhaStudio(mensagem, no["origem"])

    def buscar(self, no, nome):
        for escopo in reversed(self.escopos):
            if nome in escopo:
                return escopo[nome]
        self.falhar(no, f"Variável '{nome}' não declarada.")

    def numero(self, no, valor):
        if type(valor) not in (int, float) or not math.isfinite(valor):
            self.falhar(no, "Esta operação exige um número finito.")
        return valor

    def booleano(self, no, valor):
        if type(valor) is not bool:
            self.falhar(no, "A condição deve produzir um booleano.")
        return valor

    def avaliar(self, no):
        tipo = no["tipo"]
        if tipo == "literal":
            valor = no["valor"]
            if type(valor) in (int, float):
                self.numero(no, valor)
            return valor
        if tipo == "identificador":
            return self.buscar(no, no["nome"])["valor"]
        if tipo == "unaria":
            return -self.numero(no, self.avaliar(no["valor"]))
        a = self.avaliar(no["esquerda"])
        op = no["operador"]
        if op == "e":
            return self.booleano(no, a) and self.booleano(no, self.avaliar(no["direita"]))
        if op == "ou":
            return self.booleano(no, a) or self.booleano(no, self.avaliar(no["direita"]))
        b = self.avaliar(no["direita"])
        if op == "==":
            if type(a) is not type(b) and not (type(a) in (int, float) and type(b) in (int, float)):
                self.falhar(no, "A comparação exige valores de tipos compatíveis.")
            return a == b
        a, b = self.numero(no, a), self.numero(no, b)
        if op == "/" and b == 0:
            self.falhar(no, "Divisão por zero.")
        if op == "+":
            resultado = a + b
        elif op == "-":
            resultado = a - b
        elif op == "*":
            resultado = a * b
        elif op == "/":
            resultado = a / b
        elif op == ">":
            return a > b
        else:
            return a < b
        return self.numero(no, resultado)

    def atribuir(self, no, tipo, valor):
        valido = {
            "inteiro": type(valor) is int,
            "real": type(valor) in (int, float),
            "texto": type(valor) is str,
            "booleano": type(valor) is bool,
        }[tipo]
        if not valido:
            self.falhar(no, f"O valor de '{no['nome']}' é incompatível com o tipo {tipo}.")
        return {"tipo": tipo, "valor": float(valor) if tipo == "real" else valor}

    def bloco(self, instrucoes, novo_escopo=True):
        if novo_escopo:
            self.escopos.append({})
        try:
            for no in instrucoes:
                if self.finalizado:
                    break
                self.executar(no)
        finally:
            if novo_escopo:
                self.escopos.pop()

    def executar(self, no):
        tipo = no["tipo"]
        if tipo == "declaracao":
            if no["nome"] in self.escopos[-1]:
                self.falhar(no, f"Variável '{no['nome']}' já declarada neste bloco.")
            self.escopos[-1][no["nome"]] = self.atribuir(no, no["tipoValor"], self.avaliar(no["valor"]))
        elif tipo == "atribuicao":
            entrada = self.buscar(no, no["nome"])
            entrada.update(self.atribuir(no, entrada["tipo"], self.avaliar(no["valor"])))
        elif tipo == "condicional":
            condicao = self.booleano(no, self.avaliar(no["valor"]))
            self.bloco(no["entao"] if condicao else no["senao"])
        elif tipo == "repeticao":
            quantidade = self.avaliar(no["valor"])
            if type(quantidade) is not int or not 0 <= quantidade <= self.MAX_ITERACOES:
                self.falhar(no, f"A repetição exige um inteiro entre 0 e {self.MAX_ITERACOES}.")
            for _ in range(quantidade):
                self.iteracoes += 1
                if self.iteracoes > self.MAX_ITERACOES:
                    self.falhar(no, "Limite total de iterações excedido.")
                self.bloco(no["corpo"])
                if self.finalizado:
                    break
        else:
            self.comando(no)

    def comando(self, no):
        acao, pontas = no["acao"], no["pontas"]
        valor = self.avaliar(no["valor"]) if no["valor"] is not None else None
        if acao == "cruzar":
            if pontas[0] == pontas[1]:
                self.falhar(no, "Cruze duas pontas diferentes.")
            if self.pontas is None:
                self.pontas = list(pontas)
            elif set(pontas) != set(self.pontas):
                self.falhar(no, "A cena contém uma corda com duas pontas: " + ", ".join(self.pontas) + ".")
            self.cruzamento = True
        elif acao in ("passar_baixo", "passar_cima", "enrolar", "apertar"):
            if not self.cruzamento:
                self.falhar(no, "Use cruzar para estabelecer um cruzamento antes deste movimento.")
            if pontas and pontas[0] not in self.pontas:
                self.falhar(no, f"Ponta '{pontas[0]}' desconhecida. Disponíveis: {', '.join(self.pontas)}.")
        if acao == "enrolar" and (type(valor) is not int or not 1 <= valor <= 12):
            self.falhar(no, "O visualizador aceita de 1 a 12 voltas inteiras por enrolamento.")
        if acao == "finalizar":
            self.finalizado = True
        if len(self.passos) >= self.MAX_PASSOS:
            self.falhar(no, f"O plano excede {self.MAX_PASSOS} movimentos.")
        self.passos.append({
            "id": len(self.passos), "acao": acao, "pontas": pontas, "valor": valor,
            "origem": no["origem"], "duracao": 2.6 if acao != "finalizar" else 1.0,
        })


def compilar(codigo, selecionado=0):
    arvore, _ = analisar(codigo, recuperar=True)
    nos = ConstruirAST().visit(arvore)
    if not 0 <= selecionado < len(nos):
        raise FalhaStudio("Definição de nó não encontrada.", nos[0]["origem"])
    catalogo = [{"id": i, "nome": no["nome"]} for i, no in enumerate(nos)]
    interpretador = Interpretador()
    try:
        interpretador.bloco(nos[selecionado]["corpo"], novo_escopo=False)
    except FalhaStudio as erro:
        erro.nos = catalogo
        raise
    return {
        "versao": 1, "ok": True, "diagnosticos": [],
        "nos": catalogo,
        "selecionado": selecionado, "nome": nos[selecionado]["nome"],
        "pontas": interpretador.pontas or ["ponta_direita", "ponta_esquerda"],
        "passos": interpretador.passos,
        "variaveis": interpretador.escopos[0],
    }
