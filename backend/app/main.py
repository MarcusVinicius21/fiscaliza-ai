import os
import io
import json
import re
import time

import google.generativeai as genai
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Fiscaliza.AI Backend - Etapa 4.5 Definitiva")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# ==========================================================
# 1. SMART PARSER ROBUSTO
# ==========================================================
def smart_read_csv(file_bytes):
    """
    Testa múltiplas combinações e pontua os dataframes.
    Rejeita ativamente leituras de coluna única (falsos CSVs).
    """
    encodings = ["utf-8", "latin1", "windows-1252"]
    separators = [";", ",", "\t", "|"]

    best_df = None
    best_score = -50000

    file_bytes.seek(0)
    raw_bytes = file_bytes.read()

    for enc in encodings:
        try:
            decoded = raw_bytes.decode(enc)
        except UnicodeDecodeError:
            continue

        for sep in separators:
            try:
                test_buffer = io.StringIO(decoded)
                df = pd.read_csv(test_buffer, sep=sep, on_bad_lines="skip")

                # Limpeza extrema: dropa colunas e linhas que são 100% lixo/vazias
                df = df.dropna(how="all", axis=1).dropna(how="all", axis=0)

                num_cols = len(df.columns)
                num_rows = len(df)

                # Pontuação: valoriza mais colunas e linhas válidas
                score = (num_cols * 1000) + num_rows

                # Punição severa se o Pandas engoliu tudo numa coluna só
                if num_cols == 1:
                    score -= 10000

                if score > best_score:
                    best_score = score
                    best_df = df
            except Exception:
                continue

    # Fallback automático do Pandas caso o arquivo seja muito caótico
    if best_df is None or len(best_df.columns) < 2:
        try:
            text = raw_bytes.decode("utf-8", errors="replace")
            best_df = pd.read_csv(
                io.StringIO(text),
                sep=None,
                engine="python",
                on_bad_lines="skip",
            )
        except Exception:
            raise ValueError("Falha catastrófica: Arquivo ilegível ou completamente vazio.")

    return best_df


