# Fiscaliza.AI - Etapa 1

Plataforma web enxuta para operação assistida de dados da transparência.

## Frontend (Next.js)

1. Acesse a pasta do frontend: `cd frontend`
2. Instale as dependências: `npm install`
3. Crie o arquivo `.env.local` copiando do `.env.local.example` e coloque suas chaves do Supabase.
4. Rode o projeto: `npm run dev`
5. Acesse `http://localhost:3000`

## Backend (FastAPI / Python)

1. Acesse a pasta do backend: `cd backend`
2. Crie e ative o ambiente virtual:
   - Windows: `python -m venv venv` e depois `.\venv\Scripts\activate`
3. Instale as dependências: `pip install -r requirements.txt`
4. Suba o servidor: `uvicorn app.main:app --reload`
5. Acesse `http://127.0.0.1:8000` (A documentação swagger fica em `/docs`)