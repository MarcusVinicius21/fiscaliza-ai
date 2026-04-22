from __future__ import annotations

import argparse
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))

from app.utils.cross_references import (  # noqa: E402
    PERSON_LIKE_TYPES,
    SUPPLIER_LIKE_TYPES,
    build_evidence,
    confidence_rank,
    is_name_too_generic,
    is_role_conflict,
    is_stronger_confidence,
    is_type_conflict,
    name_family_signature,
    pair_key,
)
from app.utils.normalization import normalize_document, normalize_name  # noqa: E402


load_dotenv(BACKEND_ROOT / ".env")
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

ENTITY_TYPES = list(PERSON_LIKE_TYPES | SUPPLIER_LIKE_TYPES)


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


def fetch_entities(limit: int | None = None) -> list[dict]:
    query = (
        supabase.table("entities")
        .select("id, entity_type, canonical_name, document, normalized_name, source_confidence, created_at")
        .in_("entity_type", ENTITY_TYPES)
    )
    if limit:
        query = query.limit(limit)
    response = query.execute()
    return response.data or []


def fetch_aliases(entity_ids: list[str]) -> dict[str, list[dict]]:
    rows = select_in_chunks(
        "entity_aliases",
        "entity_id, alias_name, normalized_alias, source_upload_id",
        "entity_id",
        entity_ids,
    )
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[str(row["entity_id"])].append(row)
    return grouped


def fetch_links_by_entity(entity_ids: list[str]) -> dict[str, list[dict]]:
    rows = select_in_chunks(
        "record_entity_links",
        "entity_id, standardized_record_id, role_in_record, match_type, match_confidence",
        "entity_id",
        entity_ids,
    )
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[str(row["entity_id"])].append(row)
    return grouped


def fetch_records(record_ids: list[str]) -> dict[str, dict]:
    rows = select_in_chunks(
        "standardized_records",
        "id, upload_id, category, documento, nome_credor_servidor, valor_bruto, raw_json",
        "id",
        record_ids,
    )
    return {str(row["id"]): row for row in rows}


def fetch_uploads(upload_ids: list[str]) -> dict[str, dict]:
    rows = select_in_chunks(
        "uploads",
        "id, city_id, category, report_type, report_label, file_name, created_at",
        "id",
        upload_ids,
    )
    return {str(row["id"]): row for row in rows}


def fetch_existing_cross_references() -> dict[tuple[str, str, str], dict]:
    response = supabase.table("entity_cross_references").select(
        "id, left_entity_id, right_entity_id, cross_ref_type, confidence_label, confidence_score, decision_status"
    ).limit(5000).execute()
    rows = response.data or []
    result: dict[tuple[str, str, str], dict] = {}
    for row in rows:
        key = (
            str(row["left_entity_id"]),
            str(row["right_entity_id"]),
            str(row["cross_ref_type"]),
        )
        result[key] = row
    return result


def enrich_entity_context(
    entities: list[dict],
    aliases_by_entity: dict[str, list[dict]],
    links_by_entity: dict[str, list[dict]],
    records_by_id: dict[str, dict],
    uploads_by_id: dict[str, dict],
    city_id_filter: str | None = None,
) -> list[dict]:
    contexts: list[dict] = []

    for entity in entities:
        entity_id = str(entity["id"])
        links = links_by_entity.get(entity_id, [])
        record_ids = {str(link["standardized_record_id"]) for link in links if link.get("standardized_record_id")}
        upload_ids = {
            str(records_by_id[record_id].get("upload_id") or "")
            for record_id in record_ids
            if records_by_id.get(record_id)
        }
        upload_ids = {upload_id for upload_id in upload_ids if upload_id}
        city_ids = {
            str((uploads_by_id.get(upload_id) or {}).get("city_id") or "")
            for upload_id in upload_ids
        }
        city_ids = {city for city in city_ids if city}
        categories = {
            str((records_by_id.get(record_id) or {}).get("category") or "").strip()
            for record_id in record_ids
        }
        categories = {category for category in categories if category}
        roles = {
            str(link.get("role_in_record") or "").strip()
            for link in links
            if str(link.get("role_in_record") or "").strip()
        }
        aliases = {
            normalize_name(entity.get("canonical_name"))
        }
        aliases |= {
            normalize_name(alias.get("alias_name"))
            for alias in aliases_by_entity.get(entity_id, [])
            if normalize_name(alias.get("alias_name"))
        }
        aliases |= {
            normalize_name(alias.get("normalized_alias"))
            for alias in aliases_by_entity.get(entity_id, [])
            if normalize_name(alias.get("normalized_alias"))
        }

        if city_id_filter and city_id_filter not in city_ids:
            continue

        contexts.append({
            **entity,
            "document_normalized": normalize_document(entity.get("document")),
            "normalized_name": normalize_name(entity.get("normalized_name") or entity.get("canonical_name")),
            "record_ids": record_ids,
            "upload_ids": upload_ids,
            "city_ids": city_ids,
            "categories": categories,
            "roles": roles,
            "aliases": aliases,
            "records_count": len(record_ids),
        })

    return contexts


