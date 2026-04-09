from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Fiscaliza.AI Backend",
    description="API de processamento de dados enxuta para operação assistida.",
    version="1.0.0"
)

# Libera o acesso do frontend Next.js (rodando em :3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "status": "ok", 
        "message": "Fiscaliza.AI API em funcionamento.",
        "etapa": "Fundação - Etapa 1"
    }

# TODO: Endpoint futuro para upload e tratamento de planilhas via Pandas
# TODO: Endpoint futuro para acionar IA interpretativa via OpenAI