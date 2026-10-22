"""Recuperacao em modo panico usando as regras do parser gerado pelo ANTLR."""

from antlr4 import Token
from antlr4.error.ErrorStrategy import DefaultErrorStrategy
from antlr4.error.Errors import RecognitionException

from gerado.AmarraParser import AmarraParser
from src.diagnosticos import ErroAnalise


def sincronizar(parser, inicio):
    """Descarta a instrucao defeituosa ate ; ou o fim de seu bloco.

    Preserva a chave do bloco que chamou a instrucao. Chaves abertas dentro
    da instrucao descartada sao balanceadas, para nao fechar o bloco externo
    prematuramente. Parenteses e operadores nao sao pontos de sincronizacao.
    """
    tokens = parser.getTokenStream()
    profundidade = 0
    for token in tokens.tokens[inicio:tokens.index]:
        if token.type == parser.ABRE_CHAVE:
            profundidade += 1
        elif token.type == parser.FECHA_CHAVE:
            profundidade -= 1

    while parser.getCurrentToken().type != Token.EOF:
        tipo = parser.getCurrentToken().type
        if tipo == parser.FECHA_CHAVE:
            if profundidade == 0:
                return  # O bloco chamador ainda precisa consumir esta chave.
            profundidade -= 1
            parser.consume()
            if profundidade == 0 and parser.getCurrentToken().type != parser.SENAO:
                return
        elif tipo == parser.PONTOVIRG and profundidade == 0:
            parser.consume()
            return
        else:
            if tipo == parser.ABRE_CHAVE:
                profundidade += 1
            parser.consume()


class EstrategiaPanico(DefaultErrorStrategy):
    """Recupera tambem tokens que nao podem iniciar uma instrucao no bloco."""

    def sync(self, recognizer):
        if recognizer._ctx.getRuleIndex() != recognizer.RULE_bloco:
            return super().sync(recognizer)
        while True:
            inicio = recognizer.getTokenStream().index
            try:
                try:
                    super().sync(recognizer)
                except RecognitionException as erro:
                    self.reportError(recognizer, erro)
                return
            except ErroAnalise as erro:
                if recognizer.getCurrentToken().type == Token.EOF:
                    raise
                sincronizar(recognizer, inicio)
                if recognizer.getTokenStream().index == inicio:
                    raise  # Nao repetir indefinidamente um erro sem progresso.
                recognizer.diagnosticos.extend(erro.diagnosticos)
                self.reset(recognizer)


class ParserRecuperavel(AmarraParser):
    """Reutiliza a gramatica; intercepta falhas no limite de uma instrucao."""

    def __init__(self, tokens):
        super().__init__(tokens)
        self.diagnosticos = []
        self._errHandler = EstrategiaPanico()

    def instrucao(self):
        inicio = self.getTokenStream().index
        try:
            return super().instrucao()
        except ErroAnalise as erro:
            if self.getCurrentToken().type == Token.EOF:
                raise  # Nao ha ponto seguro para retomar depois do fim da entrada.
            self.diagnosticos.extend(erro.diagnosticos)
            sincronizar(self, inicio)
            self._errHandler.reset(self)
            # A arvore parcial fica interna: analisar() rejeita qualquer
            # resultado que contenha diagnosticos antes de devolver a arvore.
            return None
