export type UploadCategory =
  | "contracts"
  | "payroll"
  | "expenses"
  | "bids"
  | "others";

export const categoryInfo: Record<
  UploadCategory,
  {
    label: string;
    description: string;
    whenToUse: string;
    detects: string[];
    examples: string[];
  }
> = {
  contracts: {
    label: "Contratos",
    description:
      "Use para contratos, atas, termos, fornecedores, vigência, objeto e modalidade.",
    whenToUse:
      "Escolha quando o arquivo fala de contratação formal, ata, termo, aditivo ou vínculo com fornecedor.",
    detects: [
      "valor contratado concentrado em fornecedor",
      "contratos repetidos que merecem apuração",
      "modalidade, tipo de ato e situação do contrato",
    ],
    examples: ["numero_contrato", "objeto", "vigencia", "fornecedor"],
  },
  payroll: {
    label: "Pessoal / RH",
    description:
      "Use para servidores, cargos, matrículas, folha, salários, diárias e remuneração.",
    whenToUse:
      "Escolha quando cada linha descreve pessoa, vínculo funcional, cargo ou pagamento de pessoal.",
    detects: [
      "valores individuais fora do padrão",
      "concentração por servidor",
      "padrões básicos de remuneração",
    ],
    examples: ["servidor", "cargo", "salario", "remuneracao"],
  },
  expenses: {
    label: "Despesas / Pagamentos",
    description:
      "Use para empenhos, liquidações, pagamentos, credores e despesas pagas.",
    whenToUse:
      "Escolha quando a base mostra dinheiro executado ou pago a credores.",
    detects: [
      "pagamentos repetidos",
      "concentração por credor",
      "maiores despesas individuais",
    ],
    examples: ["empenho", "pagamento", "credor", "valor_pago"],
  },
  bids: {
    label: "Licitações",
    description:
      "Use para pregões, dispensas, certames, lotes, processos e modalidades.",
    whenToUse:
      "Escolha quando o arquivo descreve a disputa pública antes da contratação.",
    detects: [
      "modalidades concentradas",
      "valores por certame",
      "padrões básicos de competição",
    ],
    examples: ["licitacao", "pregao", "modalidade", "processo"],
  },
  others: {
    label: "Outros",
    description:
      "Use quando a base ainda não se encaixa com clareza nas categorias principais.",
    whenToUse:
      "Escolha como opção provisória quando os campos não deixam clara a natureza do arquivo.",
    detects: [
      "resumo inicial",
      "campos preservados para rastreabilidade",
      "leitura genérica sem reclassificar a base",
    ],
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

  add("contracts", [
    "contrato",
    "vigencia",
    "vigência",
    "objeto",
    "fornecedor",
    "fiscal",
    "ata",
    "aditivo",
  ]);
  add("payroll", [
    "servidor",
    "cargo",
    "salario",
    "salário",
    "remuneracao",
    "remuneração",
    "matricula",
    "matrícula",
  ]);
  add("expenses", [
    "empenho",
    "pagamento",
    "liquidacao",
    "liquidação",
    "credor",
    "despesa",
  ]);
  add("bids", [
    "licitacao",
    "licitação",
    "pregao",
    "pregão",
    "dispensa",
    "modalidade",
    "certame",
  ]);

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
