from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query

try:
    from app.routers.entities import (
        UpstreamQueryError,
        _execute_with_retry,
        _raise_upstream_http_error,
        _select_in_chunks,
        supabase,
    )
except ModuleNotFoundError:
    from backend.app.routers.entities import (
        UpstreamQueryError,
        _execute_with_retry,
        _raise_upstream_http_error,
        _select_in_chunks,
        supabase,
    )


router = APIRouter(tags=["investigations"])
logger = logging.getLogger(__name__)
CONFIDENCE_LEVELS = {"indicative", "probable", "confirmed"}
NAME_MATCH_TYPES = {"same_person_candidate", "homonym_candidate"}


def _fetch_cross_reference_rows(
    cross_ref_type: str | None = None,
    confidence_level: str | None = None,
) -> list[dict]:
    """Leitura resiliente da tabela `entity_cross_references`.

    Antes, esta função fazia `query.execute()` direto e quebrava o
    endpoint inteiro quando o PostgREST devolvia `RemoteProtocolError`
    (`Server disconnected`). Agora a execução passa pelo
    `_execute_with_retry` da `entities.py`, que:

    - tenta até 3 vezes com backoff curto (0.2s, 0.5s, 0.9s)
    - captura `RemoteProtocolError`, `ReadTimeout`, `ConnectError`
      e demais `httpx.HTTPError`
    - encerra com `UpstreamQueryError`, convertido em HTTP 503 controlado
      pelos handlers dos endpoints

    Nada de `except Exception: pass` — toda exaustão de retry vira
    erro auditável no log e mensagem amigável na UI.
    """

    def _build_query():
        query = supabase.table("entity_cross_references").select("*")
        if cross_ref_type:
            query = query.eq("cross_ref_type", cross_ref_type)
        if confidence_level:
            query = query.eq("confidence_label", confidence_level)
        return query

    response = _execute_with_retry(_build_query, "entity_cross_references")
    return response.data or []


def _filter_by_city(rows: list[dict], city_id: str | None) -> list[dict]:
    if not city_id:
        return rows

    filtered: list[dict] = []
    for row in rows:
        evidence = row.get("evidence_payload") or {}
        shared_city_ids = evidence.get("shared_city_ids") if isinstance(evidence, dict) else []
        if str(city_id) in {str(item) for item in (shared_city_ids or [])}:
            filtered.append(row)
    return filtered


def _resolve_entities(rows: list[dict]) -> dict[str, dict]:
    entity_ids = sorted(
        {
            str(row.get("left_entity_id") or "")
            for row in rows
            if str(row.get("left_entity_id") or "")
        }
        | {
            str(row.get("right_entity_id") or "")
            for row in rows
            if str(row.get("right_entity_id") or "")
        }
    )
    if not entity_ids:
        return {}

    entities = _select_in_chunks(
        "entities",
        "id, entity_type, canonical_name, document, normalized_name, source_confidence, created_at",
        "id",
        entity_ids,
    )
    return {str(entity["id"]): entity for entity in entities}


def _format_row(row: dict, entity_map: dict[str, dict]) -> dict:
    left_id = str(row.get("left_entity_id") or "")
    right_id = str(row.get("right_entity_id") or "")
    return {
        "id": row.get("id"),
        "cross_ref_type": row.get("cross_ref_type"),
        "confidence_label": row.get("confidence_label"),
        "confidence_score": float(row.get("confidence_score") or 0),
        "match_basis": row.get("match_basis"),
        "reason_summary": row.get("reason_summary"),
        "primary_source_upload_id": row.get("primary_source_upload_id"),
        "evidence_payload": row.get("evidence_payload") or {},
        "decision_status": row.get("decision_status"),
        "reviewed_by": row.get("reviewed_by"),
        "reviewed_at": row.get("reviewed_at"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "left_entity": entity_map.get(left_id),
        "right_entity": entity_map.get(right_id),
    }


@router.get("/investigations/server-supplier-links")
def server_supplier_links(
    confidence_level: str | None = Query(None),
    city_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    if confidence_level and confidence_level not in CONFIDENCE_LEVELS:
        raise HTTPException(status_code=400, detail="Nivel de confianca invalido.")

    try:
        rows = _fetch_cross_reference_rows("role_conflict", confidence_level)
        rows = _filter_by_city(rows, city_id)
        rows.sort(
            key=lambda item: (
                float(item.get("confidence_score") or 0),
                str(item.get("updated_at") or item.get("created_at") or ""),
            ),
            reverse=True,
        )

        entity_map = _resolve_entities(rows)
        total = len(rows)
        start = (page - 1) * page_size
        end = start + page_size

        return {
            "status": "success",
            "page": page,
            "page_size": page_size,
            "total": total,
            "items": [_format_row(row, entity_map) for row in rows[start:end]],
        }
    except UpstreamQueryError as error:
        _raise_upstream_http_error(error, "Falha temporaria ao carregar os conflitos investigativos. Tente novamente.")


@router.get("/investigations/name-matches")
def name_matches(
    confidence_level: str | None = Query(None),
    cross_ref_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    if confidence_level and confidence_level not in CONFIDENCE_LEVELS:
        raise HTTPException(status_code=400, detail="Nivel de confianca invalido.")
    if cross_ref_type and cross_ref_type not in NAME_MATCH_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de cruzamento invalido.")

    try:
        rows: list[dict] = []
        target_types = [cross_ref_type] if cross_ref_type else sorted(NAME_MATCH_TYPES)
        for current_type in target_types:
            rows.extend(_fetch_cross_reference_rows(current_type, confidence_level))

        deduped: dict[str, dict] = {}
        for row in rows:
            deduped[str(row["id"])] = row

        ordered = sorted(
            deduped.values(),
            key=lambda item: (
                float(item.get("confidence_score") or 0),
                str(item.get("updated_at") or item.get("created_at") or ""),
            ),
            reverse=True,
        )

        entity_map = _resolve_entities(ordered)
        total = len(ordered)
        start = (page - 1) * page_size
        end = start + page_size

        return {
            "status": "success",
            "page": page,
            "page_size": page_size,
            "total": total,
            "items": [_format_row(row, entity_map) for row in ordered[start:end]],
        }
    except UpstreamQueryError as error:
        _raise_upstream_http_error(error, "Falha temporaria ao carregar os matches investigativos. Tente novamente.")
