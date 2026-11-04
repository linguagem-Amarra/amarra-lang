"""Constroi a AST com o visitor: python src/construtor_ast.py arquivo.amr."""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.sintatico import analisar, ErroAnalise
from src.arvore_abstrata import NoAST, formatar_ast

try:
    from gerado.AmarraParserVisitor import AmarraParserVisitor
except ModuleNotFoundError as erro:
    if erro.name != "gerado.AmarraParserVisitor":
        raise
    sys.exit("Visitor nao gerado. Na raiz do projeto, execute: python gerar.py")


class ConstrutorAST(AmarraParserVisitor):
    """Cada visita devolve um no proprio, nunca um contexto do ANTLR."""

    @staticmethod
    def no(classe, token, **campos):
        return NoAST(classe, token.line, token.column, campos)

    def visitPrograma(self, ctx):
        return self.no("Programa", ctx.start,
                       definicoes=[self.visit(item) for item in ctx.definicaoNo()])

    def visitDefinicaoNo(self, ctx):
        return self.no("DefinicaoNo", ctx.start,
                       nome=ctx.TEXTO().getText()[1:-1], corpo=self.visit(ctx.bloco()))

    def visitBloco(self, ctx):
        return self.no("Bloco", ctx.start,
                       instrucoes=[self.visit(item) for item in ctx.instrucao()])

    def visitInstrucao(self, ctx):
        # O segundo filho pode ser ';'; visitChildren perderia o resultado.
        return self.visit(ctx.getChild(0))

    def visitDeclaracao(self, ctx):
        return self.no("Declara", ctx.IDENT().getSymbol(), tipo=ctx.tipo().getText(),
                       nome=ctx.IDENT().getText(), valor=self.visit(ctx.expr()))

    def visitAtribuicao(self, ctx):
        return self.no("Atribui", ctx.IDENT().getSymbol(),
                       nome=ctx.IDENT().getText(), valor=self.visit(ctx.expr()))

    def visitComando(self, ctx):
        pontas = [self.no("Ponta", item.getSymbol(), nome=item.getText())
                  for item in ctx.IDENT()]
        campos = {"nome": ctx.start.text, "pontas": pontas}
        if ctx.expr() is not None:
            campos["valor"] = self.visit(ctx.expr())
        return self.no("Comando", ctx.start, **campos)

    def visitRepeticao(self, ctx):
        return self.no("Repetir", ctx.start, quantidade=self.visit(ctx.expr()),
                       corpo=self.visit(ctx.bloco()))

    def visitCondicional(self, ctx):
        blocos = ctx.bloco()
        return self.no("Se", ctx.start, condicao=self.visit(ctx.expr()),
                       entao=self.visit(blocos[0]),
                       senao=self.visit(blocos[1]) if len(blocos) == 2 else None)

    def visitAgrupada(self, ctx):
        # Os parenteses somem, mas a estrutura definida por eles permanece.
        return self.visit(ctx.expr())

    def visitNumero(self, ctx):
        texto = ctx.getText()
        # Mantem a grafia numerica exata, sem arredondar reais na construcao.
        return self.no("Num", ctx.start, valor=texto,
                       tipo="real" if "." in texto else "inteiro")

    def visitTexto(self, ctx):
        # A gramatica nao interpreta escapes; remove somente as aspas externas.
        return self.no("Texto", ctx.start, valor=ctx.getText()[1:-1])

    def visitBooleano(self, ctx):
        return self.no("Booleano", ctx.start, valor=ctx.getText() == "verdadeiro")

    def visitIdentificador(self, ctx):
        return self.no("Var", ctx.start, nome=ctx.getText())

    def visitSinal(self, ctx):
        return self.no("Unario", ctx.start, operador="-", valor=self.visit(ctx.expr()))

    def binaria(self, ctx, token):
        return self.no("Op", token, operador=token.text,
                       esquerda=self.visit(ctx.expr(0)), direita=self.visit(ctx.expr(1)))

    def visitMultiplicativa(self, ctx):
        return self.binaria(ctx, ctx.op)

    def visitAditiva(self, ctx):
        return self.binaria(ctx, ctx.op)

    def visitComparacao(self, ctx):
        return self.binaria(ctx, ctx.op)

    def visitConjuncao(self, ctx):
        return self.binaria(ctx, ctx.E().getSymbol())

    def visitDisjuncao(self, ctx):
        return self.binaria(ctx, ctx.OU().getSymbol())


def construir_ast(codigo, regra="programa", recuperar=False):
    if regra not in {"programa", "bloco", "expr"}:
        raise ValueError("A AST aceita as regras programa, bloco ou expr.")
    arvore, _ = analisar(codigo, regra=regra, recuperar=recuperar)
    return ConstrutorAST().visit(arvore)


def main(argv=None):
    argumentos = argparse.ArgumentParser(description="Constroi a arvore sintatica abstrata da Amarra.")
    argumentos.add_argument("arquivo", type=Path)
    argumentos.add_argument("--regra", choices=["programa", "bloco", "expr"], default="programa")
    argumentos.add_argument("--formato", choices=["indentado", "json"], default="indentado")
    argumentos.add_argument("--recuperar", action="store_true", help="coleta erros de sintaxe antes de encerrar")
    args = argumentos.parse_args(argv)
    try:
        raiz = construir_ast(args.arquivo.read_text(encoding="utf-8"), args.regra, args.recuperar)
    except (OSError, UnicodeError) as erro:
        print(f"Nao foi possivel ler '{args.arquivo}': {erro}", file=sys.stderr)
        return 1
    except ErroAnalise as erro:
        print(erro, file=sys.stderr)
        return 1
    if args.formato == "json":
        print(json.dumps(raiz.para_dict(), ensure_ascii=False, indent=2))
    else:
        print("Arvore sintatica abstrata (AST):")
        print(formatar_ast(raiz))
    return 0


if __name__ == "__main__":
    sys.exit(main())
