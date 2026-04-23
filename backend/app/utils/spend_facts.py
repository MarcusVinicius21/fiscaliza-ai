"""Funcoes puras para a Etapa D (Fase 2) da cadeia de gastos.

Normalizacao, assinatura e classificacao dos links licitacao x contrato x pagamento.
Sem dependencia de Supabase para permitir testes e uso offline.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import date, datetime, timedelta
from typing import Any

_GENERIC_TOKENS = {
    "servico", "servicos", "produto", "produtos", "material", "materiais",
    "diversos", "geral", "gerais", "outros", "outras", "item", "itens",
}

_WORD_SPLIT_RE = re.compile(r"[^a-z0-9]+")


def normalize_identifier(value: Any) -> str:
    """Normaliza numeros/identificadores: upper, sem pontuacao, sem espacos."""
    if value is None:
        return ""
    text = str(value).strip().upper()
    if not text:
        return ""
    cleaned = re.sub(r"[^A-Z0-9]+", "", text)
    return cleaned


def _strip_accents(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def normalize_object(value: Any) -> str:
    """Normaliza objeto para comparacao: lowercase, sem acento, pontuacao leve removida."""
    if value is None:
        return ""
    text = str(value).strip().lower()
    if not text:
        return ""
    text = _strip_accents(text)
    text = re.sub(r"[^a-z0-9\s]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def build_object_signature(value: Any) -> str:
    """Extrai as primeiras 8 palavras significativas (len > 2) e junta com _."""
    normalized = normalize_object(value)
    if not normalized:
        return ""
    tokens = [tok for tok in _WORD_SPLIT_RE.split(normalized) if len(tok) > 2]
    if not tokens:
        return ""
    return "_".join(tokens[:8])


def parse_factual_date(value: Any) -> date | None:
    """Aceita ISO YYYY-MM-DD, BR DD/MM/YYYY, DD/MM/YY, MM/YYYY."""
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    text = str(value).strip()
    if not text:
        return None
    # ISO com hora
    if "T" in text:
        text_head = text.split("T", 1)[0]
    else:
        text_head = text
    # ISO YYYY-MM-DD
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text_head):
        try:
            return datetime.strptime(text_head, "%Y-%m-%d").date()
        except ValueError:
            return None
    # DD/MM/YYYY
    if re.fullmatch(r"\d{2}/\d{2}/\d{4}", text):
        try:
            return datetime.strptime(text, "%d/%m/%Y").date()
        except ValueError:
            return None
    # DD/MM/YY -> 20YY
    if re.fullmatch(r"\d{2}/\d{2}/\d{2}", text):
        try:
            parsed = datetime.strptime(text, "%d/%m/%y").date()
            if parsed.year < 2000:
                parsed = parsed.replace(year=parsed.year + 100)
            return parsed
        except ValueError:
            return None
    # MM/YYYY -> dia 1
    if re.fullmatch(r"\d{2}/\d{4}", text):
        try:
            return datetime.strptime("01/" + text, "%d/%m/%Y").date()
        except ValueError:
            return None
    return None


def is_generic_object(object_signature: str) -> bool:
    """True se signature vazia, com menos de 3 palavras ou so com termos genericos."""
    if not object_signature:
        return True
    parts = [p for p in object_signature.split("_") if p]
    if len(parts) < 3:
        return True
    if all(part in _GENERIC_TOKENS for part in parts):
        return True
    return False


def _sha1(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def build_bid_signature(
    city_id: Any,
    bid_number_normalized: str,
    process_number_normalized: str,
    modality: str,
    event_date: date | None,
) -> str:
    city = str(city_id or "")
    year = event_date.year if event_date else ""
    if bid_number_normalized:
        base = f"bid|{city}|{bid_number_normalized}|{modality or ''}"
    else:
        base = f"bid-fallback|{city}|{process_number_normalized or ''}|{modality or ''}|{year}"
    return _sha1(base)


def build_contract_signature(
    city_id: Any,
    contract_number_normalized: str,
    supplier_entity_id: Any,
    start_date: date | None,
    contract_value: float | None,
) -> str:
    city = str(city_id or "")
    supplier = str(supplier_entity_id or "")
    if contract_number_normalized and supplier:
        base = f"contract|{city}|{contract_number_normalized}|{supplier}"
    elif contract_number_normalized:
        base = f"contract|{city}|{contract_number_normalized}"
    else:
        start = start_date.isoformat() if start_date else ""
        value = f"{float(contract_value or 0):.2f}"
        base = f"contract-fallback|{city}|{supplier}|{start}|{value}"
    return _sha1(base)


def build_payment_signature(
    city_id: Any,
    payment_number_normalized: str,
    contract_number_normalized: str,
    supplier_entity_id: Any,
    payment_date: date | None,
    payment_value: float | None,
) -> str:
    city = str(city_id or "")
    supplier = str(supplier_entity_id or "")
    if payment_number_normalized:
        base = f"payment|{city}|{payment_number_normalized}"
    else:
        day = payment_date.isoformat() if payment_date else ""
        value = f"{float(payment_value or 0):.2f}"
        base = (
            f"payment-fallback|{city}|{supplier}|"
            f"{contract_number_normalized or ''}|{day}|{value}"
        )
    return _sha1(base)


_STATUS_ORDER = {"unlinked": 0, "linked_probable": 1, "linked_exact": 2}


def is_stronger_link_status(new_status: str, current_status: str) -> bool:
    return _STATUS_ORDER.get(new_status or "unlinked", 0) > _STATUS_ORDER.get(
        current_status or "unlinked", 0
    )


def summarize_link_reason(basis: str, score: float, details: dict | None = None) -> str:
    details = details or {}
    if basis == "bid_number_match":
        return "Numero da licitacao confere com a do contrato."
    if basis == "contract_number_match":
        return "Numero do contrato confere com o do pagamento."
    if basis == "supplier_city_object":
        return "Fornecedor, cidade e objeto compatíveis."
    if basis == "supplier_city_window":
        return "Fornecedor e cidade compatíveis dentro do período do contrato."
    if basis == "ambiguous":
        return "Varios candidatos compatíveis, vinculo nao pode ser confirmado."
    if basis == "no_bid_number":
        return "Sem numero da licitacao informado."
    if basis == "no_contract_number":
        return "Sem numero do contrato informado."
    if score and score >= 0.9:
        return "Vinculo direto encontrado."
    return "Sem correspondencia suficiente."


def _days_between(a: date | None, b: date | None) -> int | None:
    if not a or not b:
        return None
    return abs((a - b).days)


def _modality_compatible(m1: str, m2: str) -> bool:
    n1 = (m1 or "").strip().lower()
    n2 = (m2 or "").strip().lower()
    if not n1 or not n2:
        return True  # quando faltam dados, nao penalize
    return n1 == n2


def _value_in_range(target: float | None, reference: float | None, tolerance: float = 0.25) -> bool:
    if not target or not reference:
        return True
    if reference <= 0:
        return True
    diff = abs(target - reference) / reference
    return diff <= tolerance


def classify_contract_bid_link(contract: dict, bid: dict) -> dict:
    """Classifica o vinculo contrato -> licitacao."""
    contract_city = contract.get("city_id")
    bid_city = bid.get("city_id")
    if contract_city and bid_city and contract_city != bid_city:
        return {"status": "unlinked", "basis": "city_mismatch", "score": 0.0,
                "reason": summarize_link_reason("city_mismatch", 0.0)}

    c_bid_norm = contract.get("bid_number_normalized") or ""
    b_bid_norm = bid.get("bid_number_normalized") or ""
    if c_bid_norm and b_bid_norm and c_bid_norm == b_bid_norm:
        return {
            "status": "linked_exact",
            "basis": "bid_number_match",
            "score": 1.0,
            "reason": summarize_link_reason("bid_number_match", 1.0),
        }

    obj_c = contract.get("object_signature") or ""
    obj_b = bid.get("object_signature") or ""
    if obj_c and obj_b and obj_c == obj_b and not is_generic_object(obj_c):
        if _modality_compatible(contract.get("modality") or "", bid.get("modality") or ""):
            bid_event = bid.get("event_date")
            contract_start = contract.get("start_date")
            window_ok = True
            if bid_event and contract_start:
                if bid_event > contract_start:
                    window_ok = False
                else:
                    diff = _days_between(bid_event, contract_start)
                    window_ok = diff is not None and diff <= 365
            if window_ok:
                reference = bid.get("awarded_value") or bid.get("estimated_value")
                if _value_in_range(contract.get("contract_value"), reference):
                    return {
                        "status": "linked_probable",
                        "basis": "supplier_city_object",
                        "score": 0.7,
                        "reason": summarize_link_reason("supplier_city_object", 0.7),
                    }

    basis = "no_bid_number" if not c_bid_norm else "unmatched"
    return {"status": "unlinked", "basis": basis, "score": 0.0,
            "reason": summarize_link_reason(basis, 0.0)}


def classify_payment_contract_link(payment: dict, contract: dict) -> dict:
    """Classifica o vinculo pagamento -> contrato."""
    p_city = payment.get("city_id")
    c_city = contract.get("city_id")
    if p_city and c_city and p_city != c_city:
        return {"status": "unlinked", "basis": "city_mismatch", "score": 0.0,
                "reason": summarize_link_reason("city_mismatch", 0.0)}

    p_cnum = payment.get("contract_number_normalized") or ""
    c_cnum = contract.get("contract_number_normalized") or ""
    if p_cnum and c_cnum and p_cnum == c_cnum:
        return {
            "status": "linked_exact",
            "basis": "contract_number_match",
            "score": 1.0,
            "reason": summarize_link_reason("contract_number_match", 1.0),
        }

    p_supplier = payment.get("supplier_entity_id")
    c_supplier = contract.get("supplier_entity_id")
    if p_supplier and c_supplier and p_supplier == c_supplier:
        p_date = payment.get("payment_date")
        c_start = contract.get("start_date")
        c_end = contract.get("end_date")
        if p_date and c_start:
            lower = c_start - timedelta(days=7)
            if c_end:
                upper = c_end + timedelta(days=60)
            else:
                upper = c_start + timedelta(days=365)
            if lower <= p_date <= upper:
                return {
                    "status": "linked_probable",
                    "basis": "supplier_city_window",
                    "score": 0.7,
                    "reason": summarize_link_reason("supplier_city_window", 0.7),
                }

    basis = "no_contract_number" if not p_cnum else "unmatched"
    return {"status": "unlinked", "basis": basis, "score": 0.0,
            "reason": summarize_link_reason(basis, 0.0)}


def classify_payment_bid_link(payment: dict, bid: dict) -> dict:
    """Classifica o vinculo direto pagamento -> licitacao (quando informado)."""
    p_city = payment.get("city_id")
    b_city = bid.get("city_id")
    if p_city and b_city and p_city != b_city:
        return {"status": "unlinked", "basis": "city_mismatch", "score": 0.0,
                "reason": summarize_link_reason("city_mismatch", 0.0)}

    p_bid = payment.get("bid_number_normalized") or ""
    b_bid = bid.get("bid_number_normalized") or ""
    if p_bid and b_bid and p_bid == b_bid:
        return {
            "status": "linked_exact",
            "basis": "bid_number_match",
            "score": 1.0,
            "reason": summarize_link_reason("bid_number_match", 1.0),
        }

    obj_p = payment.get("object_signature") or ""
    obj_b = bid.get("object_signature") or ""
    p_supplier = payment.get("supplier_entity_id")
    b_supplier = bid.get("winner_entity_id")
    if (
        p_supplier
        and b_supplier
        and p_supplier == b_supplier
        and obj_p
        and obj_b
        and obj_p == obj_b
        and not is_generic_object(obj_p)
    ):
        return {
            "status": "linked_probable",
            "basis": "supplier_city_object",
            "score": 0.6,
            "reason": summarize_link_reason("supplier_city_object", 0.6),
        }

    basis = "no_bid_number" if not p_bid else "unmatched"
    return {"status": "unlinked", "basis": basis, "score": 0.0,
            "reason": summarize_link_reason(basis, 0.0)}


__all__ = [
    "normalize_identifier",
    "normalize_object",
    "build_object_signature",
    "parse_factual_date",
    "is_generic_object",
    "build_bid_signature",
    "build_contract_signature",
    "build_payment_signature",
    "classify_contract_bid_link",
    "classify_payment_contract_link",
    "classify_payment_bid_link",
    "is_stronger_link_status",
    "summarize_link_reason",
]
