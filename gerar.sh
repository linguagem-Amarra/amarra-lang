#!/bin/bash
# Regenera o lexer usando o mesmo script disponivel no Windows.
set -eu
exec python3 "$(dirname "$0")/gerar.py"
