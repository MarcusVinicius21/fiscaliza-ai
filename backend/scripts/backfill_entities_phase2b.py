import argparse
import os
import sys
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))

from app.utils.normalization import extract_entity_candidates, normalize_document, normalize_name  # noqa: E402


load_dotenv(BACKEND_ROOT / ".env")
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
SUPPLIER_TYPES = {"supplier", "organization"}


def chunked(values: list[str], chunk_size: int = 400) -> list[list[str]]:
    return [values[index:index + chunk_size] for index in range(0, len(values), chunk_size)]


def select_in_chunks(table: str, select_clause: str, column: str, values: list[str]) -> list[dict]:
    if not values:
        return []

    rows: list[dict] = []
    for chunk in chunked(values):
        response = (
            supabase.table(table)
            .select(select_clause)
            .in_(column, chunk)
            .execute()
        )
        rows.extend(response.data or [])
    return rows


def source_confidence_from_candidate(candidate: dict) -> float:
    if normalize_document(candidate.get("document")):
        return 1.0

    entity_type = candidate.get("entity_type")
    confidence = float(candidate.get("match_confidence") or 0.6)
    if entity_type in SUPPLIER_TYPES and confidence >= 0.9:
        return 0.9
    if entity_type in SUPPLIER_TYPES:
        return 0.75
    return 0.6


def match_type_from_candidate(candidate: dict) -> str:
    if normalize_document(candidate.get("document")):
        return "document_exact"

    confidence = float(candidate.get("match_confidence") or 0.6)
    if confidence >= 0.9:
        return "name_exact"
    if confidence >= 0.8:
        return "name_normalized"
    return "fallback_name"


def fetch_records(limit: int | None, upload_id: str | None) -> list[dict]:
    query = supabase.table("standardized_records").select(
        "id, upload_id, category, report_type, report_label, nome_credor_servidor, documento, valor_bruto, raw_json"
    )
    if upload_id:
        query = query.eq("upload_id", upload_id)
    if limit:
        query = query.limit(limit)
    response = query.execute()
    return response.data or []


def fetch_upload_context(upload_ids: list[str]) -> dict[str, dict]:
    rows = select_in_chunks(
        "uploads",
        "id, city_id, category, report_type, report_label, file_name, created_at",
        "id",
        upload_ids,
    )
    return {str(row["id"]): row for row in rows}


def fetch_existing_links(record_ids: list[str]) -> dict[str, list[dict]]:
    rows = select_in_chunks(
        "record_entity_links",
        "id, standardized_record_id, entity_id, role_in_record",
        "standardized_record_id",
        record_ids,
    )
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[str(row["standardized_record_id"])].append(row)
    return grouped


def resolve_or_create_entity(candidate: dict, upload_context: dict, dry_run: bool, counters: dict) -> dict:
    entity_type = str(candidate.get("entity_type") or "other")
    display_name = str(candidate.get("display_name") or "").strip()
    normalized_name = normalize_name(display_name)
    document = normalize_document(candidate.get("document"))
    upload_id = str(upload_context.get("id") or "")

    if document:
        response = (
            supabase.table("entities")
            .select("*")
            .eq("entity_type", entity_type)
            .eq("document", document)
            .limit(1)
            .execute()
        )
        if response.data:
            counters["reused_entities"] += 1
            return response.data[0]

    if not document and entity_type in SUPPLIER_TYPES and normalized_name:
        response = (
            supabase.table("entities")
            .select("*")
            .eq("entity_type", entity_type)
            .eq("normalized_name", normalized_name)
            .limit(1)
            .execute()
        )
        if response.data:
            counters["reused_entities"] += 1
            return response.data[0]

    if not document and normalized_name and upload_id:
        alias_response = (
            supabase.table("entity_aliases")
            .select("entity_id")
            .eq("normalized_alias", normalized_name)
            .eq("source_upload_id", upload_id)
            .limit(1)
            .execute()
        )
        if alias_response.data:
            entity_response = (
                supabase.table("entities")
                .select("*")
                .eq("id", alias_response.data[0]["entity_id"])
                .limit(1)
                .execute()
            )
            if entity_response.data:
                counters["reused_entities"] += 1
                return entity_response.data[0]

    payload = {
        "entity_type": entity_type,
        "canonical_name": display_name,
        "document": document or None,
        "normalized_name": normalized_name,
        "source_confidence": source_confidence_from_candidate(candidate),
    }

    if dry_run:
        counters["created_entities"] += 1
        return {
            "id": str(uuid.uuid4()),
            **payload,
        }

    response = supabase.table("entities").insert(payload).execute()
    counters["created_entities"] += 1
    if response.data:
        return response.data[0]

    refetch = (
        supabase.table("entities")
        .select("*")
        .eq("entity_type", entity_type)
        .eq("normalized_name", normalized_name)
        .limit(1)
        .execute()
    )
    if refetch.data:
        return refetch.data[0]

    raise RuntimeError(f"Falha ao criar entidade para {display_name}")


def upsert_entity_alias(entity: dict, candidate: dict, upload_context: dict, dry_run: bool, counters: dict) -> None:
    alias_name = str(candidate.get("display_name") or "").strip()
    normalized_alias = normalize_name(alias_name)
    if not alias_name or not normalized_alias:
        return

    response = (
        supabase.table("entity_aliases")
        .select("id")
        .eq("entity_id", entity["id"])
        .eq("normalized_alias", normalized_alias)
        .limit(1)
        .execute()
    )
    if response.data:
        return

    payload = {
        "entity_id": entity["id"],
        "alias_name": alias_name,
        "alias_type": candidate.get("alias_type") or "raw_record_name",
        "normalized_alias": normalized_alias,
        "source_upload_id": upload_context.get("id"),
    }

    if dry_run:
        counters["created_aliases"] += 1
        return

    supabase.table("entity_aliases").insert(payload).execute()
    counters["created_aliases"] += 1