# ==========================================================
# 2. MOTOR SEMÂNTICO (TARGET-CENTRIC SCORING)
# ==========================================================
class RobustSemanticEngine:
    def __init__(self, df, category, report_type):
        self.df = df
        self.category = category
        self.report_type = report_type
        self.original_columns = [str(c).strip() for c in df.columns]
        self.normalized_columns = [str(c).lower().strip() for c in df.columns]
        self.audit_log = []

    def get_sample(self, normalized_col):
        """Extrai 5 linhas não nulas para analisar o conteúdo do dado."""
        try:
            idx = self.normalized_columns.index(normalized_col)
            series = self.df.iloc[:, idx]
            return [str(x).strip() for x in series.dropna().head(5).tolist()]
        except Exception:
            return []

    def score_column(self, col, target):
        score = 0
        penalties = 0
        notes = []
        samples = self.get_sample(col)

        is_contracts = self.category == "contracts"

        # ---------------- TARGET: NOME CREDOR / SERVIDOR ----------------
        if target == "nome_credor_servidor":
            if any(
                x in col
                for x in [
                    "fornecedor_nome",
                    "razao_social",
                    "razao social",
                    "credor",
                    "favorecido",
                    "servidor",
                ]
            ):
                score += 50
                notes.append("Lexical forte")
            elif "nome" in col:
                score += 30
                notes.append("Lexical médio")

            if "fiscal" in col:
                penalties += 100
                notes.append("Penalidade Fatal: fiscal não é credor")
            if any(x in col for x in ["cpf", "cnpj", "documento", "id", "codigo", "matricula"]):
                penalties += 100
                notes.append("Penalidade Fatal: é uma coluna de documento/código")

            if is_contracts and "fornecedor" in col:
                score += 40
                notes.append("Bônus Contextual (Contratos)")

            if samples:
                none_ratio = sum(
                    1
                    for s in samples
                    if str(s).strip().lower() in ["none", "", "null", "não informado", "nan"]
                ) / len(samples)
                if none_ratio > 0.6:
                    penalties += 40
                    notes.append("Penalidade: Coluna majoritariamente vazia")

        # ---------------- TARGET: DOCUMENTO ----------------
        elif target == "documento":
            if any(x in col for x in ["cpf", "cnpj", "documento"]):
                score += 50
                notes.append("Lexical forte")

            has_doc_format = any(
                re.search(
                    r"\d{2,3}\.?\d{3}\.?\d{3}[/.-]?\d{4}[-.]?\d{2}|\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}",
                    str(s),
                )
                for s in samples
            )
            if has_doc_format:
                score += 40
                notes.append("Conteúdo: Formato de CPF/CNPJ detectado")

            if "nome" in col:
                penalties += 50
                notes.append("Penalidade: Coluna de nome não é documento")

        # ---------------- TARGET: VALOR BRUTO ----------------
        elif target == "valor_bruto":
            if any(
                x in col
                for x in [
                    "valor_contrato",
                    "valor_pago",
                    "valor_empenhado",
                    "valor_liquidado",
                    "valor",
                    "bruto",
                    "liquido",
                    "vencimento",
                    "remuneracao",
                    "pago",
                    "empenhado",
                    "liquidado",
                ]
            ):
                score += 50
                notes.append("Lexical forte")
            elif "contrato" in col:
                score += 10
                notes.append("Lexical fraco")

            if any(x in col for x in ["numero", "número", "data", "codigo", "id", "cuc", "licitacao"]):
                penalties += 100
                notes.append("Penalidade Fatal: Indicador quantitativo/não monetário")

            has_date_like = any(re.search(r"^\d{1,2}/\d{2,4}$", str(s).strip()) for s in samples)
            if has_date_like:
                penalties += 100
                notes.append("Penalidade Fatal: Conteúdo é data ou num. de processo")

            has_money_like = any(
                re.search(
                    r"^\d+(?:[.,]\d{2})?$",
                    str(s).replace(".", "").replace(",", ".").replace("R$", "").strip(),
                )
                for s in samples
                if str(s).strip()
            )
            if has_money_like:
                score += 40
                notes.append("Conteúdo: Formato numérico/monetário detectado")

            if is_contracts and "valor_contrato" in col:
                score += 50
                notes.append("Bônus Contextual (Contratos)")

        final_score = score - penalties
        return {
            "column": col,
            "score": final_score,
            "notes": " | ".join(notes),
        }

    def map_targets(self):
        targets = ["nome_credor_servidor", "documento", "valor_bruto"]
        final_mapping = {}

        for target in targets:
            candidates = []
            for normalized_col in self.normalized_columns:
                result = self.score_column(normalized_col, target)
                candidates.append(result)

            # Ordena decrescente: o maior score assume o topo
            candidates.sort(key=lambda x: x["score"], reverse=True)

            winner_normalized = None
            accepted = False
            threshold = 10
            rejection_reason = None

            if candidates and candidates[0]["score"] >= threshold:
                winner_normalized = candidates[0]["column"]
                accepted = True

                # Resgata o nome original EXATO para o Pandas não quebrar no rename
                idx = self.normalized_columns.index(winner_normalized)
                exact_col_name = self.original_columns[idx]

                # Tranca a vaga
                final_mapping[exact_col_name] = target
            else:
                rejection_reason = f"Nenhuma coluna alcançou o threshold ({threshold})"

            self.audit_log.append(
                {
                    "target_field": target,
                    "accepted": accepted,
                    "winner": winner_normalized if accepted else None,
                    "rejection_reason": rejection_reason,
                    "candidates_ranked": candidates,
                }
            )

        return final_mapping, self.audit_log


