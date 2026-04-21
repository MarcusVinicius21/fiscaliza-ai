import re
import unicodedata
from typing import Any


SUPPLIER_CATEGORIES = {"contracts", "expenses", "bids"}
SUPPLIER_NAME_KEYS = [
    "fornecedor_nome",
    "nome_fornecedor",
    "fornecedor",
    "credor",
    "nome_credor",
    "favorecido",
    "beneficiario",
    "contratado",
    "contratada",
    "razao_social",
    "empresa",
]
SUPPLIER_DOCUMENT_KEYS = [
    "fornecedor_cpf_cnpj",
    "fornecedor_documento",
    "cnpj",
    "cpf_cnpj",
]
PERSON_NAME_KEYS = [
    "servidor",
    "nome_servidor",
    "fiscal_nome",
    "responsavel_nome",
]
PERSON_DOCUMENT_KEYS = [
    "cpf",
    "servidor_cpf",
    "responsavel_cpf",
]


def _clean_string(value: Any) -> str:
    return str(value or "").strip()


def normalize_name(text: str) -> str:
    cleaned = _clean_string(text)
    if not cleaned:
        return ""

    lowered = cleaned.lower()
    normalized = unicodedata.normalize("NFKD", lowered)
    without_accents = "".join(
        char for char in normalized if not unicodedata.combining(char)
    )
    without_punctuation = re.sub(r"[^a-z0-9]+", " ", without_accents)
    return re.sub(r"\s+", " ", without_punctuation).strip()


def normalize_document(text: str) -> str:
    return re.sub(r"\D+", "", _clean_string(text))


def infer_entity_type(record: dict, upload_context: dict) -> str:
    raw = record.get("raw_json") if isinstance(record.get("raw_json"), dict) else {}
    category = str(
        upload_context.get("category")
        or record.get("category")
        or ""
    ).strip().lower()

    if category == "payroll":
        return "server"

    document = normalize_document(
        record.get("documento")
        or raw.get("fornecedor_cpf_cnpj")
        or raw.get("cpf")
        or ""
    )

    if category in SUPPLIER_CATEGORIES:
        if len(document) == 14:
            return "supplier"
        return "supplier"

    if len(document) == 14:
        return "organization"
    if len(document) == 11:
        return "person"

    return "other"


def _build_candidate(
    display_name: Any,
    document: Any,
    entity_type: str,
    role_in_record: str,
    alias_type: str,
    match_confidence: float,
    source_key: str,
) -> dict | None:
    name = _clean_string(display_name)
    if not name:
        return None

    doc = normalize_document(document)
    if doc and len(doc) not in {11, 14}:
        doc = ""

    return {
        "entity_type": entity_type,
        "display_name": name,
        "document": doc,
        "role_in_record": role_in_record,
        "alias_type": alias_type,
        "match_confidence": match_confidence,
        "source_key": source_key,
    }


def extract_entity_candidates(record: dict, upload_context: dict) -> list[dict]:
    raw = record.get("raw_json") if isinstance(record.get("raw_json"), dict) else {}
    inferred_type = infer_entity_type(record, upload_context)
    candidates: list[dict] = []

    primary = _build_candidate(
        record.get("nome_credor_servidor"),
        record.get("documento"),
        inferred_type,
        "server" if inferred_type == "server" else "supplier",
        "raw_record_name",
        1.0 if normalize_document(record.get("documento")) else 0.9,
        "nome_credor_servidor",
    )
    if primary:
        candidates.append(primary)

    for key in SUPPLIER_NAME_KEYS:
        candidate = _build_candidate(
            raw.get(key),
            next((raw.get(doc_key) for doc_key in SUPPLIER_DOCUMENT_KEYS if raw.get(doc_key)), ""),
            "supplier" if inferred_type != "server" else "organization",
            "supplier",
            "raw_record_name",
            1.0 if any(raw.get(doc_key) for doc_key in SUPPLIER_DOCUMENT_KEYS) else 0.8,
            key,
        )
        if candidate:
            candidates.append(candidate)

    for key in PERSON_NAME_KEYS:
        candidate = _build_candidate(
            raw.get(key),
            next((raw.get(doc_key) for doc_key in PERSON_DOCUMENT_KEYS if raw.get(doc_key)), ""),
            "person" if key != "nome_servidor" else "server",
            "person" if key != "nome_servidor" else "server",
            "raw_record_name",
            1.0 if any(raw.get(doc_key) for doc_key in PERSON_DOCUMENT_KEYS) else 0.6,
            key,
        )
        if candidate:
            candidates.append(candidate)

    deduped: list[dict] = []
    seen = set()
    for item in candidates:
        key = (
            item["entity_type"],
            item["role_in_record"],
            normalize_name(item["display_name"]),
            item["document"],
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    return deduped
