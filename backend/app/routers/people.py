from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, HTTPException, Query

try:
    from app.routers.entities import (
        UpstreamQueryError,
        _fetch_aliases,
        _fetch_cities,
        _fetch_entity,
        _fetch_links,
        _fetch_records,
        _fetch_uploads,
        _primary_date,
        _raise_upstream_http_error,
        _raw_value,
        _safe_amount,
        _select_in_chunks,
        _summary,
        supabase,
    )
except ModuleNotFoundError:
    from backend.app.routers.entities import (
        UpstreamQueryError,
        _fetch_aliases,
        _fetch_cities,
        _fetch_entity,
        _fetch_links,
        _fetch_records,
        _fetch_uploads,
        _primary_date,
        _raise_upstream_http_error,
        _raw_value,
        _safe_amount,
        _select_in_chunks,
        _summary,
        supabase,
    )


router = APIRouter(tags=["people"])
PERSON_TYPES = {"person", "server"}
CONFIDENCE_LEVELS = {"indicative", "probable", "confirmed"}
CROSS_REF_TYPES = {"same_person_candidate", "role_conflict", "homonym_candidate"}


def _ensure_person_entity(entity_id: str) -> dict:
    entity = _fetch_entity(entity_id)
    if str(entity.get("entity_type") or "") not in PERSON_TYPES:
        raise HTTPException(status_code=404, detail="Pessoa ou servidor nao encontrado.")
    return entity


def _fetch_cross_references(entity_id: str) -> list[dict]:
    left_rows = _select_in_chunks(
        "entity_cross_references",
        "*",
        "left_entity_id",
        [entity_id],
    )
    right_rows = _select_in_chunks(
        "entity_cross_references",
        "*",
        "right_entity_id",
        [entity_id],
    )

    combined: dict[str, dict] = {}
    for row in left_rows + right_rows:
        combined[str(row["id"])] = row

    return sorted(
        combined.values(),
        key=lambda item: (
            float(item.get("confidence_score") or 0),
            str(item.get("updated_at") or item.get("created_at") or ""),
        ),
        reverse=True,
    )


def _resolve_cross_reference_entities(rows: list[dict]) -> dict[str, dict]:
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


def _build_people_bundle(entity_id: str) -> dict:
    entity = _ensure_person_entity(entity_id)
    aliases_map = _fetch_aliases([entity_id])
    alias_rows = aliases_map.get(entity_id, [])
    links = _fetch_links([entity_id])
    record_ids = sorted({str(link["standardized_record_id"]) for link in links if str(link.get("standardized_record_id") or "")})
    records = _fetch_records(record_ids)
    upload_ids = sorted({str(record.get("upload_id") or "") for record in records.values() if record.get("upload_id")})
    uploads = _fetch_uploads(upload_ids)
    city_ids = sorted({str(upload.get("city_id") or "") for upload in uploads.values() if upload.get("city_id")})
    cities = _fetch_cities(city_ids)
    cross_refs = _fetch_cross_references(entity_id)
    cross_ref_entities = _resolve_cross_reference_entities(cross_refs)

    return {
        "entity": entity,
        "aliases": alias_rows,
        "links": links,
        "records": records,
        "uploads": uploads,
        "cities": cities,
        "cross_refs": cross_refs,
        "cross_ref_entities": cross_ref_entities,
    }


def _cross_reference_summary(entity_id: str, cross_refs: list[dict]) -> dict:
    totals_by_type = {key: 0 for key in CROSS_REF_TYPES}
    totals_by_confidence = {key: 0 for key in CONFIDENCE_LEVELS}

    for row in cross_refs:
        ref_type = str(row.get("cross_ref_type") or "")
        confidence = str(row.get("confidence_label") or "")
        if ref_type in totals_by_type:
            totals_by_type[ref_type] += 1
        if confidence in totals_by_confidence:
            totals_by_confidence[confidence] += 1

    return {
        "entity_id": entity_id,
        "total": len(cross_refs),
        "conflicts_detected": totals_by_type.get("role_conflict", 0),
        "totals_by_type": totals_by_type,
        "totals_by_confidence": totals_by_confidence,
    }