def get_semantic_interpretation(df, category, report_type):
    """
    Orquestra a chamada do motor de inferência e calcula a confiança relacional.
    """
    engine = RobustSemanticEngine(df, category, report_type)
    mapping, audit_log = engine.map_targets()

    # TOTAL DE ALVOS ESPERADOS (Nome, Documento, Valor)
    total_expected_targets = 3
    target_confidences = []

    for log in audit_log:
        # Se o alvo não foi mapeado ou não tem candidatos, ele não soma na confiança
        if not log["accepted"] or not log.get("candidates_ranked"):
            continue

        candidates = log["candidates_ranked"]
        winner_score = candidates[0]["score"]

        # 1. FATOR BASE (Qualidade isolada do vencedor)
        base_conf = min(max(winner_score / 90.0, 0.0), 1.0)

        # 2. FATOR DE AMBIGUIDADE (Penalidade por margem de vitória apertada)
        margin_penalty = 0.0
        if len(candidates) > 1:
            runner_up_score = candidates[1]["score"]
            if runner_up_score > 0:
                margin = winner_score - runner_up_score
                if margin < 30:
                    margin_penalty = ((30.0 - margin) / 30.0) * 0.40

        # confiança mínima se o target foi aceito
        t_conf = max(base_conf - margin_penalty, 0.1)
        target_confidences.append(t_conf)

    # 3. CONFIANÇA GLOBAL (Fator de Integridade)
    if target_confidences:
        global_confidence = sum(target_confidences) / total_expected_targets
    else:
        global_confidence = 0.0

    confidence = round(min(global_confidence, 0.99), 2)

    chosen_metrics = []
    if "valor_bruto" in mapping.values():
        chosen_metrics.append("valor_bruto")

    base_json = {
        "interpreted_columns": mapping,
        "chosen_metrics": chosen_metrics,
        "dashboard_hints": {
            "group_by": [],
            "note": "Motor Robusto com Score Relacional (Margin Penalty)",
        },
        "confidence_score": confidence,
        "audit_log": audit_log,
    }

    return base_json, "hybrid_engine"


# ==========================================================
# 3. INTEGRAÇÃO REAL DA IA COM FALLBACK
# ==========================================================
def call_gemini_semantic_mapping(df, category, report_type):
    original_cols = df.columns.tolist()
    sample_df = df.dropna(how="all").head(3).fillna("")
    samples = sample_df.to_dict(orient="records")

    prompt = f"""
Você é um engenheiro de dados especialista em ETL semântico.

Contexto:
- Categoria: {category}
- Tipo de relatório: {report_type}
- Colunas originais: {json.dumps(original_cols, ensure_ascii=False)}
- Amostra de linhas: {json.dumps(samples, ensure_ascii=False, indent=2)}

Sua tarefa:
Mapeie colunas originais para estes alvos canônicos:
- nome_credor_servidor
- documento
- valor_bruto

Regras:
- "nome_credor_servidor" deve ser o nome do fornecedor/empresa/credor/servidor principal, nunca fiscal.
- "documento" deve ser CPF ou CNPJ.
- "valor_bruto" deve ser o valor monetário real, nunca número de contrato, licitação ou data.
- Não invente colunas.
- Use apenas colunas que realmente existam na lista original.
- Se não encontrar um alvo com confiança suficiente, omita esse alvo.

Responda APENAS com JSON puro, sem markdown, sem crases, sem explicações.
Formato:
{{
  "nome_da_coluna_original": "nome_credor_servidor",
  "outra_coluna_original": "documento",
  "mais_uma_coluna_original": "valor_bruto"
}}
"""

    start_time = time.time()

    try:
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
        latency_ms = int((time.time() - start_time) * 1000)

        raw_text = getattr(response, "text", "") or ""

        json_match = re.search(r"\{.*\}", raw_text, re.DOTALL)
        if not json_match:
            raise ValueError("Gemini não retornou JSON válido.")

        parsed = json.loads(json_match.group(0))

        allowed_targets = {"nome_credor_servidor", "documento", "valor_bruto"}
        validated_mapping = {}
        used_targets = set()

        for orig_col, target in parsed.items():
            if orig_col not in original_cols:
                continue
            if target not in allowed_targets:
                continue
            if target in used_targets:
                continue

            validated_mapping[orig_col] = target
            used_targets.add(target)

        if not validated_mapping:
            raise ValueError("Gemini retornou mapeamento vazio ou inválido após validação.")

        return {
            "success": True,
            "mapping": validated_mapping,
            "latency_ms": latency_ms,
            "raw_response_text": raw_text,
            "error_message": None,
            "provider": "gemini",
           "model": GEMINI_MODEL,
        }

    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "success": False,
            "mapping": {},
            "latency_ms": latency_ms,
            "raw_response_text": None,
            "error_message": str(e),
            "provider": "gemini",
            "model": GEMINI_MODEL,
        }


