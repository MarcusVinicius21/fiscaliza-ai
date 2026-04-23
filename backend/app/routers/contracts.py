"""Router de contratos da Etapa D."""
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

router = APIRouter(tags=["contracts"])

_CONTRACT_COLUMNS = (
    "id,city_id,source_upload_id,primary_record_id,supplier_entity_id,"
    "contract_number_raw,contract_number_normalized,bid_number_raw,bid_number_normalized,"
    "process_number_raw,process_number_normalized,modality,act_type,object_text,"
    "object_normalized,object_signature,contract_value,start_date,end_date,"
    "publication_date,bid_fact_id,bid_link_status,bid_link_basis,bid_link_score,"
    "bid_link_reason,signature_hash,created_at,updated_at"
)
_BID_COLUMNS = (
    "id,city_id,source_upload_id,primary_record_id,winner_entity_id,"
    "bid_number_raw,bid_number_normalized,process_number_raw,process_number_normalized,"
    "modality,act_type,object_text,object_normalized,object_signature,"
    "estimated_value,awarded_value,event_date,publication_date,status,"
    "signature_hash,created_at,updated_at"
)
_PAYMENT_COLUMNS = (
    "id,city_id,source_upload_id,primary_record_id,supplier_entity_id,"
    "payment_number_raw,payment_number_normalized,contract_number_raw,contract_number_normalized,"
    "bid_number_raw,bid_number_normalized,process_number_raw,process_number_normalized,"
    "expense_stage,object_text,object_normalized,object_signature,payment_value,payment_date,"
    "contract_fact_id,contract_link_status,contract_link_basis,contract_link_score,contract_link_reason,"
    "bid_fact_id,bid_link_status,bid_link_basis,bid_link_score,bid_link_reason,signature_hash,created_at,updated_at"
)
_PROVENANCE_COLUMNS = "id,contract_fact_id,standardized_record_id,source_upload_id,link_role,dedupe_reason,created_at"


def _safe_number(value: Any) -> float:
    if value in (None, ""):
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _entities_map(entity_ids: list[str]) -> dict[str, dict]:
    if not entity_ids:
        return {}
    rows = select_in_chunks(
        "entities",
        entity_ids,
        select="id,entity_type,canonical_name,document,normalized_name,source_confidence,created_at",
    )
    return {str(row.get("id")): row for row in rows or []}


def _fact_records_map(contract_ids: list[str]) -> dict[str, list[dict]]:
    if not contract_ids:
        return {}
    rows = select_in_chunks(
        "contract_fact_records",
        contract_ids,
        id_column="contract_fact_id",
        select=_PROVENANCE_COLUMNS,
    )
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows or []:
        grouped[str(row.get("contract_fact_id") or "")].append(row)
    return grouped


def _payments_by_contract(contract_ids: list[str]) -> dict[str, list[dict]]:
    if not contract_ids:
        return {}
    try:
        rows = select_in_chunks(
            "payments_facts",
            contract_ids,
            id_column="contract_fact_id",
            select=_PAYMENT_COLUMNS,
        )
    except UpstreamQueryError as exc:
        raise_upstream_http_error("Falha temporaria ao carregar pagamentos vinculados. Tente novamente.")
        raise exc  # pragma: no cover
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows or []:
        grouped[str(row.get("contract_fact_id") or "")].append(row)
    return grouped


def _city_map_for_rows(rows: list[dict]) -> dict[str, dict]:
    city_ids = sorted({str(row.get("city_id") or "") for row in rows if row.get("city_id")})
    return _fetch_cities(city_ids)


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
        "contract_link_status": payment.get("contract_link_status"),
        "bid_link_status": payment.get("bid_link_status"),
    }


def _format_bid_row(bid: dict | None) -> dict | None:
    if not bid:
        return None
    value = bid.get("awarded_value") if bid.get("awarded_value") is not None else bid.get("estimated_value")
    return {
        "id": bid.get("id"),
        "number": bid.get("bid_number_normalized"),
        "raw_number": bid.get("bid_number_raw"),
        "process_number": bid.get("process_number_raw") or bid.get("process_number_normalized"),
        "modality": bid.get("modality"),
        "status": bid.get("status"),
        "value": value,
        "published_at": bid.get("event_date") or bid.get("publication_date"),
    }


