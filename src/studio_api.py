"""API local do Amarra Studio; iniciar com python -m uvicorn src.studio_api:app."""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from src.studio_exemplos import listar_exemplos
from src.studio_web import analisar


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
    return listar_exemplos(RAIZ)


@app.post("/api/compilar")
def analisar_plano(entrada: Entrada):
    return analisar(entrada.codigo, entrada.selecionado)


DIST = RAIZ / "web" / "studio" / "dist"
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/", include_in_schema=False)
def index():
    if not (DIST / "index.html").is_file():
        raise HTTPException(503, "Interface não compilada. Execute npm run build em web/studio/.")
    return FileResponse(DIST / "index.html")
