"use client";

import Link from "next/link";
import { ConfidenceBadge } from "./confidence-badge";
import { StatusPill } from "./status-pill";

interface CrossRefEntity {
  id: string;
  entity_type: string;
  canonical_name: string;
  document?: string | null;
}

interface CrossRefEvidence {
  shared_document?: string | null;
  shared_normalized_name?: string | null;
  from_roles?: string[];
  to_roles?: string[];
  shared_uploads?: string[];
  shared_city_ids?: string[];
  alias_references?: string[];
  notes?: string[];
}

export interface CrossRefCardItem {
  id: string;
  cross_ref_type: string;
  confidence_label: string;
  confidence_score: number;
  match_basis: string;
  reason_summary: string;
  evidence_payload?: CrossRefEvidence;
  counterpart?: CrossRefEntity | null;
  left_entity?: CrossRefEntity | null;
  right_entity?: CrossRefEntity | null;
}

function formatDocument(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return value || "Sem documento";
}

function typeLabel(value?: string | null) {
  if (value === "role_conflict") return "Conflito de papel";
  if (value === "same_person_candidate") return "Mesma pessoa em bases distintas";
  if (value === "homonym_candidate") return "Homonimo ou nome repetido";
  return "Cruzamento tecnico";
}

function basisLabel(value?: string | null) {
  if (value === "document_exact") return "Documento igual";
  if (value === "document_and_role") return "Documento + papel";
  if (value === "name_normalized") return "Nome normalizado";
  if (value === "alias_cross") return "Alias cruzado";
  if (value === "name_similar_family") return "Nome parecido por familia";
  return "Base tecnica";
}

function entityTypeLabel(value?: string | null) {
  if (value === "server") return "Servidor";
  if (value === "person") return "Pessoa";
  if (value === "supplier") return "Fornecedor";
  if (value === "organization") return "Organização";
  return "Entidade";
}

function roleLabel(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  const map: Record<string, string> = {
    supplier: "fornecedor",
    creditor: "credor",
    contracted_party: "contratado",
    beneficiary: "beneficiário",
    server: "servidor",
    person: "pessoa",
    other: "outro",
  };
  return map[normalized] || normalized;
}

function formatRoleList(values?: string[] | null) {
  if (!values || values.length === 0) return "";
  const seen = new Set<string>();
  const labels: string[] = [];
  values.forEach((value) => {
    const label = roleLabel(value);
    if (label && !seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  });
  return labels.slice(0, 3).join(", ");
}

function entityHref(entity?: CrossRefEntity | null) {
  if (!entity?.id) return "#";
  return entity.entity_type === "person" || entity.entity_type === "server"
    ? `/pessoas/${entity.id}`
    : `/fornecedores/${entity.id}`;
}

function primaryEvidence(item: CrossRefCardItem) {
  const evidence = item.evidence_payload || {};
  if (evidence.shared_document) {
    return `Mesmo documento nas duas bases: ${formatDocument(evidence.shared_document)}.`;
  }
  if (evidence.alias_references && evidence.alias_references.length > 0) {
    return `Alias em comum observado: ${evidence.alias_references.slice(0, 2).join(", ")}.`;
  }
  if (evidence.shared_uploads && evidence.shared_uploads.length > 0) {
    const total = evidence.shared_uploads.length;
    return `Aparece em ${total} upload${total === 1 ? "" : "s"} em comum.`;
  }
  if (evidence.shared_normalized_name) {
    return "Nome normalizado é idêntico. Pode ser a mesma pessoa ou um homônimo — precisa de apuração humana.";
  }
  return "Cruzamento técnico gerado para orientar apuração humana. Nenhuma conclusão automática é feita aqui.";
}

export function CrossRefCard({
  item,
  primaryEntityId,
}: {
  item: CrossRefCardItem;
  primaryEntityId?: string;
}) {
  const counterpart =
    item.counterpart ||
    (primaryEntityId && item.left_entity?.id === primaryEntityId
      ? item.right_entity
      : primaryEntityId && item.right_entity?.id === primaryEntityId
        ? item.left_entity
        : item.right_entity || item.left_entity);
  const isConflict = item.cross_ref_type === "role_conflict";

  return (
    <article className={isConflict ? "evidence-card p-5" : "invest-card-highlight p-5"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="invest-eyebrow">{typeLabel(item.cross_ref_type)}</p>
          <p className="mt-2 text-base font-black text-[var(--invest-heading)]">
            {counterpart?.canonical_name || "Entidade relacionada"}
          </p>
          <p className="mt-1 text-sm text-[var(--invest-muted)]">
            {formatDocument(counterpart?.document)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={isConflict ? "warning" : "muted"}>
            {entityTypeLabel(counterpart?.entity_type)}
          </StatusPill>
          <ConfidenceBadge value={item.confidence_label} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="app-chip">{basisLabel(item.match_basis)}</span>
        <span className="app-chip">
          Score {Number(item.confidence_score || 0).toFixed(2)}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-[var(--invest-muted)]">
        {item.reason_summary || "Cruzamento técnico gerado para orientar apuração humana."}
      </p>

      <div className="mt-4 rounded-lg border border-[var(--invest-border)] bg-[var(--invest-surface-soft)] p-4">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
          Evidência principal
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--invest-muted)]">
          {primaryEvidence(item)}
        </p>
        {(item.evidence_payload?.from_roles?.length || item.evidence_payload?.to_roles?.length) ? (
          <p className="mt-3 text-xs leading-5 text-[var(--invest-faint)]">
            Papéis observados:{" "}
            {formatRoleList(item.evidence_payload?.from_roles) || "—"}
            {" × "}
            {formatRoleList(item.evidence_payload?.to_roles) || "—"}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--invest-faint)]">
          Exige apuração humana
        </p>
        {counterpart?.id ? (
          <Link href={entityHref(counterpart)} className="invest-button-secondary px-4">
            Abrir detalhe
          </Link>
        ) : null}
      </div>
    </article>
  );
}
