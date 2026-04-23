"""Vincula a cadeia contrato -> licitacao e pagamento -> contrato/licitacao (Etapa D).

Idempotente. Nao rebaixa vinculos existentes mais fortes.

Uso:
    python -m backend.scripts.link_spend_chain_phase2d --dry-run
    python -m backend.scripts.link_spend_chain_phase2d --city-id <uuid>
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from typing import Any

try:
    from app.utils.supabase_resilience import (
        UpstreamQueryError,
        execute_with_retry,
        supabase,
    )
    from app.utils.spend_facts import (
        classify_contract_bid_link,
        classify_payment_bid_link,
        classify_payment_contract_link,
        is_stronger_link_status,
    )
except ModuleNotFoundError:  # pragma: no cover
    from backend.app.utils.supabase_resilience import (
        UpstreamQueryError,
        execute_with_retry,
        supabase,
    )
    from backend.app.utils.spend_facts import (
        classify_contract_bid_link,
        classify_payment_bid_link,
        classify_payment_contract_link,
        is_stronger_link_status,
    )

PAGE_SIZE = 500
REQUIRED_TABLES = ("bids_facts", "contracts_facts", "payments_facts")


def _log(msg: str) -> None:
    print(f"[linker] {msg}", flush=True)


def _load_all(table: str, columns: str, city_id: str | None, upload_id: str | None) -> list[dict]:
    rows: list[dict] = []
    page = 0
    while True:
        start = page * PAGE_SIZE
        end = start + PAGE_SIZE - 1

        def _build():
            query = supabase.table(table).select(columns)
            if city_id:
                query = query.eq("city_id", city_id)
            if upload_id:
                query = query.eq("source_upload_id", upload_id)
            return query.order("id").range(start, end)

        try:
            resp = execute_with_retry(_build, table)
        except UpstreamQueryError as exc:
            _log(f"Erro lendo {table}: {exc}")
            break
        data = resp.data or []
        if not data:
            break
        rows.extend(data)
        if len(data) < PAGE_SIZE:
            break
        page += 1
    return rows


def _parse_date(value: Any):
    if not value:
        return None
    from datetime import date, datetime

    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    text = str(value)[:10]
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except Exception:  # noqa: BLE001
        return None


def _hydrate_dates(row: dict, fields: list[str]) -> dict:
    hydrated = dict(row)
    for field in fields:
        hydrated[field] = _parse_date(row.get(field))
    return hydrated


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
            "As tabelas factuais da Etapa D ainda nao existem no banco remoto. "
            "Aplique a migration `20260429_01_phase2d_spend_facts.sql` antes de ligar a cadeia."
        )
        _log(f"Tabelas ausentes: {', '.join(missing)}")
        return False
    return True


def _link_contracts_to_bids(contracts: list[dict], bids: list[dict], dry_run: bool, counters: dict) -> None:
    bids_by_city: dict[Any, list[dict]] = defaultdict(list)
    for bid in bids:
        bids_by_city[bid.get("city_id")].append(bid)

    for contract in contracts:
        city = contract.get("city_id")
        candidates = bids_by_city.get(city, [])
        if not candidates:
            counters["unlinked"] += 1
            continue

        best: dict | None = None
        best_bid: dict | None = None
        runner_up_score = -1.0
        for bid in candidates:
            result = classify_contract_bid_link(contract, bid)
            status = result["status"]
            if status == "unlinked":
                continue
            if best is None or result["score"] > best["score"]:
                if best is not None:
                    runner_up_score = best["score"]
                best = result
                best_bid = bid
            elif result["score"] > runner_up_score:
                runner_up_score = result["score"]

        if not best or not best_bid:
            counters["unlinked"] += 1
            continue

        # Ambiguidade: varios probables com mesmo score
        if best["status"] == "linked_probable" and runner_up_score == best["score"]:
            counters["ambiguous"] += 1
            if is_stronger_link_status("unlinked", contract.get("bid_link_status") or "unlinked"):
                pass  # nao rebaixa
            continue

        current = contract.get("bid_link_status") or "unlinked"
        if not is_stronger_link_status(best["status"], current) and current == best["status"]:
            # ja no mesmo nivel; mas atualiza bid_fact_id se estava vazio
            if contract.get("bid_fact_id"):
                counters[best["status"]] = counters.get(best["status"], 0) + 1
                continue

        if not is_stronger_link_status(best["status"], current) and contract.get("bid_fact_id"):
            counters[best["status"]] = counters.get(best["status"], 0) + 1
            continue

        updates = {
            "bid_fact_id": best_bid.get("id"),
            "bid_link_status": best["status"],
            "bid_link_basis": best["basis"],
            "bid_link_score": best["score"],
            "bid_link_reason": best["reason"],
        }
        counters[best["status"]] = counters.get(best["status"], 0) + 1
        if dry_run:
            _log(f"DRY contract {contract.get('id')} -> bid {best_bid.get('id')} ({best['status']})")
            continue
        try:
            execute_with_retry(
                lambda: supabase.table("contracts_facts").update(updates).eq("id", contract.get("id")),
                "contracts_facts",
            )
        except UpstreamQueryError as exc:
            _log(f"Falha update contract {contract.get('id')}: {exc}")


def _link_payments(payments: list[dict], contracts: list[dict], bids: list[dict], dry_run: bool, counters: dict) -> None:
    contracts_by_city: dict[Any, list[dict]] = defaultdict(list)
    for contract in contracts:
        contracts_by_city[contract.get("city_id")].append(contract)
    bids_by_id = {str(b.get("id")): b for b in bids}
    bids_by_city: dict[Any, list[dict]] = defaultdict(list)
    for bid in bids:
        bids_by_city[bid.get("city_id")].append(bid)

    for payment in payments:
        city = payment.get("city_id")
        candidates = contracts_by_city.get(city, [])

        best: dict | None = None
        best_contract: dict | None = None
        runner_up_score = -1.0
        for contract in candidates:
            result = classify_payment_contract_link(payment, contract)
            if result["status"] == "unlinked":
                continue
            if best is None or result["score"] > best["score"]:
                if best is not None:
                    runner_up_score = best["score"]
                best = result
                best_contract = contract
            elif result["score"] > runner_up_score:
                runner_up_score = result["score"]

        contract_updates: dict[str, Any] = {}
        bid_updates: dict[str, Any] = {}

        if best and best_contract and not (
            best["status"] == "linked_probable" and runner_up_score == best["score"]
        ):
            current = payment.get("contract_link_status") or "unlinked"
            if is_stronger_link_status(best["status"], current) or not payment.get("contract_fact_id"):
                contract_updates = {
                    "contract_fact_id": best_contract.get("id"),
                    "contract_link_status": best["status"],
                    "contract_link_basis": best["basis"],
                    "contract_link_score": best["score"],
                    "contract_link_reason": best["reason"],
                }
            counters[f"contract_{best['status']}"] = counters.get(f"contract_{best['status']}", 0) + 1
        else:
            if best and best["status"] == "linked_probable" and runner_up_score == best["score"]:
                counters["contract_ambiguous"] += 1
            else:
                counters["contract_unlinked"] += 1

        # Propagacao para bid via contrato
        final_contract = best_contract if contract_updates else None
        if final_contract and final_contract.get("bid_fact_id"):
            bid_id = final_contract.get("bid_fact_id")
            bid_row = bids_by_id.get(str(bid_id))
            if bid_row:
                # Forca status rebaixado para probable (alcance indireto)
                indirect_status = "linked_probable"
                current_bid_status = payment.get("bid_link_status") or "unlinked"
                if is_stronger_link_status(indirect_status, current_bid_status) or not payment.get("bid_fact_id"):
                    bid_updates = {
                        "bid_fact_id": bid_id,
                        "bid_link_status": indirect_status,
                        "bid_link_basis": "via_contract",
                        "bid_link_score": 0.6,
                        "bid_link_reason": "Vinculo indireto via contrato.",
                    }

        # Link direto por numero de licitacao no pagamento
        direct_bid_candidates = bids_by_city.get(city, [])
        direct_best: dict | None = None
        direct_best_bid: dict | None = None
        direct_runner = -1.0
        for bid in direct_bid_candidates:
            result = classify_payment_bid_link(payment, bid)
            if result["status"] == "unlinked":
                continue
            if direct_best is None or result["score"] > direct_best["score"]:
                if direct_best is not None:
                    direct_runner = direct_best["score"]
                direct_best = result
                direct_best_bid = bid

        if direct_best and direct_best_bid and not (
            direct_best["status"] == "linked_probable" and direct_runner == direct_best["score"]
        ):
            current = bid_updates.get("bid_link_status") or payment.get("bid_link_status") or "unlinked"
            if is_stronger_link_status(direct_best["status"], current):
                bid_updates = {
                    "bid_fact_id": direct_best_bid.get("id"),
                    "bid_link_status": direct_best["status"],
                    "bid_link_basis": direct_best["basis"],
                    "bid_link_score": direct_best["score"],
                    "bid_link_reason": direct_best["reason"],
                }

        full_updates = {**contract_updates, **bid_updates}
        if not full_updates:
            continue
        if dry_run:
            _log(f"DRY payment {payment.get('id')} -> {full_updates}")
            continue
        try:
            payment_id = payment.get("id")
            execute_with_retry(
                lambda: supabase.table("payments_facts").update(full_updates).eq("id", payment_id),
                "payments_facts",
            )
        except UpstreamQueryError as exc:
            _log(f"Falha update payment {payment.get('id')}: {exc}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Linker Etapa D (Fase 2)")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--city-id", type=str, default=None)
    parser.add_argument("--upload-id", type=str, default=None)
    args = parser.parse_args(argv)

    try:
        from dotenv import load_dotenv
        load_dotenv()
    except Exception:  # noqa: BLE001
        pass

    if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_KEY"):
        _log("SUPABASE_URL/SUPABASE_KEY ausentes.")
        return 2
    if not _ensure_required_tables():
        return 3

    _log("carregando fatos...")
    bids = _load_all(
        "bids_facts",
        "id,city_id,winner_entity_id,bid_number_normalized,process_number_normalized,"
        "modality,object_signature,estimated_value,awarded_value,event_date",
        args.city_id,
        args.upload_id,
    )
    contracts = _load_all(
        "contracts_facts",
        "id,city_id,supplier_entity_id,contract_number_normalized,bid_number_normalized,"
        "modality,object_signature,contract_value,start_date,end_date,bid_fact_id,bid_link_status",
        args.city_id,
        args.upload_id,
    )
    payments = _load_all(
        "payments_facts",
        "id,city_id,supplier_entity_id,payment_number_normalized,contract_number_normalized,"
        "bid_number_normalized,object_signature,payment_value,payment_date,"
        "contract_fact_id,contract_link_status,bid_fact_id,bid_link_status",
        args.city_id,
        args.upload_id,
    )
    _log(f"bids={len(bids)} contracts={len(contracts)} payments={len(payments)}")

    # hidrata datas
    bids = [_hydrate_dates(b, ["event_date"]) for b in bids]
    contracts = [_hydrate_dates(c, ["start_date", "end_date"]) for c in contracts]
    payments = [_hydrate_dates(p, ["payment_date"]) for p in payments]

    counters: dict[str, int] = defaultdict(int)
    _link_contracts_to_bids(contracts, bids, args.dry_run, counters)
    _link_payments(payments, contracts, bids, args.dry_run, counters)

    _log(f"FINAL counters={dict(counters)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
