const RAW_ERROR_PATTERN =
  /failed to fetch|remoteprotocolerror|server disconnected|traceback|httpx|networkerror|load failed|typeerror/i;

export function safeDetail(payload: unknown, fallback: string): string {
  const detail =
    payload && typeof payload === "object" && "detail" in payload &&
    typeof (payload as { detail?: unknown }).detail === "string"
      ? String((payload as { detail?: string }).detail).trim()
      : "";
  if (!detail) return fallback;
  if (RAW_ERROR_PATTERN.test(detail)) return fallback;
  return detail;
}

export function safeNetworkMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = String(error.message || "").trim();
    if (message && !RAW_ERROR_PATTERN.test(message)) return message;
  }
  return fallback;
}
