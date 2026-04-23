"use client";

const BASIS_LABELS: Record<string, string> = {
  contract_number_match: "Numero do contrato",
  bid_number_match: "Numero da licitacao",
  supplier_city_window: "Fornecedor e periodo",
  supplier_city_object: "Fornecedor e objeto",
  via_contract: "Via contrato",
};

export function LinkBasisPill({
  basis,
  reason,
}: {
  basis?: string | null;
  reason?: string | null;
}) {
  if (!basis) return null;
  return (
    <span
      className="app-chip"
      title={reason || undefined}
    >
      {BASIS_LABELS[basis] || basis}
    </span>
  );
}
