"use client";

import { StatusPill } from "@/components/app/status-pill";

export type ChainStatus = "linked_exact" | "linked_probable" | "unlinked" | string;

type Tone = "info" | "warning" | "muted" | "success" | "danger";

const MAP: Record<string, { tone: Tone; label: string }> = {
  linked_exact: { tone: "success", label: "Vínculo factual" },
  linked_probable: { tone: "warning", label: "Vínculo provável" },
  unlinked: { tone: "muted", label: "Sem vínculo factual encontrado" },
};

export function ChainStatusBadge({ status }: { status: ChainStatus }) {
  const entry = MAP[status] || { tone: "muted" as Tone, label: "Estado desconhecido" };
  return <StatusPill tone={entry.tone}>{entry.label}</StatusPill>;
}
