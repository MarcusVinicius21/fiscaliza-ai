"""Helpers compartilhados de resiliencia para consultas ao Supabase/PostgREST.

Mantem o padrao de retry/backoff fora dos routers para evitar `.execute()`
solto em cada rota nova da Etapa D.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Callable

import httpx
from fastapi import HTTPException

try:
    from app.routers.entities import supabase
except ModuleNotFoundError:  # pragma: no cover
    from backend.app.routers.entities import supabase

logger = logging.getLogger(__name__)

RETRYABLE_HTTP_ERRORS = (
    httpx.RemoteProtocolError,
    httpx.ReadTimeout,
    httpx.ConnectError,
)
DEFAULT_BACKOFF_SECONDS = (0.2, 0.5, 0.9)


class UpstreamQueryError(RuntimeError):
    def __init__(
        self,
        operation: str,
        chunk_index: int,
        total_chunks: int,
        attempts: int,
        last_error: Exception,
    ) -> None:
        self.operation = operation
        self.chunk_index = chunk_index
        self.total_chunks = total_chunks
        self.attempts = attempts
        self.last_error = last_error
        super().__init__(
            f"Falha temporaria ao consultar {operation} "
            f"(chunk {chunk_index}/{total_chunks}) apos {attempts} tentativa(s)."
        )


def execute_with_retry(
    build_query: Callable[[], Any],
    operation_name: str,
    max_attempts: int = 3,
    chunk_index: int = 1,
    total_chunks: int = 1,
):
    """Executa uma query do client Supabase com retry curto e backoff pequeno."""
    last_error: Exception | None = None
    delays = list(DEFAULT_BACKOFF_SECONDS[:max_attempts])
    if len(delays) < max_attempts:
        delays.extend([DEFAULT_BACKOFF_SECONDS[-1]] * (max_attempts - len(delays)))

    for attempt in range(1, max_attempts + 1):
        try:
            return build_query().execute()
        except RETRYABLE_HTTP_ERRORS as exc:
            last_error = exc
            logger.warning(
                "Retryable Supabase error on %s chunk %s/%s attempt %s: %s",
                operation_name,
                chunk_index,
                total_chunks,
                attempt,
                exc,
            )
        except httpx.HTTPError as exc:
            last_error = exc
            logger.warning(
                "HTTP Supabase error on %s chunk %s/%s attempt %s: %s",
                operation_name,
                chunk_index,
                total_chunks,
                attempt,
                exc,
            )

        if attempt < max_attempts:
            time.sleep(delays[attempt - 1])

    raise UpstreamQueryError(
        operation_name,
        chunk_index,
        total_chunks,
        max_attempts,
        last_error or RuntimeError("unknown"),
    )


def _chunked(values: list[str], chunk_size: int = 50) -> list[list[str]]:
    return [values[index:index + chunk_size] for index in range(0, len(values), chunk_size)]


def select_in_chunks(
    table_name: str,
    ids: list[str],
    id_column: str = "id",
    chunk_size: int = 50,
    select: str = "*",
) -> list[dict]:
    """Seleciona linhas em lotes para evitar URLs grandes e falhas intermitentes."""
    values = [str(value) for value in ids if str(value or "").strip()]
    if not values:
        return []

    rows: list[dict] = []
    chunks = _chunked(values, chunk_size=chunk_size)
    total_chunks = len(chunks)

    for chunk_index, chunk in enumerate(chunks, start=1):
        response = execute_with_retry(
            lambda chunk_values=chunk: supabase.table(table_name).select(select).in_(id_column, chunk_values),
            table_name,
            chunk_index=chunk_index,
            total_chunks=total_chunks,
        )
        rows.extend(response.data or [])

    return rows


def raise_upstream_http_error(message: str) -> None:
    raise HTTPException(status_code=503, detail=message)


def is_missing_table_error(error: Exception) -> bool:
    message = str(error or "")
    return "Could not find the table" in message or "schema cache" in message


def raise_missing_schema_http_error() -> None:
    raise HTTPException(
        status_code=503,
        detail="A camada factual da Etapa D ainda nao foi aplicada no banco. Execute a migration e tente novamente.",
    )


__all__ = [
    "UpstreamQueryError",
    "execute_with_retry",
    "is_missing_table_error",
    "raise_missing_schema_http_error",
    "raise_upstream_http_error",
    "select_in_chunks",
    "supabase",
]
