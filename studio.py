"""Inicia o Amarra Studio local em http://127.0.0.1:8000."""

import argparse
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    raiz = Path(__file__).resolve().parent
    if not (raiz / "web/studio/dist/index.html").exists():
        sys.exit("Interface ausente. Execute npm install e npm run build em web/studio/.")
    if not (raiz / "gerado/AmarraParserVisitor.py").exists():
        sys.exit("Analisadores ausentes. Execute python gerar.py primeiro.")
    try:
        import uvicorn
    except ModuleNotFoundError:
        sys.exit("Instale as dependências: python -m pip install -r requirements-studio.txt")
    print(f"Amarra Studio: http://127.0.0.1:{args.port}")
    uvicorn.run("src.studio_api:app", host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    main()
