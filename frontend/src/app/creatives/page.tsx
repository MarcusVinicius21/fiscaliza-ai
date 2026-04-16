import Link from "next/link";

export default function CreativesPage() {
  return (
    <div className="page-shell">
      <section className="page-header p-6 md:p-8">
        <p className="invest-eyebrow">Comunicação pública</p>
        <h1 className="invest-title mt-3 max-w-4xl text-3xl md:text-5xl">
          Transforme um alerta em peça clara e rastreável.
        </h1>
        <p className="invest-subtitle mt-4 max-w-3xl text-base">
          A arte nasce dentro do detalhe de um alerta, para preservar fonte,
          contexto e responsabilidade editorial.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-[var(--invest-border)] bg-white p-6 shadow-[var(--invest-shadow-soft)]">
          <p className="invest-eyebrow">Fluxo seguro</p>
          <h2 className="mt-2 text-xl font-black text-[var(--invest-heading)]">
            Comece por um alerta real
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              ["1", "Abra Alertas"],
              ["2", "Entre no detalhe"],
              ["3", "Clique em Gerar arte"],
            ].map(([number, text]) => (
              <div
                key={number}
                className="rounded-lg border border-[var(--invest-border)] bg-[#fbfcff] p-4"
              >
                <p className="invest-number text-2xl font-black text-[var(--invest-primary)]">
                  {number}
                </p>
                <p className="mt-2 text-sm font-bold text-[var(--invest-heading)]">
                  {text}
                </p>
              </div>
            ))}
          </div>
          <Link href="/alerts" className="invest-button mt-6 w-fit px-5 py-2 text-sm">
            Ver alertas
          </Link>
        </div>

        <aside className="evidence-card p-6">
          <p className="invest-eyebrow">Regra editorial</p>
          <h2 className="mt-2 text-lg font-black text-[var(--invest-heading)]">
            Forte, mas responsável
          </h2>
          <p className="mt-4 text-sm leading-6 text-[var(--invest-muted)]">
            A arte pode apontar um sinal forte de alerta, mas não declara crime
            sem prova. Ela sempre leva a origem junto.
          </p>
        </aside>
      </section>
    </div>
  );
}
