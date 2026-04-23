"""Backfill Etapa D (Fase 2): materializa bids_facts / contracts_facts / payments_facts.

Idempotente. Nao usa IA. Nao toca ETL.

Uso:
    python -m backend.scripts.backfill_spend_facts_phase2d --dry-run
    python -m backend.scripts.backfill_spend_facts_phase2d --category contracts
    python -m backend.scripts.backfill_spend_facts_phase2d --upload-id <uuid>
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

# pylint: disable=wrong-import-position
try:
    from app.utils.supabase_resilience import (
        UpstreamQueryError,
        execute_with_retry,
        select_in_chunks,
        supabase,
    )
    from app.utils.spend_facts import (
        build_bid_signature,
        build_contract_signature,
        build_object_signature,
        build_payment_signature,
        normalize_identifier,
        normalize_object,
        parse_factual_date,
    )
except ModuleNotFoundError:  # pragma: no cover
    from backend.app.utils.supabase_resilience import (
        UpstreamQueryError,
        execute_with_retry,
        select_in_chunks,
        supabase,
    )
    from backend.app.utils.spend_facts import (
        build_bid_signature,
        build_contract_signature,
        build_object_signature,
        build_payment_signature,
        normalize_identifier,
        normalize_object,
        parse_factual_date,
    )


CATEGORY_BIDS = "bids"
CATEGORY_CONTRACTS = "contracts"
CATEGORY_EXPENSES = "expenses"
RELEVANT_CATEGORIES = (CATEGORY_BIDS, CATEGORY_CONTRACTS, CATEGORY_EXPENSES)

PAGE_SIZE = 500
REQUIRED_TABLES = (
    "bids_facts",
    "contracts_facts",
    "payments_facts",
    "bid_fact_records",
    "contract_fact_records",
    "payment_fact_records",
)


def _log(message: str) -> None:
    print(f"[backfill] {message}", flush=True)


def _raw(record: dict) -> dict:
    raw_json = record.get("raw_json")
    if isinstance(raw_json, dict):
        return raw_json
    if isinstance(raw_json, str):
        try:
            parsed = json.loads(raw_json)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:  # noqa: BLE001
            return {}
    return {}


def _raw_value(record: dict, keys: list[str]) -> str:
    data = _raw(record)
    for key in keys:
        value = data.get(key)
        if str(value or "").strip():
            return str(value).strip()
    return ""


def _safe_amount(value: Any) -> float | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace("R$", "").strip()
    text = text.replace(".", "").replace(",", ".")
    try:
        return float(text)
    except Exception:  # noqa: BLE001
        return None


def _fetch_records(category: str, upload_id: str | None, limit: int | None) -> list[dict]:
    rows: list[dict] = []
    page = 0
    while True:
        start = page * PAGE_SIZE
        end = start + PAGE_SIZE - 1

        def _build():
            query = supabase.table("standardized_records").select(
                "id,upload_id,category,report_type,report_label,documento,"
                "nome_credor_servidor,valor_bruto,data_referencia,raw_json,created_at"
            ).eq("category", category)
            if upload_id:
                query = query.eq("upload_id", upload_id)
            return query.order("id").range(start, end)

        try:
            resp = execute_with_retry(_build, "standardized_records")
        except UpstreamQueryError as exc:
            _log(f"Erro ao buscar registros: {exc}")
            break

        data = resp.data or []
        if not data:
            break
        rows.extend(data)
        if limit and len(rows) >= limit:
            rows = rows[:limit]
            break
        if len(data) < PAGE_SIZE:
            break
        page += 1
    return rows


def _fetch_uploads_map(upload_ids: list[str]) -> dict[str, dict]:
    if not upload_ids:
        return {}
    rows = select_in_chunks(
        "uploads",
        upload_ids,
        select="id,city_id,file_name,category,report_type,report_label,created_at",
    )
    return {str(r.get("id")): r for r in rows or []}


def _ensure_required_tables() -> bool:
    missing: list[str] = []
    for table in REQUIRED_TABLES:
        try:
            supabase.table(table).select("id").limit(1).execute()
        except Exception as exc:  # noqa: BLE001
            message = str(exc)
            if "Could not find the table" in message or "schema cache" in message:
                missing.append(table)
            else:
                _log(f"Falha ao verificar tabela {table}: {message}")
                return False
    if missing:
        _log(
            "As tabelas da Etapa D ainda nao existem no banco remoto. "
            "Aplique a migration `20260429_01_phase2d_spend_facts.sql` antes de rodar o backfill."
        )
        _log(f"Tabelas ausentes: {', '.join(missing)}")
        return False
    return True


def _fetch_entity_links(record_ids: list[str]) -> dict[str, list[dict]]:
    if not record_ids:
        return {}
    rows = select_in_chunks(
        "record_entity_links",
        record_ids,
        id_column="standardized_record_id",
        select="standardized_record_id,entity_id,role_in_record",
    )
    grouped: dict[str, list[dict]] = {}
    for row in rows or []:
        rid = str(row.get("standardized_record_id") or "")
        if rid:
            grouped.setdefault(rid, []).append(row)
    return grouped


def _pick_supplier(links: list[dict]) -> str | None:
    for row in links or []:
        role = (row.get("role_in_record") or "").lower()
        if role in ("supplier", "creditor", "contracted_party", "beneficiary"):
            entity_id = row.get("entity_id")
            if entity_id:
                return str(entity_id)
    return None


def _pick_winner(links: list[dict]) -> str | None:
    for row in links or []:
        role = (row.get("role_in_record") or "").lower()
        if role in ("supplier", "contracted_party", "creditor"):
            entity_id = row.get("entity_id")
            if entity_id:
                return str(entity_id)
    return None


def _find_existing_fact(table: str, city_id: Any, signature_hash: str) -> dict | None:
    def _build():
        query = supabase.table(table).select("*").eq("signature_hash", signature_hash)
        if city_id:
            query = query.eq("city_id", city_id)
        else:
            query = query.is_("city_id", "null")
        return query.limit(1)

    try:
        resp = execute_with_retry(_build, table)
    except UpstreamQueryError:
        return None
    rows = resp.data or []
    return rows[0] if rows else None


def _merge_updates(existing: dict, new: dict, fields: list[str]) -> dict:
    """Retorna dict com campos que enriquecem (de vazio para preenchido)."""
    updates: dict[str, Any] = {}
    for field in fields:
        current = existing.get(field)
        incoming = new.get(field)
        is_current_empty = current in (None, "", 0, 0.0)
        if incoming not in (None, "", 0, 0.0) and is_current_empty:
            updates[field] = incoming
    return updates


def _insert_fact_record(
    table: str,
    fk_column: str,
    fact_id: str,
    record_id: str,
    upload_id: str | None,
    link_role: str,
    dry_run: bool,
    dedupe_reason: str | None = None,
) -> None:
    payload = {
        fk_column: fact_id,
        "standardized_record_id": record_id,
        "source_upload_id": upload_id,
        "link_role": link_role,
        "dedupe_reason": dedupe_reason,
    }
    if dry_run:
        _log(f"DRY {table} + {link_role} record={record_id}")
        return
    try:
        execute_with_retry(
            lambda: supabase.table(table).upsert(payload, on_conflict=f"{fk_column},standardized_record_id"),
            table,
        )
    except UpstreamQueryError as exc:
        _log(f"Falha ao inserir em {table}: {exc}")


def _process_bid(record: dict, upload: dict | None, links: list[dict], dry_run: bool, counters: dict) -> None:
    city_id = (upload or {}).get("city_id")
    upload_id = (upload or {}).get("id") or record.get("upload_id")

    bid_number_raw = _raw_value(record, ["numero_licitacao", "numero_edital"])
    process_number_raw = _raw_value(record, ["numero_processo"])
    modality = _raw_value(record, ["modalidade"])
    act_type = _raw_value(record, ["tipo_ato"])
    object_text = _raw_value(record, ["objeto", "descricao_objeto"])
    estimated_value = _safe_amount(
        _raw_value(record, ["valor_estimado", "valor_referencia"]) or record.get("valor_bruto")
    )
    awarded_value = _safe_amount(_raw_value(record, ["valor_adjudicado", "valor_homologado"]))
    event_date = parse_factual_date(
        _raw_value(record, ["data_abertura", "data_sessao", "data_homologacao"])
        or record.get("data_referencia")
    )
    publication_date = parse_factual_date(_raw_value(record, ["data_publicacao"]))

    bid_norm = normalize_identifier(bid_number_raw)
    process_norm = normalize_identifier(process_number_raw)

    signature_hash = build_bid_signature(city_id, bid_norm, process_norm, modality, event_date)
    winner_id = _pick_winner(links)

    payload = {
        "city_id": city_id,
        "source_upload_id": upload_id,
        "primary_record_id": record.get("id"),
        "winner_entity_id": winner_id,
        "bid_number_raw": bid_number_raw or None,
        "bid_number_normalized": bid_norm or None,
        "process_number_raw": process_number_raw or None,
        "process_number_normalized": process_norm or None,
        "modality": modality or None,
        "act_type": act_type or None,
        "object_text": object_text or None,
        "object_normalized": normalize_object(object_text) or None,
        "object_signature": build_object_signature(object_text) or None,
        "estimated_value": estimated_value,
        "awarded_value": awarded_value,
        "event_date": event_date.isoformat() if event_date else None,
        "publication_date": publication_date.isoformat() if publication_date else None,
        "status": _raw_value(record, ["status", "situacao"]) or None,
        "signature_hash": signature_hash,
    }

    existing = _find_existing_fact("bids_facts", city_id, signature_hash)

    counters["read"] += 1
    if existing:
        updates = _merge_updates(
            existing,
            payload,
            [
                "winner_entity_id",
                "bid_number_raw",
                "bid_number_normalized",
                "process_number_raw",
                "process_number_normalized",
                "modality",
                "act_type",
                "object_text",
                "object_normalized",
                "object_signature",
                "estimated_value",
                "awarded_value",
                "event_date",
                "publication_date",
                "status",
            ],
        )
        fact_id = existing.get("id")
        role = "merged_duplicate" if existing.get("primary_record_id") != record.get("id") else "primary"
        dedupe_reason = "Mesma assinatura factual da licitacao." if role == "merged_duplicate" else None
        if updates and not dry_run:
            try:
                execute_with_retry(
                    lambda: supabase.table("bids_facts").update(updates).eq("id", fact_id),
                    "bids_facts",
                )
                counters["updated"] += 1
            except UpstreamQueryError as exc:
                _log(f"Falha ao atualizar bids_facts {fact_id}: {exc}")
        elif updates:
            counters["updated"] += 1
        counters["merged"] += 1 if role == "merged_duplicate" else 0
        _insert_fact_record(
            "bid_fact_records", "bid_fact_id", str(fact_id),
            str(record.get("id")), upload_id, role, dry_run, dedupe_reason,
        )
    else:
        if dry_run:
            _log(f"DRY create bids_facts sig={signature_hash[:12]}")
            counters["created"] += 1
            return
        try:
            resp = execute_with_retry(
                lambda: supabase.table("bids_facts").insert(payload),
                "bids_facts",
            )
            data = resp.data or []
            if data:
                fact_id = data[0].get("id")
                counters["created"] += 1
                _insert_fact_record(
                    "bid_fact_records", "bid_fact_id", str(fact_id),
                    str(record.get("id")), upload_id, "primary", dry_run,
                )
        except UpstreamQueryError as exc:
            _log(f"Falha ao criar bids_facts: {exc}")


def _process_contract(record: dict, upload: dict | None, links: list[dict], dry_run: bool, counters: dict) -> None:
    city_id = (upload or {}).get("city_id")
    upload_id = (upload or {}).get("id") or record.get("upload_id")

    contract_number_raw = _raw_value(record, ["numero_contrato"])
    bid_number_raw = _raw_value(record, ["numero_licitacao", "numero_edital"])
    process_number_raw = _raw_value(record, ["numero_processo"])
    modality = _raw_value(record, ["modalidade"])
    act_type = _raw_value(record, ["tipo_ato"])
    object_text = _raw_value(record, ["objeto", "descricao_objeto"])
    contract_value = _safe_amount(
        _raw_value(record, ["valor_contratado", "valor_contrato", "valor"]) or record.get("valor_bruto")
    )
    start_date = parse_factual_date(
        _raw_value(record, ["data_assinatura", "data_inicio", "data_vigencia_inicio"])
        or record.get("data_referencia")
    )
    end_date = parse_factual_date(_raw_value(record, ["data_fim", "data_vigencia_fim", "data_termino"]))
    publication_date = parse_factual_date(_raw_value(record, ["data_publicacao"]))

    supplier_id = _pick_supplier(links)
    contract_norm = normalize_identifier(contract_number_raw)
    bid_norm = normalize_identifier(bid_number_raw)
    process_norm = normalize_identifier(process_number_raw)
    signature_hash = build_contract_signature(city_id, contract_norm, supplier_id, start_date, contract_value)

    payload = {
        "city_id": city_id,
        "source_upload_id": upload_id,
        "primary_record_id": record.get("id"),
        "supplier_entity_id": supplier_id,
        "contract_number_raw": contract_number_raw or None,
        "contract_number_normalized": contract_norm or None,
        "bid_number_raw": bid_number_raw or None,
        "bid_number_normalized": bid_norm or None,
        "process_number_raw": process_number_raw or None,
        "process_number_normalized": process_norm or None,
        "modality": modality or None,
        "act_type": act_type or None,
        "object_text": object_text or None,
        "object_normalized": normalize_object(object_text) or None,
        "object_signature": build_object_signature(object_text) or None,
        "contract_value": contract_value,
        "start_date": start_date.isoformat() if start_date else None,
        "end_date": end_date.isoformat() if end_date else None,
        "publication_date": publication_date.isoformat() if publication_date else None,
        "signature_hash": signature_hash,
    }

    existing = _find_existing_fact("contracts_facts", city_id, signature_hash)
    counters["read"] += 1

    if existing:
        updates = _merge_updates(
            existing,
            payload,
            [
                "supplier_entity_id",
                "contract_number_raw",
                "contract_number_normalized",
                "bid_number_raw",
                "bid_number_normalized",
                "process_number_raw",
                "process_number_normalized",
                "modality",
                "act_type",
                "object_text",
                "object_normalized",
                "object_signature",
                "contract_value",
                "start_date",
                "end_date",
                "publication_date",
            ],
        )
        fact_id = existing.get("id")
        role = "merged_duplicate" if existing.get("primary_record_id") != record.get("id") else "primary"
        dedupe_reason = "Mesma assinatura factual do contrato." if role == "merged_duplicate" else None
        if updates and not dry_run:
            try:
                execute_with_retry(
                    lambda: supabase.table("contracts_facts").update(updates).eq("id", fact_id),
                    "contracts_facts",
                )
                counters["updated"] += 1
            except UpstreamQueryError as exc:
                _log(f"Falha ao atualizar contracts_facts {fact_id}: {exc}")
        elif updates:
            counters["updated"] += 1
        if role == "merged_duplicate":
            counters["merged"] += 1
        _insert_fact_record(
            "contract_fact_records", "contract_fact_id", str(fact_id),
            str(record.get("id")), upload_id, role, dry_run, dedupe_reason,
        )
    else:
        if dry_run:
            _log(f"DRY create contracts_facts sig={signature_hash[:12]}")
            counters["created"] += 1
            return
        try:
            resp = execute_with_retry(
                lambda: supabase.table("contracts_facts").insert(payload),
                "contracts_facts",
            )
            data = resp.data or []
            if data:
                fact_id = data[0].get("id")
                counters["created"] += 1
                _insert_fact_record(
                    "contract_fact_records", "contract_fact_id", str(fact_id),
                    str(record.get("id")), upload_id, "primary", dry_run,
                )
        except UpstreamQueryError as exc:
            _log(f"Falha ao criar contracts_facts: {exc}")


def _process_expense(record: dict, upload: dict | None, links: list[dict], dry_run: bool, counters: dict) -> None:
    city_id = (upload or {}).get("city_id")
    upload_id = (upload or {}).get("id") or record.get("upload_id")

    payment_number_raw = _raw_value(record, ["numero_empenho", "numero_pagamento", "numero_liquidacao"])
    contract_number_raw = _raw_value(record, ["numero_contrato"])
    bid_number_raw = _raw_value(record, ["numero_licitacao", "numero_edital"])
    process_number_raw = _raw_value(record, ["numero_processo"])
    object_text = _raw_value(record, ["objeto", "descricao_objeto", "historico"])
    payment_value = _safe_amount(_raw_value(record, ["valor_pago", "valor"]) or record.get("valor_bruto"))
    payment_date = parse_factual_date(
        _raw_value(record, ["data_pagamento", "data_liquidacao", "data_empenho"])
        or record.get("data_referencia")
    )
    expense_stage = _raw_value(record, ["estagio", "fase"])

    supplier_id = _pick_supplier(links)
    payment_norm = normalize_identifier(payment_number_raw)
    contract_norm = normalize_identifier(contract_number_raw)
    bid_norm = normalize_identifier(bid_number_raw)
    process_norm = normalize_identifier(process_number_raw)

    signature_hash = build_payment_signature(
        city_id, payment_norm, contract_norm, supplier_id, payment_date, payment_value
    )

    payload = {
        "city_id": city_id,
        "source_upload_id": upload_id,
        "primary_record_id": record.get("id"),
        "supplier_entity_id": supplier_id,
        "payment_number_raw": payment_number_raw or None,
        "payment_number_normalized": payment_norm or None,
        "contract_number_raw": contract_number_raw or None,
        "contract_number_normalized": contract_norm or None,
        "bid_number_raw": bid_number_raw or None,
        "bid_number_normalized": bid_norm or None,
        "process_number_raw": process_number_raw or None,
        "process_number_normalized": process_norm or None,
        "expense_stage": expense_stage or None,
        "object_text": object_text or None,
        "object_normalized": normalize_object(object_text) or None,
        "object_signature": build_object_signature(object_text) or None,
        "payment_value": payment_value,
        "payment_date": payment_date.isoformat() if payment_date else None,
        "signature_hash": signature_hash,
    }

    existing = _find_existing_fact("payments_facts", city_id, signature_hash)
    counters["read"] += 1

    if existing:
        updates = _merge_updates(
            existing,
            payload,
            [
                "supplier_entity_id",
                "payment_number_raw",
                "payment_number_normalized",
                "contract_number_raw",
                "contract_number_normalized",
                "bid_number_raw",
                "bid_number_normalized",
                "process_number_raw",
                "process_number_normalized",
                "expense_stage",
                "object_text",
                "object_normalized",
                "object_signature",
                "payment_value",
                "payment_date",
            ],
        )
        fact_id = existing.get("id")
        role = "merged_duplicate" if existing.get("primary_record_id") != record.get("id") else "primary"
        dedupe_reason = "Mesma assinatura factual do pagamento." if role == "merged_duplicate" else None
        if updates and not dry_run:
            try:
                execute_with_retry(
                    lambda: supabase.table("payments_facts").update(updates).eq("id", fact_id),
                    "payments_facts",
                )
                counters["updated"] += 1
            except UpstreamQueryError as exc:
                _log(f"Falha ao atualizar payments_facts {fact_id}: {exc}")
        elif updates:
            counters["updated"] += 1
        if role == "merged_duplicate":
            counters["merged"] += 1
        _insert_fact_record(
            "payment_fact_records", "payment_fact_id", str(fact_id),
            str(record.get("id")), upload_id, role, dry_run, dedupe_reason,
        )
    else:
        if dry_run:
            _log(f"DRY create payments_facts sig={signature_hash[:12]}")
            counters["created"] += 1
            return
        try:
            resp = execute_with_retry(
                lambda: supabase.table("payments_facts").insert(payload),
                "payments_facts",
            )
            data = resp.data or []
            if data:
                fact_id = data[0].get("id")
                counters["created"] += 1
                _insert_fact_record(
                    "payment_fact_records", "payment_fact_id", str(fact_id),
                    str(record.get("id")), upload_id, "primary", dry_run,
                )
        except UpstreamQueryError as exc:
            _log(f"Falha ao criar payments_facts: {exc}")


def _run_category(category: str, upload_id: str | None, limit: int | None, dry_run: bool) -> dict:
    counters = {"read": 0, "created": 0, "updated": 0, "merged": 0}
    _log(f"iniciando categoria={category} upload_id={upload_id or '-'} limit={limit or '-'}")
    records = _fetch_records(category, upload_id, limit)
    _log(f"registros lidos: {len(records)}")
    if not records:
        return counters

    upload_ids = list({str(r.get("upload_id")) for r in records if r.get("upload_id")})
    uploads_map = _fetch_uploads_map(upload_ids)

    record_ids = [str(r.get("id")) for r in records if r.get("id")]
    links_map = _fetch_entity_links(record_ids)

    for record in records:
        upload = uploads_map.get(str(record.get("upload_id") or ""))
        links = links_map.get(str(record.get("id") or ""), [])
        try:
            if category == CATEGORY_BIDS:
                _process_bid(record, upload, links, dry_run, counters)
            elif category == CATEGORY_CONTRACTS:
                _process_contract(record, upload, links, dry_run, counters)
            elif category == CATEGORY_EXPENSES:
                _process_expense(record, upload, links, dry_run, counters)
        except Exception as exc:  # noqa: BLE001
            _log(f"Erro em registro {record.get('id')}: {exc}")

    _log(
        f"categoria={category} lidos={counters['read']} criados={counters['created']} "
        f"atualizados={counters['updated']} merged={counters['merged']}"
    )
    return counters


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Backfill Etapa D (Fase 2)")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--upload-id", type=str, default=None)
    parser.add_argument("--category", type=str, choices=list(RELEVANT_CATEGORIES), default=None)
    args = parser.parse_args(argv)

    try:
        from dotenv import load_dotenv  # local import para nao exigir em tests
        load_dotenv()
    except Exception:  # noqa: BLE001
        pass

    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_KEY"):
        _log("SUPABASE_URL/SUPABASE_KEY ausentes no ambiente.")
        return 2
    if not _ensure_required_tables():
        return 3

    categories = [args.category] if args.category else list(RELEVANT_CATEGORIES)
    grand: dict[str, int] = {"read": 0, "created": 0, "updated": 0, "merged": 0}
    for category in categories:
        counters = _run_category(category, args.upload_id, args.limit, args.dry_run)
        for key, value in counters.items():
            grand[key] = grand.get(key, 0) + value

    _log(
        f"FINAL lidos={grand['read']} criados={grand['created']} "
        f"atualizados={grand['updated']} merged={grand['merged']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
