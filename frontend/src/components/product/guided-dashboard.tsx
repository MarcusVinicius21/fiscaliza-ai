"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export interface GuidedStep {
  number: string;
  title: string;
  description: string;
  href?: string;
  cta?: string;
  disabledReason?: string;
}

export interface DashboardSupplier {
  id: string;
  canonical_name: string;
  document?: string | null;
  total_amount: number;
  uploads_count?: number;
  records_count?: number;
  alerts_count?: number;
}

type DashboardIconName =
  | "document"
  | "users"
  | "report"
  | "upload"
  | "chart"
  | "ranking"
  | "supplier"
  | "shield"
  | "star"
  | "info";

function formatBRL(value?: number | null) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(safeValue);
}

function formatDocument(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return value || "documento não informado";
}

function DashboardVisualIcon({ name }: { name: DashboardIconName }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true,
    xmlns: "http://www.w3.org/2000/svg",
  };

  switch (name) {
    case "document":
      return (
        <svg {...common}>
          <path d="M7 3h6l4 4v14H7V3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M13 3v5h5M9 12h6M9 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM3 21a6 6 0 0 1 12 0M17 10a3 3 0 1 0 0-6M16 15a5 5 0 0 1 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "report":
      return (
        <svg {...common}>
          <path d="M6 3h8l4 4v14H6V3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M14 3v5h5M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M15 19h5v3h-5z" fill="currentColor" opacity="0.18" />
        </svg>
      );
    case "upload":
      return (
        <svg {...common}>
          <path d="M12 16V5M8 9l4-4 4 4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M5 19V9M12 19V5M19 19v-7M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M5 9l7-4 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
        </svg>
      );
    case "ranking":
      return (
        <svg {...common}>
          <path d="M6 20h12M8 20v-7h3v7M13 20V7h3v13M5 13l3-3 3 3M14 7l2-3 2 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "supplier":
      return (
        <svg {...common}>
          <path d="M4 21V9l8-5 8 5v12M8 21v-7h8v7M8 11h.01M12 11h.01M16 11h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 5 6v5c0 4.4 2.8 8.4 7 10 4.2-1.6 7-5.6 7-10V6l-7-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="m9 12 2 2 4-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path d="m12 3 2.5 5.3 5.8.7-4.2 4.1 1.1 5.8L12 16.1l-5.2 2.8 1.1-5.8L3.7 9l5.8-.7L12 3Z" fill="currentColor" />
        </svg>
      );
    case "info":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function ActionLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const classes =
    variant === "primary"
      ? "inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-black text-white shadow-[0_14px_28px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(37,99,235,0.28)]"
      : "inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-200 bg-white/78 px-4 py-2 text-sm font-black text-blue-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-white";

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

export function buildGuidedSteps(params: {
  uploadDiagnosticHref?: string;
  topSupplierHref?: string;
  topSupplierReportHref?: string;
}): GuidedStep[] {
  return [
    {
      number: "1",
      title: "Escolha o arquivo",
      description: "Selecione um arquivo já enviado ou envie um novo.",
      href: "/uploads",
      cta: "Ver arquivos",
    },
    {
      number: "2",
      title: "Veja o resumo",
      description: "Confira linhas, valores, alertas e o que chama atenção.",
      href: params.uploadDiagnosticHref,
      cta: "Ver resumo",
      disabledReason: "O resumo aparece depois que um arquivo for analisado.",
    },
    {
      number: "3",
      title: "Veja quem recebeu mais",
      description: "Abra a lista de fornecedores por maior valor.",
      href: "/fornecedores",
      cta: "Ver fornecedores",
    },
    {
      number: "4",
      title: "Abra o fornecedor",
      description: "Veja onde ele aparece, valores e alertas ligados a ele.",
      href: params.topSupplierHref,
      cta: "Abrir fornecedor",
      disabledReason: "Fornecedor disponível depois da análise do arquivo.",
    },
    {
      number: "5",
      title: "Gere o relat\u00f3rio",
      description: "Crie uma versão para imprimir ou salvar em PDF.",
      href: params.topSupplierReportHref,
      cta: "Abrir relatório",
      disabledReason: "Relatório disponível depois que um fornecedor for encontrado.",
    },
    {
      number: "6",
      title: "Confira com calma",
      description: "O sistema ajuda a organizar. A decisão final deve ser conferida por uma pessoa.",
    },
  ];
}

function DashboardHeroIllustration() {
  return (
    <div className="pointer-events-none relative hidden min-h-[248px] overflow-hidden rounded-[28px] border border-white/60 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] lg:block">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100/80 via-white/40 to-blue-200/70" />
      <svg
        viewBox="0 0 520 270"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Ilustração de análise de dados"
      >
        <defs>
          <linearGradient id="fiscalizaBlue" x1="0" x2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.75" />
          </linearGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="16" stdDeviation="18" floodColor="#1d4ed8" floodOpacity="0.18" />
          </filter>
        </defs>

        <g opacity="0.36">
          <path d="M18 40H502M18 100H502M18 160H502M18 220H502" stroke="#93c5fd" strokeWidth="1" />
          <path d="M80 12V252M180 12V252M280 12V252M380 12V252M480 12V252" stroke="#bfdbfe" strokeWidth="1" />
          <circle cx="42" cy="45" r="3" fill="#fff" />
          <circle cx="462" cy="44" r="3" fill="#fff" />
          <circle cx="492" cy="180" r="3" fill="#fff" />
        </g>

        <g filter="url(#softShadow)">
          <rect x="138" y="54" width="146" height="158" rx="20" fill="white" opacity="0.88" transform="rotate(6 211 133)" />
          <path d="M170 98H248M167 128H254M165 158H227" stroke="#2563eb" strokeWidth="10" strokeLinecap="round" opacity="0.65" transform="rotate(6 211 133)" />

          <circle cx="124" cy="106" r="38" fill="none" stroke="url(#fiscalizaBlue)" strokeWidth="16" />
          <path d="M152 134L194 176" stroke="#2563eb" strokeWidth="16" strokeLinecap="round" />

          <rect x="306" y="62" width="122" height="108" rx="18" fill="white" opacity="0.82" transform="rotate(-5 367 116)" />
          <path d="M333 141V116M368 141V90M403 141V104" stroke="#2563eb" strokeWidth="14" strokeLinecap="round" opacity="0.75" />
          <path d="M333 106L368 83L403 93" fill="none" stroke="#2563eb" strokeWidth="6" strokeLinecap="round" />

          <path d="M447 80L486 64L506 80V118C506 146 487 167 466 175C445 167 426 146 426 118V80Z" fill="#2563eb" opacity="0.9" />
          <path d="M451 119L463 131L487 104" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />

          <rect x="360" y="185" width="110" height="52" rx="16" fill="white" opacity="0.78" />
          <circle cx="390" cy="211" r="20" fill="none" stroke="#2563eb" strokeWidth="10" opacity="0.75" />
          <path d="M425 200H455M425 216H445" stroke="#2563eb" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
        </g>
      </svg>
    </div>
  );
}

export function GuidedDashboardHero({
  uploadName,
  uploadMeta,
  uploadHref,
  reportHref,
}: {
  uploadName?: string | null;
  uploadMeta?: string | null;
  uploadHref?: string;
  reportHref?: string;
}) {
  return (
    <section className="fiscaliza-product-light relative max-w-full overflow-hidden rounded-[30px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-100/80 p-5 shadow-[0_24px_70px_rgba(37,99,235,0.14)] md:p-7">
      <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(37,99,235,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.08)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="absolute right-[-120px] top-[-160px] h-80 w-80 rounded-full bg-blue-300/30 blur-3xl" />
      <div className="relative grid min-w-0 gap-7 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.9fr)] xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.9fr)] lg:items-center">
        <div className="max-w-3xl">
          <p className="inline-flex rounded-full bg-white/78 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-700 shadow-sm ring-1 ring-blue-100">
            Comece por aqui
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.03] tracking-[0] text-slate-950 md:text-5xl">
            {"Do arquivo ao relat\u00f3rio em poucos cliques"}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            {"O Fiscaliza.AI organiza os dados, mostra quem recebeu mais e ajuda voc\u00ea a conferir o que merece aten\u00e7\u00e3o."}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <ActionLink href={uploadHref || "/uploads"}>Ver resumo do arquivo</ActionLink>
            <ActionLink href="/fornecedores" variant="secondary">Ver fornecedores</ActionLink>
            <ActionLink href={reportHref || "/fornecedores"} variant="secondary">
              {"Gerar relat\u00f3rio"}
            </ActionLink>
          </div>

          <div className="mt-6 inline-flex max-w-full flex-col rounded-2xl border border-blue-100 bg-white/74 px-4 py-3 shadow-sm backdrop-blur">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Último arquivo analisado
            </span>
            <span className="mt-1 truncate text-sm font-black text-slate-950">
              {uploadName || "Envie ou selecione um arquivo para começar."}
            </span>
            {uploadMeta ? (
              <span className="mt-1 text-xs font-semibold text-slate-500">
                {uploadMeta}
              </span>
            ) : null}
          </div>
        </div>

        <DashboardHeroIllustration />
      </div>
    </section>
  );
}

export function DashboardActionCarousel({
  uploadHref,
  supplierHref = "/fornecedores",
  reportHref,
}: {
  uploadHref?: string;
  supplierHref?: string;
  reportHref?: string;
}) {
  const cards: Array<{
    title: string;
    description: string;
    href: string;
    icon: DashboardIconName;
    className: string;
    iconClassName: string;
  }> = [
    {
      title: "Resumo do arquivo",
      description: "Veja o que chama atenção",
      href: uploadHref || "/uploads",
      icon: "document",
      className: "from-blue-50 via-white to-blue-100/70 text-blue-700",
      iconClassName: "border-blue-100 bg-blue-50 text-blue-600",
    },
    {
      title: "Maiores fornecedores",
      description: "Descubra quem concentra mais valor",
      href: supplierHref,
      icon: "users",
      className: "from-emerald-50 via-white to-emerald-100/60 text-emerald-700",
      iconClassName: "border-emerald-100 bg-emerald-50 text-emerald-600",
    },
    {
      title: "Relatório para imprimir",
      description: "Leve a análise para reunião",
      href: reportHref || "/fornecedores",
      icon: "report",
      className: "from-violet-50 via-white to-violet-100/60 text-violet-700",
      iconClassName: "border-violet-100 bg-violet-50 text-violet-600",
    },
  ];

  return (
    <section className="fiscaliza-product-light relative max-w-full overflow-hidden rounded-[24px] border border-slate-200 bg-white/88 p-4 shadow-[0_16px_42px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="pointer-events-none absolute left-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-sm xl:flex">
        <span aria-hidden="true">&lt;</span>
      </div>
      <div className="pointer-events-none absolute right-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-sm xl:flex">
        <span aria-hidden="true">&gt;</span>
      </div>
      <div className="invest-soft-scroll flex max-w-full gap-4 overflow-x-auto px-0 pb-1 xl:px-10 2xl:px-14">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className={`group min-w-[240px] flex-1 rounded-[22px] border border-slate-200 bg-gradient-to-br p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(15,23,42,0.10)] ${card.className}`}
          >
            <div className="flex items-center gap-4">
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border shadow-sm ${card.iconClassName}`}>
                <DashboardVisualIcon name={card.icon} />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-black text-slate-950">
                  {card.title}
                </h3>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  {card.description}
                </p>
              </div>
              <span className="ml-auto text-xl font-black transition group-hover:translate-x-1">
                &gt;
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function stepIcon(stepNumber: string): DashboardIconName {
  const map: Record<string, DashboardIconName> = {
    "1": "upload",
    "2": "chart",
    "3": "ranking",
    "4": "supplier",
    "5": "report",
    "6": "shield",
  };
  return map[stepNumber] || "document";
}

export function GuidedInvestigationFlow({ steps }: { steps: GuidedStep[] }) {
  return (
    <section className="fiscaliza-product-light max-w-full overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.06)] sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-black text-slate-950">Use nesta ordem</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Um caminho simples para sair do arquivo e chegar ao relatório.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {steps.map((step, index) => (
          <div key={step.number} className="relative">
            {index < steps.length - 1 ? (
              <div className="absolute left-[calc(100%+0.35rem)] top-12 hidden w-[calc(100%-1.25rem)] border-t-2 border-dotted border-blue-200 xl:block" />
            ) : null}
            <article className="relative h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="absolute left-4 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white shadow-sm">
                {step.number}
              </div>
              <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <DashboardVisualIcon name={stepIcon(step.number)} />
              </div>
              <h3 className="mt-3 text-center text-sm font-black text-slate-950">
                {step.title}
              </h3>
              <p className="mt-2 text-center text-xs leading-5 text-slate-600">
                {step.description}
              </p>

              {step.href && step.cta ? (
                <Link
                  href={step.href}
                  className="mt-4 inline-flex w-full min-h-9 items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
                >
                  {step.cta}
                </Link>
              ) : step.disabledReason ? (
                <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs font-semibold leading-5 text-slate-500">
                  {step.disabledReason}
                </p>
              ) : null}
            </article>
          </div>
        ))}
      </div>
    </section>
  );
}

export function InvestigationSuggestionCard({
  supplier,
  uploadHref,
  supplierError,
}: {
  supplier?: DashboardSupplier | null;
  uploadHref?: string;
  supplierError?: string;
}) {
  if (supplierError) {
    return (
      <section className="fiscaliza-product-light rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Sugestão do Fiscaliza</p>
        <h2 className="mt-2 text-xl font-black text-slate-950">
          Não foi possível carregar os fornecedores agora.
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Você ainda pode abrir a busca e procurar por pessoa ou fornecedor.
        </p>
        <div className="mt-4">
          <ActionLink href="/fornecedores">Ver fornecedores</ActionLink>
        </div>
      </section>
    );
  }

  if (!supplier) {
    return (
      <section className="fiscaliza-product-light rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Sugestão do Fiscaliza</p>
        <h2 className="mt-2 text-xl font-black text-slate-950">
          Comece enviando ou escolhendo um arquivo.
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Assim que houver dados analisados, o Fiscaliza.AI mostra por onde começar.
        </p>
        <div className="mt-4">
          <ActionLink href="/uploads">Ver arquivos</ActionLink>
        </div>
      </section>
    );
  }

  return (
    <section className="fiscaliza-product-light grid gap-4 rounded-[24px] border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-blue-50 p-5 shadow-[0_16px_42px_rgba(37,99,235,0.10)] lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.42fr)_180px] lg:items-center">
      <div className="flex gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_14px_30px_rgba(37,99,235,0.25)]">
          <DashboardVisualIcon name="star" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-blue-700">Sugestão do Fiscaliza</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Fornecedor com maior valor encontrado
          </p>
          <h2 className="mt-1 truncate text-xl font-black text-slate-950">
            {supplier.canonical_name}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Fornecedor 360 · {formatDocument(supplier.document)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-white/72 p-4">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
          Valor total encontrado
        </p>
        <p className="mt-2 text-2xl font-black tabular-nums text-slate-950">
          {formatBRL(supplier.total_amount)}
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          {supplier.records_count ?? 0} linha(s) · {supplier.uploads_count ?? 0} arquivo(s)
        </p>
      </div>

      <div className="grid gap-2">
        {uploadHref ? (
          <ActionLink href={uploadHref} variant="secondary">Ver resumo</ActionLink>
        ) : null}
        <ActionLink href={`/fornecedores/${supplier.id}`}>
          Abrir fornecedor
        </ActionLink>
        <ActionLink href={`/relatorios/fornecedor/${supplier.id}`} variant="secondary">
          Abrir relatório
        </ActionLink>
      </div>
    </section>
  );
}

export function ResponsibleReadingCards() {
  return (
    <section className="fiscaliza-product-light grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
      <article className="rounded-[24px] border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
            <DashboardVisualIcon name="info" />
          </div>
          <div>
            <h2 className="text-base font-black text-orange-950">
              Leitura responsável
            </h2>
            <p className="mt-2 text-sm leading-6 text-orange-900">
              A análise depende da qualidade dos dados. Arquivos incompletos podem esconder informações importantes.
            </p>
            <Link href="/uploads" className="mt-3 inline-flex text-sm font-black text-blue-700 hover:underline">
              Ver dicas de qualidade -&gt;
            </Link>
          </div>
        </div>
      </article>

      <article className="rounded-[24px] border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-blue-50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
            <DashboardVisualIcon name="shield" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-950">
              Dados incompletos?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Quando o arquivo não traz número de contrato, pagamento ou processo, algumas ligações podem não aparecer automaticamente.
            </p>
          </div>
        </div>
      </article>
    </section>
  );
}