def has_strong_shared_context(left: dict, right: dict) -> bool:
    shared_uploads = left["upload_ids"] & right["upload_ids"]
    shared_city_ids = left["city_ids"] & right["city_ids"]
    shared_categories = left["categories"] & right["categories"]
    shared_aliases = left["aliases"] & right["aliases"]
    return bool(shared_uploads or shared_aliases or (shared_city_ids and shared_categories))


def make_reason_summary(cross_ref_type: str, match_basis: str, confidence_label: str) -> str:
    if cross_ref_type == "role_conflict" and match_basis == "document_and_role":
        return "Mesmo documento aparece em papeis de pessoa/servidor e fornecedor ou contratado."
    if cross_ref_type == "same_person_candidate" and match_basis == "document_exact":
        return "Mesmo documento encontrado em entidades pessoais distintas."
    if cross_ref_type == "homonym_candidate" and match_basis == "name_normalized":
        if confidence_label == "confirmed":
            return "Mesmo nome normalizado aparece com documentos diferentes. O caso pede revisao para homonimo."
        return "Mesmo nome normalizado sem documento comum. O caso merece verificacao."
    if match_basis == "alias_cross":
        return "Alias observado em uma entidade coincide com o nome ou alias da outra."
    if match_basis == "name_similar_family":
        return "Primeiro e ultimo nome coincidem, sem documento em comum."
    if cross_ref_type == "role_conflict":
        return "Mesmo nome aparece em papeis que merecem apuracao adicional."
    return "Os sinais encontrados sugerem revisao investigativa desta identidade."


def candidate_key(candidate: dict) -> tuple[str, str, str]:
    return candidate["left_entity_id"], candidate["right_entity_id"], candidate["cross_ref_type"]


def keep_stronger_candidate(existing: dict | None, incoming: dict) -> dict:
    if not existing:
        return incoming
    if is_stronger_confidence(
        existing.get("confidence_label"),
        existing.get("confidence_score"),
        incoming["confidence_label"],
        incoming["confidence_score"],
    ):
        return incoming
    return existing


def add_candidate(bucket: dict[tuple[str, str, str], dict], candidate: dict) -> None:
    key = candidate_key(candidate)
    bucket[key] = keep_stronger_candidate(bucket.get(key), candidate)


def build_candidate(
    left: dict,
    right: dict,
    *,
    cross_ref_type: str,
    confidence_label: str,
    confidence_score: float,
    match_basis: str,
    alias_references: list[str] | None = None,
    notes: list[str] | None = None,
) -> dict:
    left_id, right_id = pair_key(str(left["id"]), str(right["id"]))
    ordered_left = left if str(left["id"]) == left_id else right
    ordered_right = right if str(right["id"]) == right_id else left

    shared_uploads = ordered_left["upload_ids"] & ordered_right["upload_ids"]
    shared_city_ids = ordered_left["city_ids"] & ordered_right["city_ids"]
    shared_document = (
        ordered_left["document_normalized"]
        if ordered_left["document_normalized"]
        and ordered_left["document_normalized"] == ordered_right["document_normalized"]
        else None
    )
    shared_name = (
        ordered_left["normalized_name"]
        if ordered_left["normalized_name"]
        and ordered_left["normalized_name"] == ordered_right["normalized_name"]
        else None
    )
    evidence = build_evidence(
        shared_document=shared_document,
        shared_normalized_name=shared_name,
        from_roles=ordered_left["roles"],
        to_roles=ordered_right["roles"],
        shared_uploads=shared_uploads,
        shared_city_ids=shared_city_ids,
        alias_references=alias_references,
        notes=notes,
    )

    primary_source_upload_id = next(iter(shared_uploads), None) or next(iter(ordered_left["upload_ids"]), None) or next(
        iter(ordered_right["upload_ids"]), None
    )

    return {
        "left_entity_id": left_id,
        "right_entity_id": right_id,
        "cross_ref_type": cross_ref_type,
        "confidence_label": confidence_label,
        "confidence_score": confidence_score,
        "match_basis": match_basis,
        "reason_summary": make_reason_summary(cross_ref_type, match_basis, confidence_label),
        "primary_source_upload_id": primary_source_upload_id,
        "evidence_payload": evidence,
    }


