"""Observa os contextos do parser ANTLR durante a analise (Aula 11)."""

from dataclasses import dataclass
from typing import Tuple

from antlr4 import Token
from antlr4.tree.Tree import ParseTreeListener


@dataclass(frozen=True)
class EventoPilha:
    acao: str
    regra: str
    pilha: Tuple[str, ...]
    tipo_token: str
    texto_token: str
    linha: int
    coluna: int


class RastreadorPilha(ParseTreeListener):
    """Registra eventos reais da analise, sem implementar outro reconhecedor.

    A pilha exibida vem dos contextos mantidos pelo ANTLR. Nas regras com
    recursao a esquerda, ela reflete a transformacao feita pelo gerador.
    """

    def __init__(self, parser, registrar):
        self.parser = parser
        self.registrar = registrar

    def _emitir(self, acao, contexto, token, contexto_pilha):
        pilha = ()
        if contexto_pilha is not None:
            pilha = tuple(reversed(self.parser.getRuleInvocationStack(contexto_pilha)))
        nome_token = (
            "EOF" if token.type == Token.EOF else self.parser.symbolicNames[token.type]
        )
        self.registrar(EventoPilha(
            acao=acao,
            regra=self.parser.ruleNames[contexto.getRuleIndex()],
            pilha=pilha,
            tipo_token=nome_token,
            texto_token=token.text,
            linha=token.line,
            coluna=token.column,
        ))

    def enterEveryRule(self, ctx):
        self._emitir("ENTRAR", ctx, self.parser.getCurrentToken(), ctx)

    def exitEveryRule(self, ctx):
        # Mostra o contexto ao qual o parser retorna depois desta saida.
        self._emitir("SAIR", ctx, self.parser.getCurrentToken(), ctx.parentCtx)

    def visitTerminal(self, node):
        self._emitir("CONSUMIR", node.parentCtx, node.getSymbol(), node.parentCtx)


def formatar_evento(evento):
    pilha = " > ".join(evento.pilha) or "(vazia)"
    rotulo_token = "lido" if evento.acao == "CONSUMIR" else "proximo"
    return (
        f"{evento.acao:<8} {evento.regra:<12} "
        f"{rotulo_token}={evento.tipo_token} {evento.texto_token!r} "
        f"@ {evento.linha}:{evento.coluna} | pilha[{len(evento.pilha)}]: {pilha}"
    )