def _format_cross_reference_item(entity_id: str, row: dict, entity_map: dict[str, dict]) -> dict:
    left_id = str(row.get("left_entity_id") or "")
    right_id = str(row.get("right_entity_id") or "")
    left_entity = entity_map.get(left_id)
    right_entity = entity_map.get(right_id)
    counterpart = right_entity if left_id == entity_id else left_entity

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
        "left_entity": left_entity,
        "right_entity": right_entity,
        "counterpart": counterpart,
    }


@router.get("/people/{entity_id}")
def person_overview(entity_id: str):
    try:
        bundle = _build_people_bundle(entity_id)
        entity = bundle["entity"]
        aliases = bundle["aliases"]
        links = bundle["links"]
        records = bundle["records"]
        uploads = bundle["uploads"]
        cities = bundle["cities"]
        cross_refs = bundle["cross_refs"]

        roles_observed = sorted(
            {
                str(link.get("role_in_record") or "").strip()
                for link in links
                if str(link.get("role_in_record") or "").strip()
            }
        )

        total_amount = round(sum(_safe_amount(record.get("valor_bruto")) for record in records.values()), 2)
        upload_ids = {str(record.get("upload_id") or "") for record in records.values() if record.get("upload_id")}
        category_groups: dict[str, dict] = defaultdict(lambda: {"records_count": 0, "total_amount": 0.0})
        upload_groups: dict[str, dict] = {}
        timeline_groups: dict[str, dict] = defaultdict(lambda: {"records_count": 0, "total_amount": 0.0})
        city_groups: dict[str, dict] = defaultdict(
            lambda: {"records_count": 0, "total_amount": 0.0, "city_name": "Nao informado", "state": ""}
        )

        for link in links:
            record = records.get(str(link.get("standardized_record_id") or ""))
            if not record:
                continue

            upload = uploads.get(str(record.get("upload_id") or ""))
            amount = _safe_amount(record.get("valor_bruto"))
            category = str(record.get("category") or (upload or {}).get("category") or "other")
            period = (_primary_date(record, upload) or "-")[:7]

            category_groups[category]["records_count"] += 1
            category_groups[category]["total_amount"] += amount

            upload_id = str(record.get("upload_id") or "")
            if upload_id:
                if upload_id not in upload_groups:
                    upload_groups[upload_id] = {
                        "upload_id": upload_id,
                        "file_name": (upload or {}).get("file_name"),
                        "report_type": record.get("report_type") or (upload or {}).get("report_type"),
                        "report_label": record.get("report_label") or (upload or {}).get("report_label"),
                        "category": category,
                        "created_at": (upload or {}).get("created_at"),
                        "records_count": 0,
                        "total_amount": 0.0,
                    }
                upload_groups[upload_id]["records_count"] += 1
                upload_groups[upload_id]["total_amount"] += amount

                city_id = str((upload or {}).get("city_id") or "")
                if city_id:
                    city = cities.get(city_id, {})
                    city_groups[city_id]["city_name"] = city.get("name") or "Nao informado"
                    city_groups[city_id]["state"] = city.get("state") or ""
                    city_groups[city_id]["records_count"] += 1
                    city_groups[city_id]["total_amount"] += amount

            if period and period != "-":
                timeline_groups[period]["records_count"] += 1
                timeline_groups[period]["total_amount"] += amount

        return {
            "status": "success",
            "person": {
                "id": entity_id,
                "entity_type": entity.get("entity_type"),
                "canonical_name": entity.get("canonical_name"),
                "document": entity.get("document"),
                "source_confidence": entity.get("source_confidence"),
                "aliases": sorted(
                    {
                        str(alias.get("alias_name") or "").strip()
                        for alias in aliases
                        if str(alias.get("alias_name") or "").strip()
                    }
                ),
            },
            "summary": {
                "uploads_count": len(upload_ids),
                "cities_count": len(city_groups),
                "categories_count": len(category_groups),
                "records_count": len(links),
                "total_amount": total_amount,
                "conflicts_detected": _cross_reference_summary(entity_id, cross_refs)["conflicts_detected"],
            },
            "categories": [
                {
                    "category": category,
                    "records_count": values["records_count"],
                    "total_amount": round(values["total_amount"], 2),
                }
                for category, values in sorted(category_groups.items(), key=lambda item: item[1]["total_amount"], reverse=True)
            ],
            "roles_observed": roles_observed,
            "timeline": [
                {
                    "period": period,
                    "records_count": values["records_count"],
                    "total_amount": round(values["total_amount"], 2),
                }
                for period, values in sorted(timeline_groups.items())
            ],
            "uploads": sorted(upload_groups.values(), key=lambda item: item["total_amount"], reverse=True),
            "cross_reference_summary": _cross_reference_summary(entity_id, cross_refs),
        }
    except UpstreamQueryError as error:
        _raise_upstream_http_error(error, "Falha temporaria ao carregar os dados da pessoa. Tente novamente.")