def _format_contract_row(
    contract: dict,
    suppliers: dict[str, dict],
    cities: dict[str, dict],
    total_paid: float = 0.0,
    provenance: list[dict] | None = None,
    fragmentation_signal: dict | None = None,
) -> dict:
    supplier = suppliers.get(str(contract.get("supplier_entity_id") or ""))
    city = cities.get(str(contract.get("city_id") or ""))
    return {
        "id": contract.get("id"),
        "number": contract.get("contract_number_normalized"),
        "raw_number": contract.get("contract_number_raw"),
        "supplier_id": contract.get("supplier_entity_id"),
        "supplier_name": supplier.get("canonical_name") if supplier else None,
        "supplier_canonical_name": supplier.get("canonical_name") if supplier else None,
        "city_id": contract.get("city_id"),
        "city_name": city.get("name") if city else None,
        "state": city.get("state") if city else None,
        "modality": contract.get("modality"),
        "act_type": contract.get("act_type"),
        "object_summary": contract.get("object_text"),
        "contract_value": contract.get("contract_value"),
        "total_paid": round(total_paid, 2),
        "signed_at": contract.get("start_date") or contract.get("publication_date"),
        "start_date": contract.get("start_date"),
        "end_date": contract.get("end_date"),
        "publication_date": contract.get("publication_date"),
        "bid_fact_id": contract.get("bid_fact_id"),
        "bid_link_status": contract.get("bid_link_status"),
        "bid_link_basis": contract.get("bid_link_basis"),
        "bid_link_score": contract.get("bid_link_score"),
        "bid_link_reason": contract.get("bid_link_reason"),
        "provenance": provenance or [],
        "fragmentation_signal": fragmentation_signal,
    }


def _status_flags(contract: dict, total_paid: float) -> list[str]:
    flags: list[str] = []
    contract_value = _safe_number(contract.get("contract_value"))
    if contract_value > 0 and total_paid > contract_value * 1.01:
        flags.append("pagamento_acima_do_contratado")
    if not contract.get("bid_fact_id") or contract.get("bid_link_status") == "unlinked":
        flags.append("sem_licitacao_vinculada")
    return flags


def _fragmentation_signal(contract: dict) -> dict | None:
    object_signature = str(contract.get("object_signature") or "").strip()
    city_id = contract.get("city_id")
    supplier_entity_id = contract.get("supplier_entity_id")
    contract_id = contract.get("id")
    if not object_signature or not city_id or not supplier_entity_id:
        return None

    response = execute_with_retry(
        lambda: supabase.table("contracts_facts")
        .select("id,contract_number_raw,contract_value", count="exact")
        .eq("city_id", city_id)
        .eq("supplier_entity_id", supplier_entity_id)
        .eq("object_signature", object_signature)
        .limit(20),
        "contracts_facts",
    )
    rows = [row for row in (response.data or []) if str(row.get("id") or "") != str(contract_id or "")]
    if not rows:
        return None

    return {
        "related_contracts_count": len(rows),
        "total_related_value": round(sum(_safe_number(row.get("contract_value")) for row in rows), 2),
        "sample_numbers": [
            str(row.get("contract_number_raw") or "").strip()
            for row in rows
            if str(row.get("contract_number_raw") or "").strip()
        ][:3],
    }


def _fetch_contract(contract_id: str) -> dict:
    try:
        response = execute_with_retry(
            lambda: supabase.table("contracts_facts").select(_CONTRACT_COLUMNS).eq("id", contract_id).limit(1),
            "contracts_facts",
        )
    except UpstreamQueryError as exc:
        raise_upstream_http_error("Falha temporaria ao carregar o contrato. Tente novamente.")
        raise exc  # pragma: no cover
    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Contrato nao encontrado.")
    return rows[0]


