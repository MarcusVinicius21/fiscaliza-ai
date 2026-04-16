export type UploadCategory =
  | "contracts"
  | "payroll"
  | "expenses"
  | "bids"
  | "others";

export const categoryInfo: Record<
  UploadCategory,
  { label: string; description: string; examples: string[] }
> = {
  contracts: {
    label: "Contratos",
    description:
      "Use para contratos, termos, fornecedores, vigência, objeto e modalidade.",
    examples: ["numero_contrato", "objeto", "vigencia", "fornecedor"],
  },
  payroll: {
    label: "Pessoal / RH",
    description: "Use para folha, salários, cargos, servidores e remuneração.",
    examples: ["servidor", "cargo", "salario", "remuneracao"],
  },
  expenses: {
    label: "Despesas / Pagamentos",
    description: "Use para pagamentos, empenhos, liquidações e despesas pagas.",
    examples: ["empenho", "pagamento", "credor", "valor_pago"],
  },
  bids: {
    label: "Licitações",
    description:
      "Use para pregões, dispensas, modalidades e processos licitatórios.",
    examples: ["licitacao", "pregao", "modalidade", "processo"],
  },
  others: {
    label: "Outros",
    description:
      "Use quando o arquivo não se encaixa claramente nas categorias principais.",
    examples: ["arquivo diverso", "base auxiliar"],
  },
};

export function suggestCategoryFromHeaders(headers: string[]): UploadCategory {
  const normalized = headers.join(" ").toLowerCase();

  const score: Record<UploadCategory, number> = {
    contracts: 0,
    payroll: 0,
    expenses: 0,
    bids: 0,
    others: 0,
  };

  const add = (category: UploadCategory, tokens: string[]) => {
    for (const token of tokens) {
      if (normalized.includes(token)) score[category] += 1;
    }
  };

  add("contracts", ["contrato", "vigencia", "objeto", "fornecedor", "fiscal"]);
  add("payroll", ["servidor", "cargo", "salario", "remuneracao", "matricula"]);
  add("expenses", ["empenho", "pagamento", "liquidacao", "credor", "despesa"]);
  add("bids", ["licitacao", "pregao", "dispensa", "modalidade", "certame"]);

  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];

  if (!best || best[1] === 0) return "others";

  return best[0] as UploadCategory;
}

export function parseCsvPreview(text: string) {
  const firstLine = text.split(/\r?\n/).find(Boolean) || "";
  const separator = firstLine.includes(";")
    ? ";"
    : firstLine.includes("\t")
      ? "\t"
      : ",";

  return firstLine
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}
