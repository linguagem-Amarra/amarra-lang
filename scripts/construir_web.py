"""Empacota o compilador e a interface estatica para GitHub Pages ou Vercel."""

import json
import shutil
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import antlr4


RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from src.studio_exemplos import listar_exemplos


def construir():
    for nome in ("AmarraLexer.py", "AmarraParser.py", "AmarraParserVisitor.py"):
        if not (RAIZ / "gerado" / nome).is_file():
            raise SystemExit("Execute python gerar.py antes de construir a interface.")
    saida = RAIZ / "dist"
    saida.mkdir(exist_ok=True)
    classico = saida / "classico"
    classico.mkdir(exist_ok=True)
    for arquivo in (RAIZ / "web").iterdir():
        if arquivo.is_file():
            shutil.copy2(arquivo, classico / arquivo.name)
    (saida / ".nojekyll").write_text("", encoding="utf-8")
    with ZipFile(saida / "compilador.zip", "w", ZIP_DEFLATED) as pacote:
        pacote.write(RAIZ / "web" / "ANTLR-LICENSE.txt", "ANTLR-LICENSE.txt")
        for pasta, destino in [(RAIZ / "src", "src"), (RAIZ / "gerado", "gerado"),
                                (Path(antlr4.__file__).parent, "antlr4")]:
            for arquivo in sorted(pasta.rglob("*.py")):
                pacote.write(arquivo, str(Path(destino) / arquivo.relative_to(pasta)))
            if not (pasta / "__init__.py").exists():
                pacote.writestr(destino + "/__init__.py", "")
    shutil.copy2(saida / "compilador.zip", classico / "compilador.zip")
    studio = RAIZ / "web" / "studio" / "dist"
    if not (studio / "index.html").is_file():
        raise SystemExit("Execute npm run build em web/studio/ antes de construir o site.")
    shutil.copytree(studio, saida, dirs_exist_ok=True)
    (saida / "examples.json").write_text(
        json.dumps(listar_exemplos(RAIZ), ensure_ascii=False), encoding="utf-8")
    print("Studio 3D pronto em dist/; interface clássica em dist/classico/.")


if __name__ == "__main__":
    construir()