def build_identity_candidates(contexts: list[dict]) -> dict[tuple[str, str, str], dict]:
    bucket: dict[tuple[str, str, str], dict] = {}
    by_document: dict[str, list[dict]] = defaultdict(list)
    by_name: dict[str, list[dict]] = defaultdict(list)
    by_alias: dict[str, list[dict]] = defaultdict(list)

    for context in contexts:
        if context["entity_type"] not in PERSON_LIKE_TYPES:
            continue
        if context["document_normalized"]:
            by_document[context["document_normalized"]].append(context)
        if context["normalized_name"] and not is_name_too_generic(context["normalized_name"]):
            by_name[context["normalized_name"]].append(context)
        for alias in context["aliases"]:
            if alias and not is_name_too_generic(alias):
                by_alias[alias].append(context)

    for group in by_document.values():
        if len(group) < 2:
            continue
        for index, left in enumerate(group):
            for right in group[index + 1 :]:
                add_candidate(
                    bucket,
                    build_candidate(
                        left,
                        right,
                        cross_ref_type="same_person_candidate",
                        confidence_label="confirmed",
                        confidence_score=1.0,
                        match_basis="document_exact",
                        notes=["Mesmo documento em entidades do tipo pessoa/servidor."],
                    ),
                )

    for normalized_name, group in by_name.items():
        if len(group) < 2:
            continue
        for index, left in enumerate(group):
            for right in group[index + 1 :]:
                if left["document_normalized"] and right["document_normalized"]:
                    if left["document_normalized"] != right["document_normalized"]:
                        add_candidate(
                            bucket,
                            build_candidate(
                                left,
                                right,
                                cross_ref_type="homonym_candidate",
                                confidence_label="confirmed",
                                confidence_score=0.95,
                                match_basis="name_normalized",
                                notes=["Mesmo nome normalizado com documentos diferentes."],
                            ),
                        )
                    continue

                if has_strong_shared_context(left, right):
                    add_candidate(
                        bucket,
                        build_candidate(
                            left,
                            right,
                            cross_ref_type="same_person_candidate",
                            confidence_label="probable",
                            confidence_score=0.8,
                            match_basis="name_normalized",
                            notes=["Mesmo nome normalizado com contexto compartilhado."],
                        ),
                    )
                else:
                    add_candidate(
                        bucket,
                        build_candidate(
                            left,
                            right,
                            cross_ref_type="homonym_candidate",
                            confidence_label="indicative",
                            confidence_score=0.6,
                            match_basis="name_normalized",
                            notes=["Mesmo nome normalizado sem documento em comum."],
                        ),
                    )

    for alias, group in by_alias.items():
        if len(group) < 2:
            continue
        for index, left in enumerate(group):
            for right in group[index + 1 :]:
                if left["normalized_name"] == right["normalized_name"]:
                    continue
                if left["document_normalized"] and right["document_normalized"] and left["document_normalized"] != right["document_normalized"]:
                    continue
                add_candidate(
                    bucket,
                    build_candidate(
                        left,
                        right,
                        cross_ref_type="same_person_candidate",
                        confidence_label="indicative",
                        confidence_score=0.65,
                        match_basis="alias_cross",
                        alias_references=[alias],
                        notes=["Alias cruzado entre entidades de pessoa/servidor."],
                    ),
                )

    return bucket


