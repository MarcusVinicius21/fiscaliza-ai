"""Router de pagamentos da Etapa D."""
from __future__ import annotations

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

router = APIRouter(tags=["payments"])

_PAYMENT_COLUMNS = (
    "id,city_id,source_upload_id,primary_record_id,supplier_entity_id,"
    "payment_number_raw,payment_number_normalized,contract_number_raw,contract_number_normalized,"
    "bid_number_raw,bid_number_normalized,process_number_raw,process_number_normalized,"
    "expense_stage,object_text,object_normalized,object_signature,payment_value,payment_date,"
    "contract_fact_id,contract_link_status,contract_link_basis,contract_link_score,contract_link_reason,"
    "bid_fact_id,bid_link_status,bid_link_basis,bid_link_score,bid_link_reason,signature_hash,created_at,updated_at"
)
_CONTRACT_COLUMNS = (
    "id,city_id,source_upload_id,primary_record_id,supplier_entity_id,"
    "contract_number_raw,contract_number_normalized,modality,object_text,contract_value,start_date,end_date,publication_date,"
    "bid_fact_id,bid_link_status,bid_link_basis,bid_link_reason"
)
_BID_COLUMNS = (
    "id,city_id,winner_entity_id,bid_number_raw,bid_number_normalized,process_number_raw,process_number_normalized,"
    "modality,object_text,estimated_value,awarded_value,event_date,publication_date,status"
)
_PROVENANCE_COLUMNS = "id,payment_fact_id,standardized_record_id,source_upload_id,link_role,dedupe_reason,created_at"


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


def _search_supplier_entity_ids(supplier_query: str) -> list[str]:
    term = str(supplier_query or "").strip()
    if not term:
        return []

    def _build_entities():
        return supabase.table("entities").select("id").ilike("canonical_name", f"%{term}%").limit(60)

    def _build_aliases():
        return supabase.table("entity_aliases").select("entity_id").ilike("alias_name", f"%{term}%").limit(60)

    entity_rows = execute_with_retry(_build_entities, "entities").data or []
    alias_rows = execute_with_retry(_build_aliases, "entity_aliases").data or []
    ids = {str(row.get("id") or "") for row in entity_rows if row.get("id")}
    ids.update(str(row.get("entity_id") or "") for row in alias_rows if row.get("entity_id"))
    return sorted(value for value in ids if value)


def _contracts_map(contract_ids: list[str]) -> dict[str, dict]:
    if not contract_ids:
        return {}
    rows = select_in_chunks("contracts_facts", contract_ids, select=_CONTRACT_COLUMNS)
    return {str(row.get("id")): row for row in rows or []}


def _bids_map(bid_ids: list[str]) -> dict[str, dict]:
    if not bid_ids:
        return {}
    rows = select_in_chunks("bids_facts", bid_ids, select=_BID_COLUMNS)
    return {str(row.get("id")): row for row in rows or []}


def _fact_records_map(payment_ids: list[str]) -> dict[str, list[dict]]:
    if not payment_ids:
        return {}
    rows = select_in_chunks(
        "payment_fact_records",
        payment_ids,
        id_column="payment_fact_id",
        select=_PROVENANCE_COLUMNS,
    )
    grouped: dict[str, list[dict]] = {}
    for row in rows or []:
        payment_id = str(row.get("payment_fact_id") or "")
        if payment_id:
            grouped.setdefault(payment_id, []).append(row)
    return grouped


def _provenance_rows(provenance: list[dict]) -> list[dict]:
    if not provenance:
        return []
    record_ids = sorted({
        str(row.get("standardized_record_id") or "")
        for row in provenance
        if row.get("standardized_record_id")
    })
    upload_ids = sorted({
        str(row.get("source_upload_id") or "")
        for row in provenance
        if row.get("source_upload_id")
    })
    record_map = _fetch_records(record_ids)
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