@router.get("/contracts")
def list_contracts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    upload_id: str | None = None,
    city_id: str | None = None,
    modality: str | None = None,
    bid_link_status: str | None = None,
    supplier_entity_id: str | None = None,
):
    try:
        offset = (page - 1) * page_size
        end = offset + page_size - 1

        def _build():
            query = supabase.table("contracts_facts").select(_CONTRACT_COLUMNS, count="exact")
            if upload_id:
                query = query.eq("source_upload_id", upload_id)
            if city_id:
                query = query.eq("city_id", city_id)
            if modality:
                query = query.eq("modality", modality)
            if bid_link_status:
                query = query.eq("bid_link_status", bid_link_status)
            if supplier_entity_id:
                query = query.eq("supplier_entity_id", supplier_entity_id)
            return query.order("start_date", desc=True).range(offset, end)

        response = execute_with_retry(_build, "contracts_facts")
        rows = response.data or []
        total = getattr(response, "count", None) or len(rows)
        suppliers = _entities_map([str(row.get("supplier_entity_id")) for row in rows if row.get("supplier_entity_id")])
        cities = _city_map_for_rows(rows)
        payments_map = _payments_by_contract([str(row.get("id")) for row in rows if row.get("id")])

        items = []
        for row in rows:
            payments = payments_map.get(str(row.get("id")), [])
            total_paid = round(sum(_safe_number(payment.get("payment_value")) for payment in payments), 2)
            items.append(_format_contract_row(row, suppliers, cities, total_paid=total_paid))

        return {"status": "ok", "page": page, "page_size": page_size, "total": total, "items": items}
    except UpstreamQueryError as exc:
        raise_upstream_http_error("Falha temporaria ao carregar contratos. Tente novamente.")
        raise exc  # pragma: no cover
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        if is_missing_table_error(exc):
            raise_missing_schema_http_error()
        raise


@router.get("/contracts/{contract_id}")
def get_contract(contract_id: str):
    try:
        contract = _fetch_contract(contract_id)
        suppliers = _entities_map([str(contract.get("supplier_entity_id"))] if contract.get("supplier_entity_id") else [])
        cities = _city_map_for_rows([contract])
        provenance_rows = _fact_records_map([contract_id]).get(contract_id, [])
        provenance = _provenance_rows(provenance_rows)
        payments = _payments_by_contract([contract_id]).get(contract_id, [])
        total_paid = round(sum(_safe_number(payment.get("payment_value")) for payment in payments), 2)
        fragmentation_signal = _fragmentation_signal(contract)

        return {
            "status": "ok",
            "contract": _format_contract_row(
                contract,
                suppliers,
                cities,
                total_paid=total_paid,
                provenance=provenance,
                fragmentation_signal=fragmentation_signal,
            ),
        }
    except UpstreamQueryError as exc:
        raise_upstream_http_error("Falha temporaria ao carregar o contrato. Tente novamente.")
        raise exc  # pragma: no cover
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        if is_missing_table_error(exc):
            raise_missing_schema_http_error()
        raise


@router.get("/contracts/{contract_id}/chain")
def get_contract_chain(contract_id: str):
    try:
        contract = _fetch_contract(contract_id)
        suppliers = _entities_map([str(contract.get("supplier_entity_id"))] if contract.get("supplier_entity_id") else [])
        cities = _city_map_for_rows([contract])
        provenance_rows = _fact_records_map([contract_id]).get(contract_id, [])
        provenance = _provenance_rows(provenance_rows)
        fragmentation_signal = _fragmentation_signal(contract)

        bid = None
        bid_fact_id = contract.get("bid_fact_id")
        if bid_fact_id:
            bid_response = execute_with_retry(
                lambda: supabase.table("bids_facts").select(_BID_COLUMNS).eq("id", bid_fact_id).limit(1),
                "bids_facts",
            )
            bid_rows = bid_response.data or []
            bid = bid_rows[0] if bid_rows else None

        payments = _payments_by_contract([contract_id]).get(contract_id, [])
        payment_suppliers = _entities_map(
            [str(payment.get("supplier_entity_id")) for payment in payments if payment.get("supplier_entity_id")]
        )
        payments_rows = [_format_payment_row(payment, payment_suppliers) for payment in payments]
        total_paid = round(sum(_safe_number(payment.get("payment_value")) for payment in payments), 2)

        contract_payload = _format_contract_row(
            contract,
            suppliers,
            cities,
            total_paid=total_paid,
            provenance=provenance,
            fragmentation_signal=fragmentation_signal,
        )
        summary = {
            "contract_value": contract.get("contract_value"),
            "total_paid": total_paid,
            "gap": round(_safe_number(contract.get("contract_value")) - total_paid, 2),
            "payments_count": len(payments_rows),
            "bid_link_status": contract.get("bid_link_status"),
            "unique_status_flags": _status_flags(contract, total_paid),
            "fragmentation_signal": fragmentation_signal,
        }

        return {
            "status": "ok",
            "contract": contract_payload,
            "bid": _format_bid_row(bid),
            "payments": payments_rows,
            "summary": summary,
        }
    except UpstreamQueryError as exc:
        raise_upstream_http_error("Falha temporaria ao carregar a cadeia do contrato. Tente novamente.")
        raise exc  # pragma: no cover
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        if is_missing_table_error(exc):
            raise_missing_schema_http_error()
        raise
