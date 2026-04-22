from __future__ import annotations

from typing import Iterable

PERSON_LIKE_TYPES = {"person", "server"}
SUPPLIER_LIKE_TYPES = {"supplier", "organization"}
PERSON_LIKE_ROLES = {"server", "person"}
SUPPLIER_LIKE_ROLES = {"supplier", "creditor", "contracted_party", "beneficiary"}
GENERIC_NAME_TOKENS = {
    "silva",
    "santos",
    "souza",
    "oliveira",
    "pereira",
    "costa",
    "rodrigues",
    "ferreira",
    "almeida",
    "lima",
}
INVALID_NORMALIZED_NAMES = {
    "",
    "none",
    "nao informado",
    "nao identificada",
    "nao identificado",
    "sem nome",
}
CONFIDENCE_ORDER = {"indicative": 0, "probable": 1, "confirmed": 2}


def pair_key(id_a: str, id_b: str) -> tuple[str, str]:
    left, right = sorted([str(id_a), str(id_b)])
    return left, right


def is_role_conflict(from_roles: Iterable[str] | None, to_roles: Iterable[str] | None) -> bool:
    left = {str(role or "").strip() for role in (from_roles or []) if str(role or "").strip()}
    right = {str(role or "").strip() for role in (to_roles or []) if str(role or "").strip()}
    return bool(
        (left & PERSON_LIKE_ROLES and right & SUPPLIER_LIKE_ROLES)
        or (right & PERSON_LIKE_ROLES and left & SUPPLIER_LIKE_ROLES)
    )


def is_type_conflict(from_type: str, to_type: str) -> bool:
    left = str(from_type or "").strip()
    right = str(to_type or "").strip()
    return bool(
        (left in PERSON_LIKE_TYPES and right in SUPPLIER_LIKE_TYPES)
        or (right in PERSON_LIKE_TYPES and left in SUPPLIER_LIKE_TYPES)
    )


def is_name_too_generic(normalized_name: str) -> bool:
    normalized_name = str(normalized_name or "").strip()
    if normalized_name in INVALID_NORMALIZED_NAMES:
        return True

    tokens = [token for token in normalized_name.split() if token]
    if len(tokens) <= 1:
        return True

    meaningful = [token for token in tokens if token not in GENERIC_NAME_TOKENS]
    if not meaningful:
        return True

    if len(tokens) <= 2 and len(meaningful) == 1 and tokens[-1] in GENERIC_NAME_TOKENS:
        return True

    return False


def build_evidence(
    *,
    shared_document: str | None = None,
    shared_normalized_name: str | None = None,
    from_roles: Iterable[str] | None = None,
    to_roles: Iterable[str] | None = None,
    shared_uploads: Iterable[str] | None = None,
    shared_city_ids: Iterable[str] | None = None,
    alias_references: Iterable[str] | None = None,
    notes: Iterable[str] | None = None,
) -> dict:
    return {
        "shared_document": shared_document or None,
        "shared_normalized_name": shared_normalized_name or None,
        "from_roles": sorted({str(role) for role in (from_roles or []) if str(role).strip()}),
        "to_roles": sorted({str(role) for role in (to_roles or []) if str(role).strip()}),
        "shared_uploads": sorted({str(item) for item in (shared_uploads or []) if str(item).strip()}),
        "shared_city_ids": sorted({str(item) for item in (shared_city_ids or []) if str(item).strip()}),
        "alias_references": sorted({str(item) for item in (alias_references or []) if str(item).strip()}),
        "notes": [str(item) for item in (notes or []) if str(item).strip()],
    }


def confidence_rank(label: str) -> int:
    return CONFIDENCE_ORDER.get(str(label or "").strip(), -1)


def is_stronger_confidence(
    current_label: str | None,
    current_score: float | int | None,
    incoming_label: str,
    incoming_score: float,
) -> bool:
    current_rank = confidence_rank(current_label or "")
    incoming_rank = confidence_rank(incoming_label)
    if incoming_rank > current_rank:
        return True
    if incoming_rank < current_rank:
        return False
    return float(incoming_score) > float(current_score or 0)


def name_family_signature(normalized_name: str) -> tuple[str, str] | None:
    tokens = [token for token in str(normalized_name or "").split() if token]
    if len(tokens) < 2:
        return None
    return tokens[0], tokens[-1]