def upsert_record_entity_link(record: dict, entity: dict, candidate: dict, existing_links_for_record: list[dict], dry_run: bool, counters: dict) -> dict:
    role_in_record = candidate.get("role_in_record") or "other"
    for link in existing_links_for_record:
        if (
            str(link.get("entity_id")) == str(entity["id"])
            and str(link.get("role_in_record")) == str(role_in_record)
        ):
            return link

    payload = {
        "standardized_record_id": record["id"],
        "entity_id": entity["id"],
        "role_in_record": role_in_record,
        "match_type": match_type_from_candidate(candidate),
        "match_confidence": float(candidate.get("match_confidence") or 0.6),
    }

    if dry_run:
        counters["created_links"] += 1
        fake_link = {"id": str(uuid.uuid4()), **payload}
        existing_links_for_record.append(fake_link)
        return fake_link

    response = supabase.table("record_entity_links").insert(payload).execute()
    counters["created_links"] += 1
    link = response.data[0] if response.data else {"id": str(uuid.uuid4()), **payload}
    existing_links_for_record.append(link)
    return link


def maybe_create_entity_relationship(record: dict, linked_entities: list[dict], dry_run: bool, counters: dict) -> None:
    unique_entities = []
    seen = set()
    for item in linked_entities:
        entity_id = str(item["entity"]["id"])
        if entity_id in seen:
            continue
        seen.add(entity_id)
        unique_entities.append(item)

    if len(unique_entities) < 2:
        return

    primary = unique_entities[0]
    for other in unique_entities[1:]:
        if str(primary["entity"]["id"]) == str(other["entity"]["id"]):
            continue

        payload = {
            "from_entity_id": primary["entity"]["id"],
            "to_entity_id": other["entity"]["id"],
            "relationship_type": "appears_within_same_record",
            "source_type": "standardized_record",
            "source_reference": str(record["id"]),
            "confidence_score": 0.55,
        }

        response = (
            supabase.table("entity_relationships")
            .select("id")
            .eq("from_entity_id", payload["from_entity_id"])
            .eq("to_entity_id", payload["to_entity_id"])
            .eq("relationship_type", payload["relationship_type"])
            .eq("source_type", payload["source_type"])
            .eq("source_reference", payload["source_reference"])
            .limit(1)
            .execute()
        )
        if response.data:
            continue

        if dry_run:
            counters["created_relationships"] += 1
            continue

        supabase.table("entity_relationships").insert(payload).execute()
        counters["created_relationships"] += 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill idempotente da Etapa B do Fiscaliza.AI.")
    parser.add_argument("--dry-run", action="store_true", help="Simula sem gravar no banco.")
    parser.add_argument("--limit", type=int, default=None, help="Limita a quantidade de registros processados.")
    parser.add_argument("--upload-id", type=str, default=None, help="Processa apenas um upload específico.")
    args = parser.parse_args()

    records = fetch_records(args.limit, args.upload_id)
    upload_ids = sorted({str(record.get("upload_id") or "") for record in records if record.get("upload_id")})
    uploads_map = fetch_upload_context(upload_ids)
    existing_links_map = fetch_existing_links([str(record["id"]) for record in records])

    counters = defaultdict(int)
    counters["total_records"] = len(records)

    for index, record in enumerate(records, start=1):
        upload_context = uploads_map.get(str(record.get("upload_id") or ""), {})
        upload_context = {
            "id": str(record.get("upload_id") or ""),
            "category": record.get("category") or upload_context.get("category"),
            "report_type": record.get("report_type") or upload_context.get("report_type"),
            "report_label": record.get("report_label") or upload_context.get("report_label"),
            **upload_context,
        }
        candidates = extract_entity_candidates(record, upload_context)
        linked_entities = []
        existing_links_for_record = existing_links_map.get(str(record["id"]), [])

        if not candidates:
            counters["records_without_candidates"] += 1
            continue

        for candidate in candidates:
            role_in_record = str(candidate.get("role_in_record") or "other")
            if any(str(link.get("role_in_record")) == role_in_record for link in existing_links_for_record):
                counters["skipped_existing_links"] += 1
                continue

            entity = resolve_or_create_entity(candidate, upload_context, args.dry_run, counters)
            upsert_entity_alias(entity, candidate, upload_context, args.dry_run, counters)
            link = upsert_record_entity_link(record, entity, candidate, existing_links_for_record, args.dry_run, counters)
            linked_entities.append({"entity": entity, "link": link, "candidate": candidate})

        maybe_create_entity_relationship(record, linked_entities, args.dry_run, counters)

        if index % 100 == 0:
            print(f"[backfill] processados {index}/{len(records)} registros...")

    print("=== RESUMO BACKFILL ETAPA B ===")
    for key in [
        "total_records",
        "records_without_candidates",
        "reused_entities",
        "created_entities",
        "created_aliases",
        "created_links",
        "created_relationships",
        "skipped_existing_links",
    ]:
        print(f"{key}: {counters.get(key, 0)}")
    print(f"dry_run: {args.dry_run}")
    if args.upload_id:
        print(f"upload_id: {args.upload_id}")
    if args.limit:
        print(f"limit: {args.limit}")


if __name__ == "__main__":
    main()