def get_semantic_interpretation_with_ai(df, category, report_type):
    # 1. Sempre calcula o motor heurístico local primeiro
    heuristic_json, _ = get_semantic_interpretation(df, category, report_type)

    heuristic_mapping = heuristic_json.get("interpreted_columns", {})
    heuristic_confidence = heuristic_json.get("confidence_score", 0.0)
    audit_log = heuristic_json.get("audit_log", [])
    dashboard_hints = heuristic_json.get(
        "dashboard_hints",
        {"group_by": [], "note": "Motor heurístico"},
    )

    provider = os.getenv("AI_PROVIDER", "none").lower()

    ai_used = False
    final_source = "heuristic_only"
    final_mapping = heuristic_mapping
    ai_provider = None
    ai_model = None
    ai_latency_ms = 0
    ai_raw_response_text = None
    ai_error_message = None

    # 2. Tenta IA real apenas se configurado
    if provider == "gemini" and GEMINI_API_KEY:
        ai_used = True
        ai_result = call_gemini_semantic_mapping(df, category, report_type)

        ai_provider = ai_result.get("provider")
        ai_model = ai_result.get("model")
        ai_latency_ms = ai_result.get("latency_ms", 0)
        ai_raw_response_text = ai_result.get("raw_response_text")
        ai_error_message = ai_result.get("error_message")

        if ai_result.get("success") and ai_result.get("mapping"):
            final_source = "ai_success"
            final_mapping = ai_result["mapping"]
        else:
            final_source = "ai_failed_fallback"
            final_mapping = heuristic_mapping

    final_chosen_metrics = ["valor_bruto"] if "valor_bruto" in final_mapping.values() else []

    final_json = {
        "interpreted_columns": final_mapping,
        "chosen_metrics": final_chosen_metrics,
        "dashboard_hints": {
            **dashboard_hints,
            "note": f"Origem da decisão: {final_source}",
        },
        "confidence_score": heuristic_confidence,
        "audit_log": audit_log,
    }

    ai_metadata = {
        "ai_used": ai_used,
        "ai_provider": ai_provider,
        "ai_model": ai_model,
        "ai_latency_ms": ai_latency_ms,
        "ai_raw_response_text": ai_raw_response_text,
        "ai_error_message": ai_error_message,
        "heuristic_confidence_score": heuristic_confidence,
        "final_decision_source": final_source,
    }

    return final_json, final_source, ai_metadata