def _format_payment_row(
    payment: dict,
    suppliers: dict[str, dict],
    cities: dict[str, dict],
    contracts: dict[str, dict],
    provenance: list[dict] | None = None,
) -> dict:
    supplier = suppliers.get(str(payment.get("supplier_entity_id") or ""))
    city = cities.get(str(payment.get("city_id") or ""))
    contract = contracts.get(str(payment.get("contract_fact_id") or ""))
    return {
        "id": payment.get("id"),
        "number": payment.get("payment_number_normalized"),
        "raw_number": payment.get("payment_number_raw"),
        "supplier_id": payment.get("supplier_entity_id"),
        "supplier_name": supplier.get("canonical_name") if supplier else None,
        "supplier_canonical_name": supplier.get("canonical_name") if supplier else None,
        "amount": payment.get("payment_value"),
        "paid_at": payment.get("payment_date"),
        "city_name": city.get("name") if city else None,
        "state": city.get("state") if city else None,
        "contract_fact_id": payment.get("contract_fact_id"),
        "contract_raw_number": contract.get("contract_number_raw") if contract else payment.get("contract_number_raw"),
        "contract_link_status": payment.get("contract_link_status"),
        "bid_fact_id": payment.get("bid_fact_id"),
        "bid_link_status": payment.get("bid_link_status"),
        "expense_stage": payment.get("expense_stage"),
        "provenance": provenance or [],
    }


def _format_contract_block(contract: dict | None, suppliers: dict[str, dict]) -> dict | None:
    if not contract:
        return None
    supplier = suppliers.get(str(contract.get("supplier_entity_id") or ""))
    return {
        "id": contract.get("id"),
        "number": contract.get("contract_number_normalized"),
        "raw_number": contract.get("contract_number_raw"),
        "supplier_canonical_name": supplier.get("canonical_name") if supplier else None,
        "contract_value": contract.get("contract_value"),
        "signed_at": contract.get("start_date") or contract.get("publication_date"),
        "modality": contract.get("modality"),
    }


def _format_bid_block(bid: dict | None) -> dict | None:
    if not bid:
        return None
    return {
        "id": bid.get("id"),
        "number": bid.get("bid_number_normalized"),
        "raw_number": bid.get("bid_number_raw"),
        "process_number": bid.get("process_number_raw") or bid.get("process_number_normalized"),
        "modality": bid.get("modality"),
        "value": bid.get("awarded_value") if bid.get("awarded_value") is not None else bid.get("estimated_value"),
        "published_at": bid.get("event_date") or bid.get("publication_date"),
    }


def _fetch_payment(payment_id: str) -> dict:
    try:
        response = execute_with_retry(
            lambda: supabase.table("payments_facts").select(_PAYMENT_COLUMNS).eq("id", payment_id).limit(1),
            "payments_facts",
        )
    except UpstreamQueryError as exc:
        raise_upstream_http_error("Falha temporaria ao carregar o pagamento. Tente novamente.")
        raise exc  # pragma: no cover
    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Pagamento nao encontrado.")
    return rows[0]


@router.get("/payments")
def list_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    upload_id: str | None = None,
    city_id: str | None = None,
    supplier_entity_id: str | None = None,
    supplier: str | None = None,
    contract_link_status: str | None = None,
):
    offset = (page - 1) * page_size
    end = offset + page_size - 1

    try:
        supplier_ids = [supplier_entity_id] if supplier_entity_id else []
        if supplier and not supplier_ids:
            supplier_ids = _search_supplier_entity_ids(supplier)
            if not supplier_ids:
                return {"status": "ok", "page": page, "page_size": page_size, "total": 0, "items": []}

        def _build():
            query = supabase.table("payments_facts").select(_PAYMENT_COLUMNS, count="exact")
            if upload_id:
                query = query.eq("source_upload_id", upload_id)
            if city_id:
                query = query.eq("city_id", city_id)
            if supplier_ids:
                query = query.in_("supplier_entity_id", supplier_ids)
            if contract_link_status:
                query = query.eq("contract_link_status", contract_link_status)
            return query.order("payment_date", desc=True).range(offset, end)

        response = execute_with_retry(_build, "payments_facts")
        rows = response.data or []
        total = getattr(response, "count", None) or len(rows)
        suppliers = _entities_map([str(row.get("supplier_entity_id")) for row in rows if row.get("supplier_entity_id")])
        cities = _fetch_cities([str(row.get("city_id")) for row in rows if row.get("city_id")])
        contracts = _contracts_map([str(row.get("contract_fact_id")) for row in rows if row.get("contract_fact_id")])

        items = [_format_payment_row(row, suppliers, cities, contracts) for row in rows]
        return {"status": "ok", "page": page, "page_size": page_size, "total": total, "items": items}
    except UpstreamQueryError as exc:
        raise_upstream_http_error("Falha temporaria ao carregar pagamentos. Tente novamente.")
        raise exc  # pragma: no cover
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        if is_missing_table_error(exc):
            raise_missing_schema_http_error()
        raise


