#!/bin/bash
# Regenera o código do ANTLR a partir da gramática
antlr4 -Dlanguage=Python3 -visitor -o gerado gramatica/Amarra.g4
