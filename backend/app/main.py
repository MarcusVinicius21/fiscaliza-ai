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


# ==========================================================
# ETAPA 5: MOTOR DE ANÁLISE OBJETIVA E IA
# ==========================================================
@app.post("/analyze/{upload_id}")
async def analyze_upload(upload_id: str):
    def safe_parse_amount(value):
        try:
            if value in [None, ""]:
                return 0.0
            if isinstance(value, (int, float)):
                return float(value)

            txt = str(value).strip()
            txt = txt.replace("R$", "").replace(" ", "")
            txt = txt.replace(".", "").replace(",", ".")
            return float(txt) if txt else 0.0
        except Exception:
            return 0.0

    def safe_parse_ai_json(ai_text: str):
        text = (ai_text or "").strip()

        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            raise ValueError("A IA não retornou um JSON utilizável.")

        parsed = json.loads(match.group(0))

        if not isinstance(parsed, dict):
            raise ValueError("A resposta da IA não é um objeto JSON.")

        if not isinstance(parsed.get("alertas", []), list):
            parsed["alertas"] = []

        if "resumo_interpretativo" not in parsed or not isinstance(parsed["resumo_interpretativo"], str):
            parsed["resumo_interpretativo"] = "Resumo interpretativo indisponível."

        if "resumo_contextual_ia" not in parsed or not isinstance(parsed["resumo_contextual_ia"], str):
            parsed["resumo_contextual_ia"] = "Resumo contextual indisponível."

        parsed.pop("resumo_contextual", None)

        return parsed

    def normalize_text(value):
        txt = str(value or "").strip().lower()
        txt = re.sub(r"\s+", " ", txt)
        if txt in {"", "none", "null", "nan", "nao informado", "não informado"}:
            return ""
        return txt

    def get_raw_dict(row):
        raw = row.get("raw_json", {})
        if isinstance(raw, dict):
            return raw
        if isinstance(raw, str):
            try:
                parsed = json.loads(raw)
                return parsed if isinstance(parsed, dict) else {}
            except Exception:
                return {}
        return {}

    def raw_value(row, keys):
        raw = get_raw_dict(row)
        for key in keys:
            value = raw.get(key)
            if normalize_text(value):
                return str(value).strip()
        return ""

    def distinct_raw_values(group, keys, limit=5):
        values = []
        seen = set()

        for _, row in group.iterrows():
            value = raw_value(row, keys)
            norm = normalize_text(value)

            if norm and norm not in seen:
                values.append(value)
                seen.add(norm)

            if len(values) >= limit:
                break

        return values

    def build_contract_signature(row):
        signature_parts = [
            str(row.get("documento", "") or ""),
            raw_value(row, ["numero_contrato", "contrato"]),
            raw_value(row, ["numero_licitacao", "licitacao"]),
            raw_value(row, ["data_assinatura"]),
            raw_value(row, ["inicio_vigencia"]),
            raw_value(row, ["termino_vigencia"]),
            raw_value(row, ["objeto"]),
            raw_value(row, ["modalidade"]),
            raw_value(row, ["tipo_ato"]),
        ]
        normalized_parts = [
            normalize_text(part)
            for part in signature_parts
            if normalize_text(part)
        ]
        return "|".join(normalized_parts)

    def summarize_raw_dimension(df_input, raw_key, limit=5):
        if df_input.empty:
            return []

        temp = df_input.copy()
        temp["_raw_dimension"] = temp.apply(lambda row: raw_value(row, [raw_key]), axis=1)
        temp = temp[temp["_raw_dimension"].apply(lambda value: bool(normalize_text(value)))]

        if temp.empty:
            return []

        grouped = (
            temp.groupby("_raw_dimension", dropna=False)
            .agg(
                valor_total=("valor_bruto", "sum"),
                qtd_registros=("valor_bruto", "size"),
            )
            .reset_index()
            .sort_values("valor_total", ascending=False)
            .head(limit)
        )

        rows = []
        for item in grouped.to_dict("records"):
            rows.append({
                raw_key: item.get("_raw_dimension"),
                "valor_total": float(item.get("valor_total") or 0),
                "qtd_registros": int(item.get("qtd_registros") or 0),
            })

        return rows

    def build_resumo_contextual(df_input, category, repeticoes_estruturais_ignoradas):
        if category != "contracts":
            return {
                "tipo_contexto": category or "geral",
                "observacao": "Resumo contextual especifico ainda nao aplicado para esta categoria.",
            }

        maiores_contextualizados = []
        for row in df_input.nlargest(5, "valor_bruto").to_dict("records"):
            maiores_contextualizados.append({
                "fornecedor": row.get("nome_credor_servidor"),
                "documento": row.get("documento"),
                "valor_contrato": safe_parse_amount(row.get("valor_bruto")),
                "numero_contrato": raw_value(row, ["numero_contrato", "contrato"]),
                "numero_licitacao": raw_value(row, ["numero_licitacao", "licitacao"]),
                "modalidade": raw_value(row, ["modalidade"]),
                "tipo_ato": raw_value(row, ["tipo_ato"]),
                "situacao": raw_value(row, ["situacao"]),
                "objeto": raw_value(row, ["objeto"]),
                "inicio_vigencia": raw_value(row, ["inicio_vigencia"]),
                "termino_vigencia": raw_value(row, ["termino_vigencia"]),
            })

        return {
            "tipo_contexto": "contracts",
            "campos_raw_utilizados": [
                "tipo_ato",
                "modalidade",
                "situacao",
                "numero_contrato",
                "numero_licitacao",
                "objeto",
                "inicio_vigencia",
                "termino_vigencia",
            ],
            "por_modalidade": summarize_raw_dimension(df_input, "modalidade"),
            "por_tipo_ato": summarize_raw_dimension(df_input, "tipo_ato"),
            "por_situacao": summarize_raw_dimension(df_input, "situacao"),
            "maiores_contratos_contextualizados": maiores_contextualizados,
            "repeticoes_estruturais_ignoradas": repeticoes_estruturais_ignoradas[:10],
        }

    def classify_alert(title, explanation):
        combined = normalize_text(f"{title} {explanation}")

        if any(token in combined for token in ["repet", "duplic", "ident", "idênt"]):
            return "repeticao"

        if "concentr" in combined:
            return "concentracao"

        return "geral"

    def contract_safe_text(text):
        adjusted = str(text or "")
        replacements = {
            "Pagamentos": "Contratos",
            "pagamentos": "contratos",
            "Pagamento": "Contrato",
            "pagamento": "contrato",
            "Credor": "Fornecedor",
            "credor": "fornecedor",
            "recebeu": "consta com",
            "receberam": "constam com",
        }
        for old, new in replacements.items():
            adjusted = adjusted.replace(old, new)

        return adjusted

    def make_alert_key(alert):
        family = classify_alert(alert.get("title", ""), alert.get("explanation", ""))
        supplier = normalize_text(alert.get("supplier_name"))
        amount = round(safe_parse_amount(alert.get("amount")), 2)

        if family in {"repeticao", "concentracao"} and supplier:
            return (family, supplier, amount)

        title = normalize_text(alert.get("title"))[:120]
        return (family, supplier, amount, title)

    def should_skip_alert(alert):
        if not is_contracts:
            return False

        family = classify_alert(alert.get("title", ""), alert.get("explanation", ""))
        if family != "repeticao":
            return False

        supplier = normalize_text(alert.get("supplier_name"))
        amount = round(safe_parse_amount(alert.get("amount")), 2)
        return (supplier, amount) in suppressed_contract_repetition_keys

    def add_alert(alert):
        if should_skip_alert(alert):
            return

        key = make_alert_key(alert)
        if key in seen_alert_keys:
            return

        seen_alert_keys.add(key)
        alertas_insert.append(alert)

    analysis_started = False

    try:
        # 1. Buscar metadados do upload
        up_res = supabase.table("uploads").select("*").eq("id", upload_id).execute()
        if not up_res.data:
            raise HTTPException(status_code=404, detail="Upload não encontrado.")

        upload_record = up_res.data[0]

        if upload_record.get("status") != "processed":
            raise HTTPException(
                status_code=400,
                detail="O arquivo precisa ser processado antes da análise."
            )

        if upload_record.get("analysis_status") == "analyzed":
            return {
                "status": "success",
                "message": "Este upload já foi analisado anteriormente."
            }

        # Marca como processando para reduzir risco de clique duplo / corrida
        supabase.table("uploads").update({
            "analysis_status": "processing"
        }).eq("id", upload_id).execute()
        analysis_started = True

        # 2. Buscar registros padronizados
        rec_res = supabase.table("standardized_records").select("*").eq("upload_id", upload_id).execute()
        records = rec_res.data or []

        if not records:
            raise HTTPException(
                status_code=400,
                detail="Nenhum registro padronizado encontrado para este upload."
            )

        # 3. Análise objetiva com Pandas
        df = pd.DataFrame(records)
        df["valor_bruto"] = pd.to_numeric(df["valor_bruto"], errors="coerce").fillna(0)

        is_contracts = upload_record.get("category") == "contracts"
        registro_label = "contrato" if is_contracts else "pagamento"
        registro_label_plural = "contratos" if is_contracts else "pagamentos"
        valor_label = "valor contratado" if is_contracts else "valor bruto"

        df_valid = df[df["valor_bruto"] > 0].copy()
        df_analysis = df_valid.copy()

        repeticoes_estruturais_ignoradas = []
        duplicados_resumo = []

        if is_contracts:
            df_analysis["_contract_signature"] = df_analysis.apply(build_contract_signature, axis=1)

            duplicated_candidates = df_analysis[df_analysis.duplicated(
                subset=["nome_credor_servidor", "documento", "valor_bruto"],
                keep=False
            )].copy()

            for (fornecedor, documento, valor), group in duplicated_candidates.groupby(
                ["nome_credor_servidor", "documento", "valor_bruto"]
            ):
                signatures = {
                    signature
                    for signature in group["_contract_signature"].tolist()
                    if normalize_text(signature)
                }

                base_item = {
                    "nome_credor_servidor": fornecedor,
                    "documento": documento,
                    "valor_bruto": safe_parse_amount(valor),
                    "contagem": int(len(group)),
                    "contextos_contratuais_distintos": int(len(signatures)) if signatures else None,
                }

                if signatures and len(signatures) == 1:
                    first_row = group.iloc[0]
                    repeticoes_estruturais_ignoradas.append({
                        **base_item,
                        "motivo": "Mesmo contexto contratual repetido; variacao estrutural do arquivo, como fiscal diferente.",
                        "numero_contrato": raw_value(first_row, ["numero_contrato", "contrato"]),
                        "numero_licitacao": raw_value(first_row, ["numero_licitacao", "licitacao"]),
                        "objeto": raw_value(first_row, ["objeto"]),
                        "fiscais_encontrados": distinct_raw_values(group, ["fiscal_nome"]),
                    })
                else:
                    duplicados_resumo.append(base_item)

            df_analysis = df_analysis.drop_duplicates(
                subset=["nome_credor_servidor", "documento", "valor_bruto", "_contract_signature"],
                keep="first",
            ).copy()

            duplicados_resumo.sort(key=lambda item: item.get("contagem", 0), reverse=True)

        else:
            duplicados_raw = df_valid[df_valid.duplicated(
                subset=["nome_credor_servidor", "valor_bruto"],
                keep=False
            )]

            duplicados_resumo = (
                duplicados_raw.groupby(["nome_credor_servidor", "valor_bruto"])
                .size()
                .reset_index(name="contagem")
                .sort_values("contagem", ascending=False)
                .to_dict("records")
            )

        total_registros = len(df_analysis)
        valor_total = float(df_analysis["valor_bruto"].sum())

        top_fornecedores = (
            df_analysis.groupby("nome_credor_servidor", dropna=False)["valor_bruto"]
            .sum()
            .reset_index()
            .sort_values("valor_bruto", ascending=False)
            .head(5)
            .to_dict("records")
        )

        maiores_registros = (
            df_analysis.nlargest(5, "valor_bruto")[["nome_credor_servidor", "valor_bruto", "documento"]]
            .to_dict("records")
        )

        resumo_contextual = build_resumo_contextual(
            df_analysis,
            upload_record.get("category"),
            repeticoes_estruturais_ignoradas,
        )

        maiores_key = (
            "top_5_maiores_contratos_individuais"
            if is_contracts
            else "top_5_maiores_pagamentos_individuais"
        )
        duplicidade_key = (
            "alerta_potencial_repeticao_contratual"
            if is_contracts
            else "alerta_potencial_duplicidade"
        )

        resumo_matematico = {
            "total_registros": total_registros,
            "valor_total_soma": valor_total,
            "top_5_concentracao_volume": top_fornecedores,
            maiores_key: maiores_registros,
            duplicidade_key: duplicados_resumo[:10],
            "resumo_contextual": resumo_contextual,
        }

        input_summary_text = json.dumps(resumo_matematico, ensure_ascii=False, indent=2)

        # 4. Interpretação assistida por IA
        ai_json = {
            "resumo_interpretativo": "IA desativada ou não executada.",
            "resumo_contextual_ia": "Resumo contextual indisponível ou IA não executada.",
            "alertas": []
        }

        if os.getenv("AI_PROVIDER", "none").lower() == "gemini" and os.getenv("GEMINI_API_KEY"):
            prompt = f"""
Você é um assistente analítico focado em transparência pública.

Contexto do upload:
- Categoria: {upload_record.get("category")}
- Tipo de relatório: {upload_record.get("report_type")}
- Rótulo: {upload_record.get("report_label")}
- Semantica correta desta categoria: trate os registros como {registro_label_plural}.
- Unidade analisada: cada linha representa um {registro_label}.
- Campo financeiro principal: {valor_label}.

Sua tarefa:
1. Ler os números resumidos e contextuais abaixo.
2. Identificar concentracoes relevantes, repeticoes analiticas e padroes matematicos objetivos.
3. Escrever um resumo interpretativo curto.
4. Gerar alertas apenas se os números justificarem.
5. NÃO declarar fraude.
6. NÃO inventar dados.
7. NÃO extrapolar além do resumo fornecido.
8. Se a categoria for contracts, NAO use linguagem de pagamento; use contrato, fornecedor e valor contratado.
9. Se resumo_contextual.repeticoes_estruturais_ignoradas listar itens, NAO gere alerta para esses itens.
10. resumo_contextual_ia deve ser texto curto, baseado apenas no contexto tecnico enviado, sem inventar campos e sem despejar raw_json.
11. Para contracts, diferencie repeticao estrutural do arquivo de repeticao contratual analiticamente relevante.

DADOS MATEMATICOS E CONTEXTUAIS:
{input_summary_text}

RESPONDA APENAS EM JSON VÁLIDO NESTA ESTRUTURA:
{{
  "resumo_interpretativo": "texto curto aqui",
  "resumo_contextual_ia": "síntese textual curta do contexto técnico recebido",
  "alertas": [
    {{
      "title": "Título curto",
      "explanation": "Explicação objetiva",
      "severity": "baixa",
      "amount": 0.0,
      "supplier_name": "Fornecedor"
    }}
  ]
}}
"""
            try:
                model = genai.GenerativeModel(GEMINI_MODEL)
                ai_resp = model.generate_content(prompt)
                ai_text = getattr(ai_resp, "text", "").strip()
                ai_json = safe_parse_ai_json(ai_text)
            except Exception as e:
                ai_json = {
                    "resumo_interpretativo": (
                        "Análise matemática concluída, mas houve erro na interpretação textual da IA: "
                        f"{str(e)}"
                    ),
                    "resumo_contextual_ia": "Resumo contextual indisponível por erro na interpretação textual da IA.",
                    "alertas": []
                }

        if is_contracts:
            ai_json["resumo_interpretativo"] = contract_safe_text(
                ai_json.get("resumo_interpretativo", "")
            )
            ai_json["resumo_contextual_ia"] = contract_safe_text(
                ai_json.get("resumo_contextual_ia", "")
            )
            if isinstance(ai_json.get("alertas"), list):
                for alert in ai_json["alertas"]:
                    if not isinstance(alert, dict):
                        continue
                    alert["title"] = contract_safe_text(alert.get("title", ""))
                    alert["explanation"] = contract_safe_text(alert.get("explanation", ""))

        # 5. Limpa saída anterior deste upload para evitar duplicação em retry
        supabase.table("alerts").delete().eq("upload_id", upload_id).execute()
        supabase.table("ai_analysis_logs").delete().eq("upload_id", upload_id).execute()

        # 6. Persistir log da análise
        supabase.table("ai_analysis_logs").insert({
            "upload_id": upload_id,
            "city_id": upload_record["city_id"],
            "category": upload_record.get("category"),
            "report_type": upload_record.get("report_type"),
            "report_label": upload_record.get("report_label"),
            "prompt_type": "analise_agregada_v1",
            "input_summary": input_summary_text,
            "ai_output": json.dumps(ai_json, ensure_ascii=False)
        }).execute()

        # 7. Alertas objetivos mínimos (independentes da IA)
        alertas_insert = []
        seen_alert_keys = set()
        suppressed_contract_repetition_keys = {
            (
                normalize_text(item.get("nome_credor_servidor")),
                round(safe_parse_amount(item.get("valor_bruto")), 2),
            )
            for item in repeticoes_estruturais_ignoradas
        }

        for dup in duplicados_resumo[:10]:
            fornecedor = str(dup.get("nome_credor_servidor") or "").strip()
            valor = safe_parse_amount(dup.get("valor_bruto"))
            contagem = int(dup.get("contagem") or 0)

            if fornecedor and valor > 0 and contagem >= 2:
                if is_contracts:
                    contextos = dup.get("contextos_contratuais_distintos")
                    context_text = (
                        f" em {contextos} contextos contratuais distintos"
                        if contextos
                        else " sem contexto contratual suficiente para classificar como repeticao estrutural"
                    )
                    title = "Possivel repeticao de contrato por fornecedor e valor"
                    explanation = (
                        f"O fornecedor '{fornecedor}' aparece {contagem} vezes com o mesmo "
                        f"valor contratado de {valor:.2f}{context_text}."
                    )
                else:
                    title = "Possível repetição por fornecedor e valor"
                    explanation = (
                        f"O fornecedor '{fornecedor}' aparece {contagem} vezes com o valor exato de {valor:.2f}."
                    )

                add_alert({
                    "upload_id": upload_id,
                    "city_id": upload_record["city_id"],
                    "category": upload_record.get("category"),
                    "report_type": upload_record.get("report_type"),
                    "report_label": upload_record.get("report_label"),
                    "title": title,
                    "explanation": explanation,
                    "severity": "media" if contagem >= 3 else "baixa",
                    "amount": valor,
                    "supplier_name": fornecedor
                })

        # 8. Alertas da IA
        if ai_json.get("alertas") and isinstance(ai_json["alertas"], list):
            for alert in ai_json["alertas"]:
                if not isinstance(alert, dict):
                    continue

                add_alert({
                    "upload_id": upload_id,
                    "city_id": upload_record["city_id"],
                    "category": upload_record.get("category"),
                    "report_type": upload_record.get("report_type"),
                    "report_label": upload_record.get("report_label"),
                    "title": str(alert.get("title", "Alerta Encontrado"))[:255],
                    "explanation": str(alert.get("explanation", "")),
                    "severity": str(alert.get("severity", "baixa"))[:20],
                    "amount": safe_parse_amount(alert.get("amount", 0)),
                    "supplier_name": str(alert.get("supplier_name", ""))[:255]
                })

        if alertas_insert:
            supabase.table("alerts").insert(alertas_insert).execute()

        # 9. Finalizar
        supabase.table("uploads").update({
            "analysis_status": "analyzed"
        }).eq("id", upload_id).execute()

        return {
            "status": "success",
            "message": "Análise gerada e salva com sucesso!",
            "total_registros": total_registros,
            "valor_total": valor_total,
            "alertas_gerados": len(alertas_insert)
        }

    except HTTPException:
        if analysis_started:
            try:
                supabase.table("uploads").update({
                    "analysis_status": "error"
                }).eq("id", upload_id).execute()
            except Exception:
                pass

        raise

    except Exception as e:
        try:
            supabase.table("uploads").update({
                "analysis_status": "error"
            }).eq("id", upload_id).execute()
        except Exception:
            pass

        raise HTTPException(status_code=500, detail=str(e))