@router.get("/payments/{payment_id}")
def get_payment(payment_id: str):
    try:
        payment = _fetch_payment(payment_id)
        suppliers = _entities_map([str(payment.get("supplier_entity_id"))] if payment.get("supplier_entity_id") else [])
        cities = _fetch_cities([str(payment.get("city_id"))] if payment.get("city_id") else [])
        contracts = _contracts_map([str(payment.get("contract_fact_id"))] if payment.get("contract_fact_id") else [])
        provenance = _provenance_rows(_fact_records_map([payment_id]).get(payment_id, []))

        return {
            "status": "ok",
            "payment": _format_payment_row(payment, suppliers, cities, contracts, provenance=provenance),
        }
    except UpstreamQueryError as exc:
        raise_upstream_http_error("Falha temporaria ao carregar o pagamento. Tente novamente.")
        raise exc  # pragma: no cover
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        if is_missing_table_error(exc):
            raise_missing_schema_http_error()
        raise


@router.get("/payments/{payment_id}/contract-link")
def get_payment_contract_link(payment_id: str):
    try:
        payment = _fetch_payment(payment_id)

        contract_map = _contracts_map([str(payment.get("contract_fact_id"))] if payment.get("contract_fact_id") else [])
        contract = contract_map.get(str(payment.get("contract_fact_id") or ""))
        supplier_ids = [str(payment.get("supplier_entity_id"))] if payment.get("supplier_entity_id") else []
        if contract and contract.get("supplier_entity_id"):
            supplier_ids.append(str(contract.get("supplier_entity_id")))
        suppliers = _entities_map(supplier_ids)

        bid_id = payment.get("bid_fact_id") or (contract.get("bid_fact_id") if contract else None)
        bids = _bids_map([str(bid_id)] if bid_id else [])
        bid = bids.get(str(bid_id or ""))

        return {
            "status": "ok",
            "payment": {
                "id": payment.get("id"),
                "number": payment.get("payment_number_normalized"),
                "raw_number": payment.get("payment_number_raw"),
                "amount": payment.get("payment_value"),
                "paid_at": payment.get("payment_date"),
                "contract_link_status": payment.get("contract_link_status"),
                "bid_link_status": payment.get("bid_link_status"),
            },
            "contract": _format_contract_block(contract, suppliers),
            "bid": _format_bid_block(bid),
            "link_status": payment.get("contract_link_status"),
            "link_basis": payment.get("contract_link_basis"),
            "link_reason": payment.get("contract_link_reason"),
            "reason": {
                "contract_link_basis": payment.get("contract_link_basis"),
                "contract_link_reason": payment.get("contract_link_reason"),
                "bid_link_basis": payment.get("bid_link_basis"),
                "bid_link_reason": payment.get("bid_link_reason"),
            },
        }
    except UpstreamQueryError as exc:
        raise_upstream_http_error("Falha temporaria ao carregar o vinculo do pagamento. Tente novamente.")
        raise exc  # pragma: no cover
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        if is_missing_table_error(exc):
            raise_missing_schema_http_error()
        raise
