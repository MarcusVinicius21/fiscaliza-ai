import os
import io
import json
import requests
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
app = FastAPI(title="Fiscaliza.AI Backend - Etapa 4")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuração do Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# ==========================================================
# MOTOR DE MAPEAMENTO (IA + FALLBACK MANUAL)
# ==========================================================
def map_columns_semantic(columns_list, category):
    """
    Usa a IA configurada para mapear as colunas da prefeitura para o nosso padrão.
    Se a IA falhar ou o provider for 'none', usa o Fallback Manual garantido.
    """
    provider = os.getenv("AI_PROVIDER", "none").lower()
    prompt = f"""
    Mapeie estas colunas do arquivo do tipo '{category}': {columns_list}.
    Para o padrão do nosso sistema: ['nome_credor_servidor', 'documento', 'valor_bruto'].
    Responda APENAS com um JSON válido no formato {{"coluna_original": "coluna_padrao"}}.
    Ignore colunas que não se encaixam no padrão. Não invente colunas.
    """

    print(f"Tentando mapeamento com provedor: {provider}")

    try:
        # 1. Estratégia Principal: Gemini
        if provider == "gemini" and os.getenv("GEMINI_API_KEY"):
            import google.generativeai as genai
            genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(prompt)
            json_str = response.text.replace('```json', '').replace('```', '').strip()
            return json.loads(json_str)

        # 2. Estratégias Reservas: Groq ou OpenRouter (via requests puro)
        elif provider in ["groq", "openrouter"]:
            api_key = os.getenv("GROQ_API_KEY") if provider == "groq" else os.getenv("OPENROUTER_API_KEY")
            url = "https://api.groq.com/openai/v1/chat/completions" if provider == "groq" else "https://openrouter.ai/api/v1/chat/completions"
            model = "llama3-8b-8192" if provider == "groq" else "mistralai/mistral-7b-instruct"
            
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {"model": model, "messages": [{"role": "user", "content": prompt}]}
            
            resp = requests.post(url, headers=headers, json=payload, timeout=15)
            resp.raise_for_status()
            json_str = resp.json()['choices']['message']['content'].replace('```json', '').replace('```', '').strip()
            return json.loads(json_str)
            
    except Exception as e:
        print(f"Aviso: IA ({provider}) falhou ou não configurada. Erro: {e}")

    # ==========================================
    # FALLBACK MANUAL (Plano B à prova de balas)
    # ==========================================
    print("Acionando Mapeamento Manual (Fallback)...")
    mapping = {}
    for col in columns_list:
        col_lower = str(col).lower().strip()
        # Se achar alguma dessas palavras na coluna original, mapeia para nome
        if any(x in col_lower for x in ["nome", "servidor", "favorecido", "credor", "razao social"]):
            mapping[col] = "nome_credor_servidor"
        # Mapeia para documento
        elif any(x in col_lower for x in ["cpf", "cnpj", "documento"]):
            mapping[col] = "documento"
        # Mapeia para valor
        elif any(x in col_lower for x in ["valor", "bruto", "vencimento", "remuneracao", "total", "liquido"]):
            mapping[col] = "valor_bruto"
    return mapping

# ==========================================================
# ROTA DE PROCESSAMENTO SÍNCRONO
# ==========================================================
@app.post("/process/{upload_id}")
async def process_upload(upload_id: str):
    try:
        res = supabase.table("uploads").select("*").eq("id", upload_id).execute()
        
        if not res.data or len(res.data) == 0:
            raise HTTPException(status_code=404, detail="Registro de upload não encontrado no banco.")
        upload_record = res.data[0]
        
        if upload_record["status"] == "processed":
            return {"message": "Este arquivo já foi processado anteriormente."}

        file_path = upload_record["file_path"]
        category = upload_record["category"]
        city_id = upload_record["city_id"]

        # 2. Baixar arquivo do Supabase Storage
        print(f"Baixando arquivo: {file_path}...")
        storage_res = supabase.storage.from_("uploads").download(file_path)
        file_bytes = io.BytesIO(storage_res)

        # 3. Leitura com Pandas (Proteção contra diferentes formatações)
        print("Lendo dados com Pandas...")
        if file_path.lower().endswith(".csv"):
            try:
                # Tenta ler com padrão brasileiro (separador ponto e vírgula, acentos em latin1)
                df = pd.read_csv(file_bytes, sep=';', encoding='latin1', on_bad_lines='skip')
            except Exception:
                # Fallback do pandas: tenta descobrir sozinho
                file_bytes.seek(0)
                df = pd.read_csv(file_bytes, sep=None, engine='python', encoding='utf-8')
        else:
            # Lê arquivos Excel (xls, xlsx)
            df = pd.read_excel(file_bytes)

        # 4. Traduzir as Colunas
        original_cols = df.columns.tolist()
        mapped_dict = map_columns_semantic(original_cols, category)
        print(f"Colunas mapeadas: {mapped_dict}")
        
        # Renomeia no dataframe
        df.rename(columns=mapped_dict, inplace=True)

        # Filtra só o que a gente quer salvar
        target_cols = ["nome_credor_servidor", "documento", "valor_bruto"]
        cols_to_keep = [c for c in target_cols if c in df.columns]
        df_clean = df[cols_to_keep].copy()

        # 5. Limpeza Pesada (Dinheiro sujo em Dinheiro numérico)
        if "valor_bruto" in df_clean.columns:
            # Ex: "R$ 1.500,50" -> "1500.50"
            df_clean["valor_bruto"] = (
                df_clean["valor_bruto"]
                .astype(str)
                .str.replace(r'[R$\s]', '', regex=True) # tira R$ e espaços
                .str.replace('.', '', regex=False)      # tira ponto de milhar
                .str.replace(',', '.', regex=False)     # troca virgula por ponto decimal
                .astype(float, errors='ignore')         # converte pra float
            )

        # Tira linhas totalmente vazias
        df_clean = df_clean.dropna(how="all")
        # Preenche espaços vazios com zero ou texto para não quebrar o banco
        df_clean = df_clean.fillna("Não informado")

        # 6. Preparar a Lista para Salvar no Banco
        records_to_insert = []
        for _, row in df_clean.iterrows():
            row_dict = row.to_dict()
            row_dict["upload_id"] = upload_id
            row_dict["city_id"] = city_id
            row_dict["category"] = category
            
            # Ajuste de segurança
            if "valor_bruto" in row_dict and row_dict["valor_bruto"] == "Não informado":
                row_dict["valor_bruto"] = 0.0
                
            records_to_insert.append(row_dict)

        # 7. Salvar no Supabase em Lotes (Batch Insert)
        # Em vez de salvar 100 mil linhas de uma vez e travar a API, mandamos de 1000 em 1000
        print(f"Iniciando gravação de {len(records_to_insert)} linhas no banco...")
        batch_size = 1000
        for i in range(0, len(records_to_insert), batch_size):
            batch = records_to_insert[i:i + batch_size]
            supabase.table("standardized_records").insert(batch).execute()

        # 8. Mudar o Status para Sucesso
        supabase.table("uploads").update({"status": "processed"}).eq("id", upload_id).execute()
        
        print("Processamento finalizado com sucesso!")
        return {"status": "success", "linhas_processadas": len(records_to_insert)}

    except Exception as e:
        # Se qualquer coisa der errado (arquivo quebrado, etc), salva o status de erro
        print(f"Erro Crítico no processo: {e}")
        supabase.table("uploads").update({"status": "error"}).eq("id", upload_id).execute()
        raise HTTPException(status_code=500, detail=str(e))