def build_role_conflict_candidates(people_contexts: list[dict], supplier_contexts: list[dict]) -> dict[tuple[str, str, str], dict]:
    bucket: dict[tuple[str, str, str], dict] = {}
    people_by_document = defaultdict(list)
    supplier_by_document = defaultdict(list)
    people_by_name = defaultdict(list)
    supplier_by_name = defaultdict(list)

    for context in people_contexts:
        if context["document_normalized"]:
            people_by_document[context["document_normalized"]].append(context)
        if context["normalized_name"] and not is_name_too_generic(context["normalized_name"]):
            people_by_name[context["normalized_name"]].append(context)

    for context in supplier_contexts:
        if context["document_normalized"]:
            supplier_by_document[context["document_normalized"]].append(context)
        if context["normalized_name"] and not is_name_too_generic(context["normalized_name"]):
            supplier_by_name[context["normalized_name"]].append(context)

    for document, left_group in people_by_document.items():
        right_group = supplier_by_document.get(document, [])
        for left in left_group:
            for right in right_group:
                if not (is_type_conflict(left["entity_type"], right["entity_type"]) or is_role_conflict(left["roles"], right["roles"])):
                    continue
                add_candidate(
                    bucket,
                    build_candidate(
                        left,
                        right,
                        cross_ref_type="role_conflict",
                        confidence_label="confirmed",
                        confidence_score=1.0,
                        match_basis="document_and_role",
                        notes=["Mesmo documento com conflito de tipo ou papel."],
                    ),
                )

    for normalized_name, left_group in people_by_name.items():
        right_group = supplier_by_name.get(normalized_name, [])
        for left in left_group:
            for right in right_group:
                if left["document_normalized"] and right["document_normalized"] and left["document_normalized"] != right["document_normalized"]:
                    add_candidate(
                        bucket,
                        build_candidate(
                            left,
                            right,
                            cross_ref_type="homonym_candidate",
                            confidence_label="confirmed",
                            confidence_score=0.95,
                            match_basis="name_normalized",
                            notes=["Mesmo nome normalizado em tipos diferentes com documentos distintos."],
                        ),
                    )
                    continue

                if not (is_type_conflict(left["entity_type"], right["entity_type"]) or is_role_conflict(left["roles"], right["roles"])):
                    continue

                if has_strong_shared_context(left, right):
                    add_candidate(
                        bucket,
                        build_candidate(
                            left,
                            right,
                            cross_ref_type="role_conflict",
                            confidence_label="probable",
                            confidence_score=0.8,
                            match_basis="name_normalized",
                            notes=["Mesmo nome normalizado com contexto compartilhado em papeis sensiveis."],
                        ),
                    )
                else:
                    add_candidate(
                        bucket,
                        build_candidate(
                            left,
                            right,
                            cross_ref_type="homonym_candidate",
                            confidence_label="indicative",
                            confidence_score=0.6,
                            match_basis="name_normalized",
                            notes=["Mesmo nome normalizado, mas sem documento comum."],
                        ),
                    )

    return bucket


def build_homonym_candidates(contexts: list[dict]) -> dict[tuple[str, str, str], dict]:
    bucket: dict[tuple[str, str, str], dict] = {}
    families: dict[tuple[str, str], list[dict]] = defaultdict(list)

    for context in contexts:
        if context["entity_type"] not in PERSON_LIKE_TYPES:
            continue
        signature = name_family_signature(context["normalized_name"])
        if not signature:
            continue
        if any(token in {"", None} for token in signature):
            continue
        if is_name_too_generic(" ".join(signature)):
            continue
        families[signature].append(context)

    for group in families.values():
        if len(group) < 2:
            continue
        for index, left in enumerate(group):
            for right in group[index + 1 :]:
                if left["normalized_name"] == right["normalized_name"]:
                    continue
                if left["document_normalized"] and right["document_normalized"] and left["document_normalized"] == right["document_normalized"]:
                    continue
                add_candidate(
                    bucket,
                    build_candidate(
                        left,
                        right,
                        cross_ref_type="homonym_candidate",
                        confidence_label="indicative",
                        confidence_score=0.55,
                        match_basis="name_similar_family",
                        notes=["Primeiro e ultimo nome coincidem, sem documento em comum."],
                    ),
                )

    return bucket


def already_stronger_exists(existing: dict | None, candidate: dict, rebuild_candidates: bool) -> bool:
    if not existing:
        return False
    if existing.get("decision_status") in {"accepted", "dismissed"}:
        return True
    if rebuild_candidates:
        return False
    current_rank = confidence_rank(existing.get("confidence_label"))
    incoming_rank = confidence_rank(candidate["confidence_label"])
    if current_rank > incoming_rank:
        return True
    if current_rank == incoming_rank and float(existing.get("confidence_score") or 0) >= float(candidate["confidence_score"]):
        return True
    return False


