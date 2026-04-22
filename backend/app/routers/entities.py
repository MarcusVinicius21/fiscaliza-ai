"""Router e helpers da camada de entidades (Fase 2B).

Este módulo também atua como *fonte única* dos helpers de consulta
compartilhados com `people.py` e `investigations.py` — especificamente:

- `supabase`, `UpstreamQueryError`, `_raise_upstream_http_error`
- `_select_in_chunks`, `_chunked`, `_execute_with_retry`
- `_safe_amount`, `_raw`, `_raw_value`
- `_format_date`, `_primary_date`, `_period_key`, `_summary`
- `_fetch_entity`, `_fetch_aliases`, `_fetch_links`, `_fetch_records`,
  `_fetch_uploads`, `_fetch_cities`

Os outros routers importam estes helpers diretamente daqui de forma
intencional, para evitar duplicação de lógica de retry, chunking e
normalização de registros. A convenção é: se um helper é útil fora
deste arquivo, ele vive aqui e mantém o prefixo `_` por estabilidade de
nome (alterações de assinatura precisam ser coordenadas com os outros
routers). Uma extração para `app.utils.entity_queries` está prevista,
mas deve acontecer em um refactor próprio — não junto com mudanças de
feature.
"""

import json
import logging
import os
import time
from collections import defaultdict
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query
from supabase import Client, ClientOptions, create_client

try:
    from app.utils.normalization import normalize_document, normalize_name
except ModuleNotFoundError:
    from backend.app.utils.normalization import normalize_document, normalize_name

load_dotenv()

router = APIRouter(tags=["entities"])
logger = logging.getLogger(__name__)
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY"),
    options=ClientOptions(postgrest_client_timeout=30),
)

SEARCH_TYPES = ["supplier", "organization", "person", "server", "other"]
SUPPLIER_TYPES = {"supplier", "organization"}
PERSON_TYPES = {"person", "server"}
RETRYABLE_HTTP_ERRORS = (
    httpx.RemoteProtocolError,
    httpx.ReadTimeout,
    httpx.ConnectError,
)
RETRY_BACKOFF_SECONDS = (0.2, 0.5, 0.9)


class UpstreamQueryError(RuntimeError):
    def __init__(self, table: str, chunk_index: int, total_chunks: int, attempts: int, last_error: Exception):
        self.table = table
        self.chunk_index = chunk_index
        self.total_chunks = total_chunks
        self.attempts = attempts
        self.last_error = last_error
        super().__init__(
            f"Falha temporária ao consultar {table} "
            f"(chunk {chunk_index}/{total_chunks}) após {attempts} tentativa(s)."
        )


def _raise_upstream_http_error(error: UpstreamQueryError, detail: str) -> None:
    logger.error("%s Last upstream error: %s", str(error), error.last_error)
    raise HTTPException(status_code=503, detail=detail)


def _chunked(values: list[str], chunk_size: int = 400) -> list[list[str]]:
    return [values[index:index + chunk_size] for index in range(0, len(values), chunk_size)]


def _execute_with_retry(query_factory, table: str, chunk_index: int = 1, total_chunks: int = 1):
    last_error: Exception | None = None

    for attempt, delay in enumerate(RETRY_BACKOFF_SECONDS, start=1):
        try:
            return query_factory().execute()
        except RETRYABLE_HTTP_ERRORS as exc:
            last_error = exc
            logger.warning(
                "Retryable Supabase error on %s chunk %s/%s attempt %s: %s",
                table,
                chunk_index,
                total_chunks,
                attempt,
                exc,
            )
            if attempt < len(RETRY_BACKOFF_SECONDS):
                time.sleep(delay)
        except httpx.HTTPError as exc:
            last_error = exc
            logger.warning(
                "HTTP error on %s chunk %s/%s attempt %s: %s",
                table,
                chunk_index,
                total_chunks,
                attempt,
                exc,
            )
            if attempt < len(RETRY_BACKOFF_SECONDS):
                time.sleep(delay)

    raise UpstreamQueryError(
        table,
        chunk_index,
        total_chunks,
        len(RETRY_BACKOFF_SECONDS),
        last_error or RuntimeError("unknown"),
    )