@router.get("/people/{entity_id}/appearances")
def person_appearances(
    entity_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    upload_id: str | None = Query(None),
    category: str | None = Query(None),
    role: str | None = Query(None),
):
    try:
        bundle = _build_people_bundle(entity_id)
        links = bundle["links"]
        records = bundle["records"]
        uploads = bundle["uploads"]
        cities = bundle["cities"]

        items: list[dict] = []
        for link in links:
            link_role = str(link.get("role_in_record") or "")
            if role and link_role != role:
                continue

            record = records.get(str(link.get("standardized_record_id") or ""))
            if not record:
                continue

            current_upload_id = str(record.get("upload_id") or "")
            current_upload = uploads.get(current_upload_id)
            record_category = str(record.get("category") or (current_upload or {}).get("category") or "")
            if upload_id and current_upload_id != upload_id:
                continue
            if category and record_category != category:
                continue

            city = cities.get(str((current_upload or {}).get("city_id") or ""))
            items.append(
                {
                    "record_id": record.get("id"),
                    "upload_id": current_upload_id,
                    "file_name": (current_upload or {}).get("file_name"),
                    "category": record_category,
                    "role_in_record": link_role,
                    "data": _primary_date(record, current_upload),
                    "valor_bruto": _safe_amount(record.get("valor_bruto")),
                    "city_name": city.get("name") if city else None,
                    "state": city.get("state") if city else None,
                    "summary": _summary(record),
                }
            )

        items.sort(key=lambda item: (item["data"] or "", item["valor_bruto"]), reverse=True)
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
        _raise_upstream_http_error(error, "Falha temporaria ao carregar as aparicoes desta pessoa. Tente novamente.")


@router.get("/people/{entity_id}/cross-references")
def person_cross_references(
    entity_id: str,
    cross_ref_type: str | None = Query(None),
    confidence_level: str | None = Query(None),
):
    try:
        _ensure_person_entity(entity_id)

        if cross_ref_type and cross_ref_type not in CROSS_REF_TYPES:
            raise HTTPException(status_code=400, detail="Tipo de cruzamento invalido.")
        if confidence_level and confidence_level not in CONFIDENCE_LEVELS:
            raise HTTPException(status_code=400, detail="Nivel de confianca invalido.")

        rows = _fetch_cross_references(entity_id)
        entity_map = _resolve_cross_reference_entities(rows)

        filtered = []
        totals_by_type = {key: 0 for key in CROSS_REF_TYPES}
        for row in rows:
            ref_type = str(row.get("cross_ref_type") or "")
            confidence = str(row.get("confidence_label") or "")
            if cross_ref_type and ref_type != cross_ref_type:
                continue
            if confidence_level and confidence != confidence_level:
                continue
            if ref_type in totals_by_type:
                totals_by_type[ref_type] += 1
            filtered.append(_format_cross_reference_item(entity_id, row, entity_map))

        return {
            "status": "success",
            "totals_by_type": totals_by_type,
            "total": len(filtered),
            "items": filtered,
        }
    except UpstreamQueryError as error:
        _raise_upstream_http_error(error, "Falha temporaria ao carregar os cruzamentos desta pessoa. Tente novamente.")
