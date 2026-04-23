"""Router de licitacoes da Etapa D."""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from fastapi import APIRouter, HTTPException, Query

try:
    from app.routers.entities import _fetch_cities, _fetch_records, _fetch_uploads, _primary_date, _summary
    from app.utils.supabase_resilience import (
        UpstreamQueryError,
        execute_with_retry,
        is_missing_table_error,
        raise_missing_schema_http_error,
        raise_upstream_http_error,
        select_in_chunks,
        supabase,
    )
except ModuleNotFoundError:  # pragma: no cover
    from backend.app.routers.entities import _fetch_cities, _fetch_records, _fetch_uploads, _primary_date, _summary
    from backend.app.utils.supabase_resilience import (
        UpstreamQueryError,
        execute_with_retry,
        is_missing_table_error,
        raise_missing_schema_http_error,
        raise_upstream_http_error,
        select_in_chunks,
        supabase,
    )

router = APIRouter(tags=["bids"])

_BID_COLUMNS = (
    "id,city_id,source_upload_id,primary_record_id,winner_entity_id,"
    "bid_number_raw,bid_number_normalized,process_number_raw,process_number_normalized,"
    "modality,act_type,object_text,object_normalized,object_signature,"
    "estimated_value,awarded_value,event_date,publication_date,status,"
    "signature_hash,created_at,updated_at"
)
_CONTRACT_COLUMNS = (
    "id,city_id,source_upload_id,primary_record_id,supplier_entity_id,"
    "contract_number_raw,contract_number_normalized,bid_number_raw,bid_number_normalized,"
    "process_number_raw,process_number_normalized,modality,act_type,object_text,"
    "object_normalized,object_signature,contract_value,start_date,end_date,"
    "publication_date,bid_fact_id,bid_link_status,bid_link_basis,bid_link_score,bid_link_reason"
)
_PAYMENT_COLUMNS = (
    "id,city_id,source_upload_id,primary_record_id,supplier_entity_id,"
    "payment_number_raw,payment_number_normalized,contract_number_raw,contract_number_normalized,"
    "bid_number_raw,bid_number_normalized,process_number_raw,process_number_normalized,"
    "expense_stage,object_text,object_normalized,object_signature,payment_value,payment_date,"
    "contract_fact_id,contract_link_status,contract_link_basis,contract_link_score,contract_link_reason,"
    "bid_fact_id,bid_link_status,bid_link_basis,bid_link_score,bid_link_reason"
)
_PROVENANCE_COLUMNS = "id,bid_fact_id,standardized_record_id,source_upload_id,link_role,dedupe_reason,created_at"


def _safe_number(value: Any) -> float:
    if value in (None, ""):
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _entities_map(ids: list[str]) -> dict[str, dict]:
    if not ids:
        return {}
    rows = select_in_chunks(
        "entities",
        ids,
        select="id,entity_type,canonical_name,document,normalized_name,source_confidence,created_at",
    )
    return {str(row.get("id")): row for row in rows or []}


def _fact_records_map(bid_ids: list[str]) -> dict[str, list[dict]]:
    if not bid_ids:
        return {}
    rows = select_in_chunks(
        "bid_fact_records",
        bid_ids,
        id_column="bid_fact_id",
        select=_PROVENANCE_COLUMNS,
    )
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows or []:
        grouped[str(row.get("bid_fact_id") or "")].append(row)
    return grouped


def _provenance_rows(provenance: list[dict]) -> list[dict]:
    if not provenance:
        return []
    record_ids = sorted({str(row.get("standardized_record_id") or "") for row in provenance if row.get("standardized_record_id")})
    record_map = _fetch_records(record_ids)
    upload_ids = sorted({str(row.get("source_upload_id") or "") for row in provenance if row.get("source_upload_id")})
    upload_map = _fetch_uploads(upload_ids)

    rows: list[dict] = []
    for row in provenance:
        record = record_map.get(str(row.get("standardized_record_id") or ""))
        upload = upload_map.get(str(row.get("source_upload_id") or ""))
        rows.append(
            {
                "standardized_record_id": row.get("standardized_record_id"),
                "source_upload_id": row.get("source_upload_id"),
                "link_role": row.get("link_role"),
                "dedupe_reason": row.get("dedupe_reason"),
                "file_name": upload.get("file_name") if upload else None,
                "category": record.get("category") if record else None,
                "report_type": record.get("report_type") if record else None,
                "report_label": record.get("report_label") if record else None,
                "date": _primary_date(record or {}, upload),
                "summary": _summary(record or {}) if record else "",
                "document": record.get("documento") if record else None,
                "amount": _safe_number(record.get("valor_bruto")) if record else 0.0,
            }
        )
    return rows