def _select_in_chunks(table: str, select_clause: str, column: str, values: list[str]) -> list[dict]:
    if not values:
        return []

    rows: list[dict] = []
    chunks = _chunked(values)

    for chunk_index, chunk in enumerate(chunks, start=1):
        response = _execute_with_retry(
            lambda: supabase.table(table).select(select_clause).in_(column, chunk),
            table,
            chunk_index,
            len(chunks),
        )
        rows.extend(response.data or [])

    return rows


def _safe_amount(value: Any) -> float:
    if value in (None, ""):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).replace("R$", "").strip()
    text = text.replace(".", "").replace(",", ".")
    try:
        return float(text)
    except Exception:
        return 0.0


def _raw(record: dict) -> dict:
    raw_json = record.get("raw_json")
    if isinstance(raw_json, dict):
        return raw_json
    if isinstance(raw_json, str):
        try:
            parsed = json.loads(raw_json)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _raw_value(record: dict, keys: list[str]) -> str:
    data = _raw(record)
    for key in keys:
        value = data.get(key)
        if str(value or "").strip():
            return str(value).strip()
    return ""


def _format_date(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return text[:10]
    return text


def _primary_date(record: dict, upload_row: dict | None = None) -> str:
    return (
        _format_date(_raw_value(record, ["data_publicacao"]))
        or _format_date(_raw_value(record, ["data_assinatura"]))
        or _format_date(_raw_value(record, ["data_processo"]))
        or _format_date(record.get("data_referencia"))
        or _format_date((upload_row or {}).get("created_at"))
        or "-"
    )


def _period_key(record: dict, upload_row: dict | None = None) -> str:
    """Return the YYYY-MM key for timeline buckets.

    Handles both ISO (`YYYY-MM-DD`) and Brazilian (`DD/MM/YYYY`, `MM/YYYY`) formats.
    Returns an empty string when no reliable date is available, so callers can
    skip the row instead of storing a meaningless period label like `09/04/2`
    (the old bug: `"09/04/2025"[:7]`).
    """
    raw = _primary_date(record, upload_row)
    text = str(raw or "").strip()
    if not text or text == "-":
        return ""
    if len(text) >= 7 and text[4:5] == "-":
        return text[:7]
    if len(text) >= 10 and text[2] == "/" and text[5] == "/":
        return f"{text[6:10]}-{text[3:5]}"
    if len(text) >= 7 and text[2] == "/":
        return f"{text[3:7]}-{text[:2]}"
    return ""


def _summary(record: dict) -> str:
    type_label = _raw_value(record, ["tipo_ato", "tipo"]) or "Linha do arquivo"
    modality = _raw_value(record, ["modalidade"])
    object_label = _raw_value(record, ["objeto", "descricao", "historico"])
    base = f"{type_label} por {modality}" if modality else type_label
    return f"{base} para {object_label}" if object_label else base


def _fetch_entity(entity_id: str) -> dict:
    response = _execute_with_retry(
        lambda: supabase.table("entities").select("*").eq("id", entity_id).limit(1),
        "entities",
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Entidade não encontrada.")
    return response.data[0]


def _fetch_aliases(entity_ids: list[str]) -> dict[str, list[dict]]:
    aliases = _select_in_chunks(
        "entity_aliases",
        "id, entity_id, alias_name, alias_type, normalized_alias, source_upload_id, created_at",
        "entity_id",
        entity_ids,
    )
    grouped: dict[str, list[dict]] = defaultdict(list)
    for alias in aliases:
        grouped[str(alias["entity_id"])].append(alias)
    return grouped


def _fetch_links(entity_ids: list[str]) -> list[dict]:
    return _select_in_chunks(
        "record_entity_links",
        "id, standardized_record_id, entity_id, role_in_record, match_type, match_confidence, created_at",
        "entity_id",
        entity_ids,
    )


def _fetch_records(record_ids: list[str]) -> dict[str, dict]:
    rows = _select_in_chunks(
        "standardized_records",
        "id, upload_id, category, report_type, report_label, documento, nome_credor_servidor, valor_bruto, data_referencia, raw_json, created_at",
        "id",
        record_ids,
    )
    return {str(row["id"]): row for row in rows}


def _fetch_uploads(upload_ids: list[str]) -> dict[str, dict]:
    rows = _select_in_chunks(
        "uploads",
        "id, city_id, file_name, category, report_type, report_label, created_at",
        "id",
        upload_ids,
    )
    return {str(row["id"]): row for row in rows}


def _fetch_cities(city_ids: list[str]) -> dict[str, dict]:
    rows = _select_in_chunks(
        "cities",
        "id, name, state",
        "id",
        city_ids,
    )
    return {str(row["id"]): row for row in rows}


def _entity_stats(entity_ids: list[str]) -> dict[str, dict]:
    links = _fetch_links(entity_ids)
    record_map = _fetch_records(sorted({str(link["standardized_record_id"]) for link in links}))

    stats: dict[str, dict] = defaultdict(lambda: {
        "records_count": 0,
        "uploads": set(),
        "total_amount": 0.0,
    })

    for link in links:
        entity_id = str(link["entity_id"])
        record = record_map.get(str(link["standardized_record_id"]))
        if not record:
            continue
        stats[entity_id]["records_count"] += 1
        stats[entity_id]["uploads"].add(str(record.get("upload_id") or ""))
        stats[entity_id]["total_amount"] += _safe_amount(record.get("valor_bruto"))

    normalized: dict[str, dict] = {}
    for entity_id, values in stats.items():
        normalized[entity_id] = {
            "records_count": values["records_count"],
            "uploads_count": len([upload for upload in values["uploads"] if upload]),
            "total_amount": round(values["total_amount"], 2),
        }
    return normalized


def _roles_by_entity(entity_ids: list[str]) -> dict[str, list[str]]:
    links = _fetch_links(entity_ids)
    grouped: dict[str, set[str]] = defaultdict(set)
    for link in links:
        entity_id = str(link.get("entity_id") or "")
        role = str(link.get("role_in_record") or "").strip()
        if entity_id and role:
            grouped[entity_id].add(role)
    return {entity_id: sorted(roles) for entity_id, roles in grouped.items()}


def _cross_reference_counts(entity_ids: list[str]) -> dict[str, dict]:
    if not entity_ids:
        return {}

    left_rows = _select_in_chunks(
        "entity_cross_references",
        "id, left_entity_id, right_entity_id, cross_ref_type, confidence_label, confidence_score",
        "left_entity_id",
        entity_ids,
    )
    right_rows = _select_in_chunks(
        "entity_cross_references",
        "id, left_entity_id, right_entity_id, cross_ref_type, confidence_label, confidence_score",
        "right_entity_id",
        entity_ids,
    )

    counts: dict[str, dict] = defaultdict(
        lambda: {
            "total": 0,
            "role_conflict": 0,
            "same_person_candidate": 0,
            "homonym_candidate": 0,
        }
    )
    seen: set[tuple[str, str]] = set()
    target_ids = set(entity_ids)

    for row in left_rows + right_rows:
        row_id = str(row.get("id") or "")
        for entity_id in (str(row.get("left_entity_id") or ""), str(row.get("right_entity_id") or "")):
            if entity_id not in target_ids:
                continue
            dedupe_key = (row_id, entity_id)
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            counts[entity_id]["total"] += 1
            ref_type = str(row.get("cross_ref_type") or "")
            if ref_type in counts[entity_id]:
                counts[entity_id][ref_type] += 1

    return counts


def _search_candidates(q: str, entity_type: str, limit: int) -> dict[str, int]:
    display_query = str(q or "").strip()
    normalized_query = normalize_name(display_query)
    document_query = normalize_document(display_query)
    scores: dict[str, int] = {}

    def apply_type_filter(query):
        if entity_type != "all":
            return query.eq("entity_type", entity_type)
        return query

    def add_rows(rows: list[dict], score: int):
        for row in rows:
            entity_id = str(row["id"])
            scores[entity_id] = max(scores.get(entity_id, 0), score)

    if document_query:
        rows = apply_type_filter(
            supabase.table("entities").select("id").eq("document", document_query).limit(limit)
        ).execute().data or []
        add_rows(rows, 100)

    if normalized_query:
        rows = apply_type_filter(
            supabase.table("entities").select("id").eq("normalized_name", normalized_query).limit(limit)
        ).execute().data or []
        add_rows(rows, 90)

        rows = apply_type_filter(
            supabase.table("entities").select("id").ilike("normalized_name", f"{normalized_query}%").limit(limit)
        ).execute().data or []
        add_rows(rows, 80)

        rows = apply_type_filter(
            supabase.table("entities").select("id").ilike("normalized_name", f"%{normalized_query}%").limit(limit)
        ).execute().data or []
        add_rows(rows, 50)

        alias_rows = supabase.table("entity_aliases").select("entity_id").eq("normalized_alias", normalized_query).limit(limit).execute().data or []
        for row in alias_rows:
            scores[str(row["entity_id"])] = max(scores.get(str(row["entity_id"]), 0), 75)

        alias_rows = supabase.table("entity_aliases").select("entity_id").ilike("normalized_alias", f"{normalized_query}%").limit(limit).execute().data or []
        for row in alias_rows:
            scores[str(row["entity_id"])] = max(scores.get(str(row["entity_id"]), 0), 65)

        alias_rows = supabase.table("entity_aliases").select("entity_id").ilike("normalized_alias", f"%{normalized_query}%").limit(limit).execute().data or []
        for row in alias_rows:
            scores[str(row["entity_id"])] = max(scores.get(str(row["entity_id"]), 0), 55)

    if display_query:
        rows = apply_type_filter(
            supabase.table("entities").select("id").ilike("canonical_name", f"%{display_query}%").limit(limit)
        ).execute().data or []
        add_rows(rows, 60)

        alias_rows = supabase.table("entity_aliases").select("entity_id").ilike("alias_name", f"%{display_query}%").limit(limit).execute().data or []
        for row in alias_rows:
            scores[str(row["entity_id"])] = max(scores.get(str(row["entity_id"]), 0), 58)

    return scores


def _resolve_related_alerts(entity: dict, alias_rows: list[dict], record_ids: set[str], upload_ids: set[str]) -> list[dict]:
    if not upload_ids:
        return []

    alerts = _select_in_chunks(
        "alerts",
        "id, upload_id, title, explanation, severity, amount, supplier_name, source_record_id, created_at",
        "upload_id",
        sorted(upload_ids),
    )
    allowed_names = {normalize_name(entity.get("canonical_name"))}
    for alias in alias_rows:
        allowed_names.add(normalize_name(alias.get("alias_name")))
        allowed_names.add(normalize_name(alias.get("normalized_alias")))

    filtered: list[dict] = []
    seen = set()
    for alert in alerts:
        supplier_ok = False
        record_ok = False

        supplier_name = normalize_name(alert.get("supplier_name"))
        if supplier_name and supplier_name in allowed_names:
            supplier_ok = True

        source_record_id = str(alert.get("source_record_id") or "")
        if source_record_id and source_record_id in record_ids:
            record_ok = True

        if not supplier_ok and not record_ok:
            continue

        alert_id = str(alert["id"])
        if alert_id in seen:
            continue
        seen.add(alert_id)
        filtered.append(alert)

    filtered.sort(key=lambda item: (_safe_amount(item.get("amount")) * -1, str(item.get("created_at") or "")))
    return filtered


def _build_supplier_core(entity_id: str) -> dict:
    entity = _fetch_entity(entity_id)
    if entity.get("entity_type") not in SUPPLIER_TYPES:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")

    aliases_map = _fetch_aliases([entity_id])
    alias_rows = aliases_map.get(entity_id, [])
    links = _fetch_links([entity_id])
    record_ids = sorted({str(link["standardized_record_id"]) for link in links})
    records = _fetch_records(record_ids)
    upload_ids = sorted({str(record.get("upload_id") or "") for record in records.values() if record.get("upload_id")})

    return {
        "entity": entity,
        "aliases": alias_rows,
        "links": links,
        "record_ids": record_ids,
        "records": records,
        "upload_ids": upload_ids,
    }


def _build_supplier_bundle(entity_id: str) -> dict:
    core = _build_supplier_core(entity_id)
    uploads = _fetch_uploads(core["upload_ids"])
    city_ids = sorted({str(upload.get("city_id") or "") for upload in uploads.values() if upload.get("city_id")})
    cities = _fetch_cities(city_ids)
    related_alerts = _resolve_related_alerts(
        core["entity"],
        core["aliases"],
        set(core["record_ids"]),
        set(core["upload_ids"]),
    )

    return {
        **core,
        "uploads": uploads,
        "cities": cities,
        "related_alerts": related_alerts,
    }


def _build_supplier_alerts_bundle(entity_id: str) -> dict:
    core = _build_supplier_core(entity_id)
    related_alerts = _resolve_related_alerts(
        core["entity"],
        core["aliases"],
        set(core["record_ids"]),
        set(core["upload_ids"]),
    )

    return {
        **core,
        "related_alerts": related_alerts,
    }


def _compute_supplier_rank(current_entity_id: str) -> int | None:
    supplier_rows = _execute_with_retry(
        lambda: supabase.table("entities").select("id, entity_type").in_("entity_type", list(SUPPLIER_TYPES)),
        "entities",
    )
    supplier_ids = [str(row["id"]) for row in (supplier_rows.data or [])]
    if not supplier_ids or current_entity_id not in supplier_ids:
        return None

    stats = _entity_stats(supplier_ids)
    ordered = sorted(
        supplier_ids,
        key=lambda entity_id: stats.get(entity_id, {}).get("total_amount", 0),
        reverse=True,
    )
    try:
        return ordered.index(current_entity_id) + 1
    except ValueError:
        return None


@router.get("/entities/search")
def search_entities(
    q: str = Query(..., min_length=1),
    entity_type: str = Query("all"),
    limit: int = Query(20, ge=1, le=50),
):
    entity_type = str(entity_type or "all").strip().lower()
    if entity_type != "all" and entity_type not in SEARCH_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de entidade inválido.")

    try:
        scores = _search_candidates(q, entity_type, limit)
        ordered_ids = [entity_id for entity_id, _ in sorted(scores.items(), key=lambda item: item[1], reverse=True)]
        ordered_ids = ordered_ids[:limit]

        entities = _select_in_chunks(
            "entities",
            "id, entity_type, canonical_name, document, normalized_name, source_confidence, created_at",
            "id",
            ordered_ids,
        )
        entities_by_id = {str(entity["id"]): entity for entity in entities}
        aliases_map = _fetch_aliases(ordered_ids)
        stats_map = _entity_stats(ordered_ids)
        roles_map = _roles_by_entity(ordered_ids)
        cross_ref_counts = _cross_reference_counts(ordered_ids)

        grouped: dict[str, list[dict]] = {kind: [] for kind in SEARCH_TYPES}
        counts: dict[str, int] = {kind: 0 for kind in SEARCH_TYPES}

        for entity_id in ordered_ids:
            entity = entities_by_id.get(entity_id)
            if not entity:
                continue
            if entity_type != "all" and entity.get("entity_type") != entity_type:
                continue
            item = {
                "id": entity_id,
                "entity_type": entity.get("entity_type"),
                "canonical_name": entity.get("canonical_name"),
                "document": entity.get("document"),
                "aliases": sorted({
                    str(alias.get("alias_name") or "").strip()
                    for alias in aliases_map.get(entity_id, [])
                    if str(alias.get("alias_name") or "").strip()
                })[:4],
                "uploads_count": stats_map.get(entity_id, {}).get("uploads_count", 0),
                "records_count": stats_map.get(entity_id, {}).get("records_count", 0),
                "total_amount": stats_map.get(entity_id, {}).get("total_amount", 0.0),
                "roles_observed": roles_map.get(entity_id, []),
                "cross_reference_counts": cross_ref_counts.get(
                    entity_id,
                    {
                        "total": 0,
                        "role_conflict": 0,
                        "same_person_candidate": 0,
                        "homonym_candidate": 0,
                    },
                ),
            }
            kind = str(entity.get("entity_type") or "other")
            grouped.setdefault(kind, []).append(item)
            counts[kind] = counts.get(kind, 0) + 1

        return {
            "status": "success",
            "query": q,
            "results": grouped,
            "counts": counts,
        }
    except UpstreamQueryError as error:
        _raise_upstream_http_error(error, "Falha temporária ao buscar entidades. Tente novamente.")


@router.get("/suppliers/{entity_id}")
def supplier_overview(entity_id: str):
    try:
        bundle = _build_supplier_bundle(entity_id)
        entity = bundle["entity"]
        alias_rows = bundle["aliases"]
        links = bundle["links"]
        records = bundle["records"]
        uploads = bundle["uploads"]
        cities = bundle["cities"]
        related_alerts = bundle["related_alerts"]

        total_amount = round(sum(_safe_amount(record.get("valor_bruto")) for record in records.values()), 2)
        upload_ids = {str(record.get("upload_id") or "") for record in records.values() if record.get("upload_id")}
        category_groups: dict[str, dict] = defaultdict(lambda: {"records_count": 0, "total_amount": 0.0})
        city_groups: dict[str, dict] = defaultdict(
            lambda: {"records_count": 0, "total_amount": 0.0, "city_name": "Não informado", "state": ""}
        )
        upload_groups: dict[str, dict] = {}
        timeline_groups: dict[str, dict] = defaultdict(lambda: {"records_count": 0, "total_amount": 0.0})

        for record in records.values():
            upload = uploads.get(str(record.get("upload_id") or ""))
            category = str(record.get("category") or (upload or {}).get("category") or "other")
            amount = _safe_amount(record.get("valor_bruto"))
            period = _period_key(record, upload)

            category_groups[category]["records_count"] += 1
            category_groups[category]["total_amount"] += amount

            upload_id = str(record.get("upload_id") or "")
            if upload_id:
                if upload_id not in upload_groups:
                    upload_groups[upload_id] = {
                        "upload_id": upload_id,
                        "file_name": (upload or {}).get("file_name"),
                        "report_type": (upload or {}).get("report_type"),
                        "report_label": (upload or {}).get("report_label"),
                        "category": (upload or {}).get("category"),
                        "created_at": (upload or {}).get("created_at"),
                        "records_count": 0,
                        "total_amount": 0.0,
                    }
                upload_groups[upload_id]["records_count"] += 1
                upload_groups[upload_id]["total_amount"] += amount

                city_id = str((upload or {}).get("city_id") or "")
                if city_id:
                    city = cities.get(city_id, {})
                    city_groups[city_id]["city_name"] = city.get("name") or "Não informado"
                    city_groups[city_id]["state"] = city.get("state") or ""
                    city_groups[city_id]["records_count"] += 1
                    city_groups[city_id]["total_amount"] += amount

            if period:
                timeline_groups[period]["records_count"] += 1
                timeline_groups[period]["total_amount"] += amount

        relative_rank = _compute_supplier_rank(entity_id)

        return {
            "status": "success",
            "supplier": {
                "id": entity_id,
                "entity_type": entity.get("entity_type"),
                "canonical_name": entity.get("canonical_name"),
                "document": entity.get("document"),
                "source_confidence": entity.get("source_confidence"),
                "aliases": sorted({
                    str(alias.get("alias_name") or "").strip()
                    for alias in alias_rows
                    if str(alias.get("alias_name") or "").strip()
                }),
            },
            "summary": {
                "uploads_count": len(upload_ids),
                "cities_count": len(city_groups),
                "categories_count": len(category_groups),
                "records_count": len(links),
                "alerts_count": len(related_alerts),
                "total_amount": total_amount,
                "relative_rank": relative_rank,
            },
            "cities": [
                {
                    "city_id": city_id,
                    "city_name": values["city_name"],
                    "state": values["state"],
                    "records_count": values["records_count"],
                    "total_amount": round(values["total_amount"], 2),
                }
                for city_id, values in sorted(city_groups.items(), key=lambda item: item[1]["total_amount"], reverse=True)
            ],
            "categories": [
                {
                    "category": category,
                    "records_count": values["records_count"],
                    "total_amount": round(values["total_amount"], 2),
                }
                for category, values in sorted(category_groups.items(), key=lambda item: item[1]["total_amount"], reverse=True)
            ],
            "timeline": [
                {
                    "period": period,
                    "records_count": values["records_count"],
                    "total_amount": round(values["total_amount"], 2),
                }
                for period, values in sorted(timeline_groups.items())
            ],
            "uploads": sorted(upload_groups.values(), key=lambda item: item["total_amount"], reverse=True),
            "related_alerts": related_alerts,
        }
    except UpstreamQueryError as error:
        _raise_upstream_http_error(error, "Falha temporária ao carregar os dados do fornecedor. Tente novamente.")


@router.get("/suppliers/{entity_id}/records")
def supplier_records(
    entity_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    upload_id: str | None = Query(None),
    category: str | None = Query(None),
):
    try:
        bundle = _build_supplier_bundle(entity_id)
        records = bundle["records"]
        uploads = bundle["uploads"]
        related_alerts = bundle["related_alerts"]
        alerts_by_record: dict[str, list[dict]] = defaultdict(list)
        alerts_by_upload: dict[str, list[dict]] = defaultdict(list)

        for alert in related_alerts:
            payload = {
                "id": alert.get("id"),
                "title": alert.get("title"),
                "severity": alert.get("severity"),
            }
            source_record_id = str(alert.get("source_record_id") or "")
            if source_record_id:
                alerts_by_record[source_record_id].append(payload)
            else:
                alert_upload_id = str(alert.get("upload_id") or "")
                if alert_upload_id:
                    alerts_by_upload[alert_upload_id].append(payload)

        items = []
        for record in records.values():
            upload = uploads.get(str(record.get("upload_id") or ""))
            record_upload_id = str(record.get("upload_id") or "")
            record_category = str(record.get("category") or (upload or {}).get("category") or "")

            if upload_id and record_upload_id != upload_id:
                continue
            if category and record_category != category:
                continue

            record_alerts = list(alerts_by_record.get(str(record.get("id")), []))
            if not record_alerts:
                record_alerts = list(alerts_by_upload.get(record_upload_id, []))

            items.append({
                "record_id": record.get("id"),
                "upload_id": record_upload_id,
                "file_name": (upload or {}).get("file_name"),
                "category": record_category,
                "report_type": record.get("report_type") or (upload or {}).get("report_type"),
                "report_label": record.get("report_label") or (upload or {}).get("report_label"),
                "city_name": None,
                "state": None,
                "document": record.get("documento"),
                "valor_bruto": _safe_amount(record.get("valor_bruto")),
                "tipo_ato": _raw_value(record, ["tipo_ato", "tipo"]),
                "modalidade": _raw_value(record, ["modalidade"]),
                "data": _primary_date(record, upload),
                "summary": _summary(record),
                "alerts": record_alerts,
            })

        city_map = bundle["cities"]
        for item in items:
            upload = uploads.get(str(item["upload_id"]))
            city = city_map.get(str((upload or {}).get("city_id") or ""))
            item["city_name"] = city.get("name") if city else None
            item["state"] = city.get("state") if city else None

        items.sort(key=lambda row: (row["data"] or "", row["valor_bruto"]), reverse=True)
        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size

        return {
            "status": "success",
            "page": page,
            "page_size": page_size,
            "total": total,
            "items": items[start:end],
        }
    except UpstreamQueryError as error:
        _raise_upstream_http_error(error, "Falha temporária ao carregar os registros do fornecedor. Tente novamente.")


@router.get("/suppliers/{entity_id}/alerts")
def supplier_alerts(entity_id: str):
    try:
        bundle = _build_supplier_alerts_bundle(entity_id)
        return {
            "status": "success",
            "items": bundle["related_alerts"],
            "total": len(bundle["related_alerts"]),
        }
    except UpstreamQueryError as error:
        _raise_upstream_http_error(error, "Falha temporária ao carregar os alertas do fornecedor. Tente novamente.")
