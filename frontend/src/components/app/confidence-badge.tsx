"use client";

import { StatusPill } from "./status-pill";

type ConfidenceLabel = "indicative" | "probable" | "confirmed";

const LABELS: Record<ConfidenceLabel, string> = {
  indicative: "Indício",
  probable: "Vínculo provável",
  confirmed: "Vínculo confirmado",
};

const DESCRIPTIONS: Record<ConfidenceLabel, string> = {
  indicative: "Indício técnico. O nome ou alias pede verificação humana.",
  probable: "Vínculo provável. O contexto reforça a semelhança, mas ainda exige apuração.",
  confirmed: "Vínculo confirmado por base objetiva, como documento em comum.",
};

const TONES: Record<ConfidenceLabel, "muted" | "warning" | "info"> = {
  indicative: "muted",
  probable: "warning",
  confirmed: "info",
};

export function ConfidenceBadge({
  value,
}: {
  value?: string | null;
}) {
  const normalized = (String(value || "").trim().toLowerCase() || "indicative") as ConfidenceLabel;
  const safeValue = normalized in LABELS ? normalized : "indicative";

  return (
    <span title={DESCRIPTIONS[safeValue]}>
      <StatusPill tone={TONES[safeValue]}>{LABELS[safeValue]}</StatusPill>
    </span>
  );
}
