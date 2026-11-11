"""API local do Amarra Studio; iniciar com python -m uvicorn src.studio_api:app."""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from src.diagnosticos import ErroAnalise
from src.studio_plano import FalhaStudio, compilar
from src.studio_nos import reconhecer_no


RAIZ = Path(__file__).resolve().parent.parent
app = FastAPI(title="Amarra Studio", version="0.1.0")


class Entrada(BaseModel):
    codigo: str = Field(max_length=32000)
    selecionado: int = Field(default=0, ge=0)


@app.get("/api/health")
def health():
    return {"status": "ok", "compilador": "ANTLR 4.13.2", "versao": 1}


@app.get("/api/exemplos")
def exemplos():
    itens = [
        ("no_simples", "Nó simples", "O primeiro encontro entre duas pontas.", "01"),
        ("no_simples_duplo", "Nó reforçado", "Nó simples duplo: duas passagens pelo mesmo laço.", "02"),
        ("no_windsor", "Windsor", "Explore a sequência do nó de gravata.", "03"),
    ]
    return [{"id": ident, "nome": nome, "descricao": descricao, "numero": numero,
             "codigo": (RAIZ / "exemplos" / (ident + ".amr")).read_text(encoding="utf-8")}
            for ident, nome, descricao, numero in itens]


@app.post("/api/compilar")
def analisar_plano(entrada: Entrada):
    try:
        plano = compilar(entrada.codigo, entrada.selecionado)
        animacao = reconhecer_no(plano)
        if animacao is not None:
            plano["animacao"] = animacao
        return plano
    except ErroAnalise as erro:
        return {"versao": 1, "ok": False, "passos": [], "diagnosticos": [
            {"fase": item.fase, "linha": item.linha, "coluna": item.coluna,
             "mensagem": str(item), "esperados": item.esperados, "encontrado": item.encontrado}
            for item in erro.diagnosticos
        ]}
    except FalhaStudio as erro:
        return {"versao": 1, "ok": False, "passos": [], "nos": erro.nos or [], "diagnosticos": [
            {"fase": "semantico", "mensagem": str(erro), **erro.origem}
        ]}
    except (RecursionError, OverflowError, ValueError):
        return {"versao": 1, "ok": False, "passos": [], "diagnosticos": [
            {"fase": "limite", "linha": 1, "coluna": 0,
             "mensagem": "A entrada excede os limites de profundidade ou tamanho numérico do Studio."}
        ]}


DIST = RAIZ / "web" / "studio" / "dist"
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/", include_in_schema=False)
def index():
    if not (DIST / "index.html").is_file():
        raise HTTPException(503, "Interface não compilada. Execute npm run build em web/studio/.")
    return FileResponse(DIST / "index.html")