def _fetch_bid(bid_id: str) -> dict:
    try:
        response = execute_with_retry(
            lambda: supabase.table("bids_facts").select(_BID_COLUMNS).eq("id", bid_id).limit(1),
            "bids_facts",
        )
    except UpstreamQueryError as exc:
        raise_upstream_http_error("Falha temporaria ao carregar a licitacao. Tente novamente.")
        raise exc  # pragma: no cover
    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Licitacao nao encontrada.")
    return rows[0]


def _contracts_by_bid(bid_ids: list[str]) -> dict[str, list[dict]]:
    if not bid_ids:
        return {}
    rows = select_in_chunks(
        "contracts_facts",
        bid_ids,
        id_column="bid_fact_id",
        select=_CONTRACT_COLUMNS,
    )
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows or []:
        grouped[str(row.get("bid_fact_id") or "")].append(row)
    return grouped


def _payments_by_contract(contract_ids: list[str]) -> list[dict]:
    if not contract_ids:
        return []
    return select_in_chunks(
        "payments_facts",
        contract_ids,
        id_column="contract_fact_id",
        select=_PAYMENT_COLUMNS,
    )


def _format_bid_row(bid: dict, cities: dict[str, dict], winners: dict[str, dict], provenance: list[dict] | None = None) -> dict:
    city = cities.get(str(bid.get("city_id") or ""))
    winner = winners.get(str(bid.get("winner_entity_id") or ""))
    return {
        "id": bid.get("id"),
        "number": bid.get("bid_number_normalized"),
        "raw_number": bid.get("bid_number_raw"),
        "process_number": bid.get("process_number_raw") or bid.get("process_number_normalized"),
        "modality": bid.get("modality"),
        "act_type": bid.get("act_type"),
        "object_summary": bid.get("object_text"),
        "estimated_value": bid.get("estimated_value"),
        "awarded_value": bid.get("awarded_value"),
        "published_at": bid.get("event_date") or bid.get("publication_date"),
        "status": bid.get("status"),
        "city_name": city.get("name") if city else None,
        "state": city.get("state") if city else None,
        "winner_entity_id": bid.get("winner_entity_id"),
        "winner_entity_name": winner.get("canonical_name") if winner else None,
        "winner_canonical_name": winner.get("canonical_name") if winner else None,
        "provenance": provenance or [],
    }


def _format_contract_row(contract: dict, suppliers: dict[str, dict]) -> dict:
    supplier = suppliers.get(str(contract.get("supplier_entity_id") or ""))
    return {
        "id": contract.get("id"),
        "number": contract.get("contract_number_normalized"),
        "raw_number": contract.get("contract_number_raw"),
        "supplier_canonical_name": supplier.get("canonical_name") if supplier else None,
        "supplier_name": supplier.get("canonical_name") if supplier else None,
        "contract_value": contract.get("contract_value"),
        "signed_at": contract.get("start_date") or contract.get("publication_date"),
        "modality": contract.get("modality"),
    }


def _format_payment_row(payment: dict, suppliers: dict[str, dict]) -> dict:
    supplier = suppliers.get(str(payment.get("supplier_entity_id") or ""))
    return {
        "id": payment.get("id"),
        "number": payment.get("payment_number_normalized"),
        "raw_number": payment.get("payment_number_raw"),
        "amount": payment.get("payment_value"),
        "paid_at": payment.get("payment_date"),
        "supplier_canonical_name": supplier.get("canonical_name") if supplier else None,
        "supplier_name": supplier.get("canonical_name") if supplier else None,
    }


