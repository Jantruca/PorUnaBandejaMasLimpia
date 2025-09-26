from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core import get_emails, analyse_emails

app = FastAPI(title="Email Analyzer API", version="1.0.0")
emails = []

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # 🔓 Permite todos los orígenes (cámbialo a ["http://localhost:5173"] si quieres solo el frontend)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/emails")
def fetch_emails(limit: int = 20):
    """
    Endpoint para obtener correos electrónicos.
    - `limit`: número de correos a recuperar.
    """
    global emails
    emails = get_emails()
    return {"emails": emails[:limit]}


@app.get("/analyse")
def analyse_emails_endpoint():
    """
    Endpoint para analizar correos electrónicos y devolver categorías + resúmenes.
    - `limit`: número de correos a analizar.
    """
    global emails
    emails = get_emails()
    resolved_emails = analyse_emails(emails)
    return {"analysis": resolved_emails}