def insert_cross_reference(
    candidate: dict,
    existing_map: dict[tuple[str, str, str], dict],
    dry_run: bool,
    rebuild_candidates: bool,
    counters: Counter,
) -> None:
    key = (
        candidate["left_entity_id"],
        candidate["right_entity_id"],
        candidate["cross_ref_type"],
    )
    existing = existing_map.get(key)

    if already_stronger_exists(existing, candidate, rebuild_candidates):
        counters["skipped"] += 1
        return

    if dry_run:
        if existing:
            counters["updated"] += 1
        else:
            counters["created"] += 1
        return

    if existing:
        payload = {
            "confidence_label": candidate["confidence_label"],
            "confidence_score": candidate["confidence_score"],
            "match_basis": candidate["match_basis"],
            "reason_summary": candidate["reason_summary"],
            "primary_source_upload_id": candidate["primary_source_upload_id"],
            "evidence_payload": candidate["evidence_payload"],
        }
        supabase.table("entity_cross_references").update(payload).eq("id", existing["id"]).execute()
        existing_map[key] = {**existing, **payload}
        counters["updated"] += 1
        return

    response = supabase.table("entity_cross_references").insert(candidate).execute()
    if response.data:
        existing_map[key] = response.data[0]
    counters["created"] += 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Detecta cross references da Etapa C.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--city-id", type=str, default=None)
    parser.add_argument("--rebuild-candidates", action="store_true")
    args = parser.parse_args()

    entities = fetch_entities(limit=args.limit)
    entity_ids = [str(entity["id"]) for entity in entities]
    aliases_by_entity = fetch_aliases(entity_ids)
    links_by_entity = fetch_links_by_entity(entity_ids)
    record_ids = sorted({
        str(link["standardized_record_id"])
        for links in links_by_entity.values()
        for link in links
        if link.get("standardized_record_id")
    })
    records_by_id = fetch_records(record_ids)
    upload_ids = sorted({
        str(record.get("upload_id") or "")
        for record in records_by_id.values()
        if record.get("upload_id")
    })
    uploads_by_id = fetch_uploads(upload_ids)

    contexts = enrich_entity_context(
        entities,
        aliases_by_entity,
        links_by_entity,
        records_by_id,
        uploads_by_id,
        city_id_filter=args.city_id,
    )
    contexts_by_id = {str(context["id"]): context for context in contexts}
    people_contexts = [context for context in contexts if context["entity_type"] in PERSON_LIKE_TYPES]
    supplier_contexts = [context for context in contexts if context["entity_type"] in SUPPLIER_LIKE_TYPES]

    candidates: dict[tuple[str, str, str], dict] = {}
    for candidate_map in (
        build_identity_candidates(people_contexts),
        build_role_conflict_candidates(people_contexts, supplier_contexts),
        build_homonym_candidates(people_contexts),
    ):
        for key, candidate in candidate_map.items():
            candidates[key] = keep_stronger_candidate(candidates.get(key), candidate)

    existing_map = fetch_existing_cross_references()
    counters: Counter = Counter()
    counters["entities_considered"] = len(contexts)
    counters["people_considered"] = len(people_contexts)
    counters["suppliers_considered"] = len(supplier_contexts)
    counters["candidates_built"] = len(candidates)

    for candidate in candidates.values():
        if args.city_id:
            upload_id = str(candidate.get("primary_source_upload_id") or "")
            upload = uploads_by_id.get(upload_id, {})
            if str(upload.get("city_id") or "") != args.city_id:
                counters["skipped_city"] += 1
                continue
        insert_cross_reference(candidate, existing_map, args.dry_run, args.rebuild_candidates, counters)

    print("=== RESUMO DETECTOR ETAPA C ===")
    for key in [
        "entities_considered",
        "people_considered",
        "suppliers_considered",
        "candidates_built",
        "created",
        "updated",
        "skipped",
        "skipped_city",
    ]:
        print(f"{key}: {counters.get(key, 0)}")
    print(f"dry_run: {args.dry_run}")
    if args.limit:
        print(f"limit: {args.limit}")
    if args.city_id:
        print(f"city_id: {args.city_id}")
    print(f"rebuild_candidates: {args.rebuild_candidates}")


if __name__ == "__main__":
    main()