@router.get("/bids")
def list_bids(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    upload_id: str | None = None,
    city_id: str | None = None,
    modality: str | None = None,
):
    try:
        offset = (page - 1) * page_size
        end = offset + page_size - 1

        def _build():
            query = supabase.table("bids_facts").select(_BID_COLUMNS, count="exact")
            if upload_id:
                query = query.eq("source_upload_id", upload_id)
            if city_id:
                query = query.eq("city_id", city_id)
            if modality:
                query = query.eq("modality", modality)
            return query.order("event_date", desc=True).range(offset, end)

        response = execute_with_retry(_build, "bids_facts")
        rows = response.data or []
        total = getattr(response, "count", None) or len(rows)
        cities = _fetch_cities([str(row.get("city_id")) for row in rows if row.get("city_id")])
        winners = _entities_map([str(row.get("winner_entity_id")) for row in rows if row.get("winner_entity_id")])
        contracts_map = _contracts_by_bid([str(row.get("id")) for row in rows if row.get("id")])

        items = []
        for row in rows:
            item = _format_bid_row(row, cities, winners)
            item["contracts_count"] = len(contracts_map.get(str(row.get("id")), []))
            items.append(item)

        return {"status": "ok", "page": page, "page_size": page_size, "total": total, "items": items}
    except UpstreamQueryError as exc:
        raise_upstream_http_error("Falha temporaria ao carregar licitacoes. Tente novamente.")
        raise exc  # pragma: no cover
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        if is_missing_table_error(exc):
            raise_missing_schema_http_error()
        raise


@router.get("/bids/{bid_id}")
def get_bid(bid_id: str):
    try:
        bid = _fetch_bid(bid_id)
        cities = _fetch_cities([str(bid.get("city_id"))] if bid.get("city_id") else [])
        winners = _entities_map([str(bid.get("winner_entity_id"))] if bid.get("winner_entity_id") else [])
        provenance = _provenance_rows(_fact_records_map([bid_id]).get(bid_id, []))
        return {"status": "ok", "bid": _format_bid_row(bid, cities, winners, provenance=provenance)}
    except UpstreamQueryError as exc:
        raise_upstream_http_error("Falha temporaria ao carregar a licitacao. Tente novamente.")
        raise exc  # pragma: no cover
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        if is_missing_table_error(exc):
            raise_missing_schema_http_error()
        raise


@router.get("/bids/{bid_id}/chain")
def get_bid_chain(bid_id: str):
    try:
        bid = _fetch_bid(bid_id)
        cities = _fetch_cities([str(bid.get("city_id"))] if bid.get("city_id") else [])
        winners = _entities_map([str(bid.get("winner_entity_id"))] if bid.get("winner_entity_id") else [])
        bid_payload = _format_bid_row(bid, cities, winners, provenance=_provenance_rows(_fact_records_map([bid_id]).get(bid_id, [])))

        contracts = _contracts_by_bid([bid_id]).get(bid_id, [])

        supplier_map = _entities_map(
            [str(contract.get("supplier_entity_id")) for contract in contracts if contract.get("supplier_entity_id")]
        )
        contract_items = [_format_contract_row(contract, supplier_map) for contract in contracts]

        payments_raw = _payments_by_contract([str(contract.get("id")) for contract in contracts if contract.get("id")])
        direct_payments = select_in_chunks(
            "payments_facts",
            [bid_id],
            id_column="bid_fact_id",
            select=_PAYMENT_COLUMNS,
        )
        payment_map = {str(payment.get("id")): payment for payment in payments_raw}
        for payment in direct_payments or []:
            payment_map.setdefault(str(payment.get("id")), payment)
        payment_suppliers = _entities_map(
            [str(payment.get("supplier_entity_id")) for payment in payment_map.values() if payment.get("supplier_entity_id")]
        )
        payment_items = [_format_payment_row(payment, payment_suppliers) for payment in payment_map.values()]

        summary = {
            "contracts_count": len(contract_items),
            "payments_count": len(payment_items),
            "total_contracted": round(sum(_safe_number(contract.get("contract_value")) for contract in contracts), 2),
            "total_paid": round(sum(_safe_number(payment.get("payment_value")) for payment in payment_map.values()), 2),
            "estimated_value": bid.get("estimated_value"),
            "awarded_value": bid.get("awarded_value"),
        }

        return {
            "status": "ok",
            "bid": bid_payload,
            "contracts": contract_items,
            "payments": payment_items,
            "summary": summary,
        }
    except UpstreamQueryError as exc:
        raise_upstream_http_error("Falha temporaria ao carregar a cadeia da licitacao. Tente novamente.")
        raise exc  # pragma: no cover
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        if is_missing_table_error(exc):
            raise_missing_schema_http_error()
        raise