# ==========================================================
# 4. ENDPOINT DE PROCESSAMENTO SÍNCRONO
# ==========================================================
@app.post("/process/{upload_id}")
async def process_upload(upload_id: str):
    try:
        # Busca registro
        res = supabase.table("uploads").select("*").eq("id", upload_id).execute()
        if not res.data or len(res.data) == 0:
            raise HTTPException(status_code=404, detail="Upload não encontrado.")
        up_rec = res.data[0]

        if up_rec.get("mapping_status") == "processed":
            return {"message": "Arquivo já processado."}

        # Download do bucket
        storage_res = supabase.storage.from_("uploads").download(up_rec["file_path"])
        file_bytes = io.BytesIO(storage_res)

        # Leitura robusta
        if up_rec["file_path"].lower().endswith((".csv", ".txt")):
            df = smart_read_csv(file_bytes)
        else:
            df = pd.read_excel(file_bytes)
            df = df.dropna(how="all", axis=1).dropna(how="all", axis=0)

        original_cols = df.columns.tolist()

        # Interpretação semântica com IA + fallback
        schema_json, source, ai_meta = get_semantic_interpretation_with_ai(
            df,
            up_rec["category"],
            up_rec["report_type"],
        )

        # Salva o mapeamento e auditoria
        supabase.table("upload_schema_mappings").insert(
            {
                "upload_id": upload_id,
                "city_id": up_rec["city_id"],
                "category": up_rec["category"],
                "report_type": up_rec["report_type"],
                "report_label": up_rec.get("report_label"),
                "original_columns_json": original_cols,
                "interpreted_columns_json": schema_json.get("interpreted_columns", {}),
                "chosen_metrics_json": schema_json.get("chosen_metrics", []),
                "dashboard_hints_json": schema_json.get("dashboard_hints", {}),
                "confidence_score": schema_json.get("confidence_score", 0.0),
                "source": source,
                "audit_log_json": schema_json.get("audit_log", []),
                "ai_used": ai_meta["ai_used"],
                "ai_provider": ai_meta["ai_provider"],
                "ai_model": ai_meta["ai_model"],
                "ai_latency_ms": ai_meta["ai_latency_ms"],
                "ai_raw_response_text": ai_meta["ai_raw_response_text"],
                "ai_error_message": ai_meta["ai_error_message"],
                "heuristic_confidence_score": ai_meta["heuristic_confidence_score"],
                "final_decision_source": ai_meta["final_decision_source"],
            }
        ).execute()

        # Preserva raw_json puro
        pure_records = df.fillna("").to_dict(orient="records")

        # Renomeia colunas para o padrão do sistema
        mapped_dict = schema_json.get("interpreted_columns", {})
        df.rename(columns=mapped_dict, inplace=True)
        clean_records = df.fillna("").to_dict(orient="records")

        records_to_insert = []
        for i in range(len(clean_records)):
            clean_row = clean_records[i]
            pure_row = pure_records[i]

            # Formatação segura do valor bruto
            v_bruto = clean_row.get("valor_bruto", 0.0)
            try:
                if isinstance(v_bruto, str):
                    v_bruto = (
                        v_bruto.replace("R$", "")
                        .replace(" ", "")
                        .replace(".", "")
                        .replace(",", ".")
                        .strip()
                    )
                    v_bruto = float(v_bruto) if v_bruto else 0.0
                elif v_bruto in [None, ""]:
                    v_bruto = 0.0
                else:
                    v_bruto = float(v_bruto)
            except Exception:
                v_bruto = 0.0

            rec = {
                "upload_id": upload_id,
                "city_id": up_rec["city_id"],
                "category": up_rec["category"],
                "report_type": up_rec["report_type"],
                "report_label": up_rec.get("report_label"),
                "nome_credor_servidor": str(clean_row.get("nome_credor_servidor", "Não informado"))[:255],
                "documento": str(clean_row.get("documento", ""))[:50],
                "valor_bruto": v_bruto,
                "metric_type": (schema_json.get("chosen_metrics") or ["padrao"])[0],
                "raw_json": pure_row,
            }
            records_to_insert.append(rec)

        # Batch insert
        batch_size = 1000
        for i in range(0, len(records_to_insert), batch_size):
            supabase.table("standardized_records").insert(records_to_insert[i : i + batch_size]).execute()

        # Finaliza e tranca o estado
        supabase.table("uploads").update(
            {"status": "processed", "mapping_status": "processed"}
        ).eq("id", upload_id).execute()

        return {
            "status": "success",
            "mapping_source": source,
            "ai_used": ai_meta["ai_used"],
            "final_decision_source": ai_meta["final_decision_source"],
            "linhas_processadas": len(records_to_insert),
        }

    except Exception as e:
        supabase.table("uploads").update({"status": "error"}).eq("id", upload_id).execute()
        raise HTTPException(status_code=500, detail=str(e))