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
      "Para bases de contratos, termos, fornecedores, vigência, objeto, fiscais e modalidade.",
    whenToUse:
      "Use quando cada linha descreve contrato, aditivo, termo, ata ou vínculo formal com fornecedor.",
    detects: [
      "concentração de valor contratado",
      "repetições contratuais relevantes",
      "contexto por modalidade e tipo de ato",
    ],
    examples: ["numero_contrato", "objeto", "vigencia", "fornecedor"],
  },
  payroll: {
    label: "Pessoal / RH",
    description:
      "Para folha, salários, cargos, servidores, matrículas, diárias e remuneração.",
    whenToUse:
      "Use quando a base descreve pessoas, vínculos funcionais, remuneração ou cargos.",
    detects: [
      "valores individuais atípicos",
      "concentrações por servidor",
      "padrões de remuneração",
    ],
    examples: ["servidor", "cargo", "salario", "remuneracao"],
  },
  expenses: {
    label: "Despesas / Pagamentos",
    description:
      "Para pagamentos, empenhos, liquidações, credores e despesas pagas.",
    whenToUse:
      "Use quando a base descreve fluxo financeiro executado ou valores pagos a credores.",
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
      "Para pregões, dispensas, modalidades, certames, lotes e processos licitatórios.",
    whenToUse:
      "Use quando o arquivo descreve etapa anterior à contratação ou disputa pública.",
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
      "Para bases auxiliares que ainda não se encaixam nas categorias principais.",
    whenToUse:
      "Use como opção provisória quando os campos não deixam clara a natureza do arquivo.",
    detects: [
      "resumos básicos",
      "campos preservados para rastreabilidade",
      "análise genérica inicial",
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
