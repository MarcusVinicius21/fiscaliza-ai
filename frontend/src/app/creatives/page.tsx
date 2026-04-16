import Link from "next/link";

export default function CreativesPage() {
  return (
    <div className="invest-page">
      <section className="invest-page-hero p-6 md:p-8">
        <p className="invest-eyebrow">Comunicação pública</p>
        <h1 className="invest-title mt-3 max-w-4xl text-3xl md:text-5xl">
          Ateliê de artes para alertas já validados.
        </h1>
        <p className="invest-subtitle mt-4 max-w-3xl text-base">
          A geração de arte começa dentro do detalhe de um alerta, preservando
          rastreabilidade e evitando peças soltas sem origem.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="invest-card p-6">
          <p className="invest-eyebrow">Como usar</p>
          <h2 className="mt-2 text-xl font-black text-white">
            Escolha um alerta antes de criar a peça
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              ["1", "Abra a fila de alertas"],
              ["2", "Entre no detalhe"],
              ["3", "Clique em Gerar arte"],
            ].map(([number, text]) => (
              <div
                key={number}
                className="rounded-lg border border-[var(--invest-border)] bg-[rgba(3,7,18,0.3)] p-4"
              >
                <p className="invest-number text-2xl font-black text-[var(--invest-cyan)]">
                  {number}
                </p>
                <p className="mt-2 text-sm font-bold text-white">{text}</p>
              </div>
            ))}
          </div>
          <Link href="/alerts" className="invest-button mt-6 w-fit px-5 py-2 text-sm">
            Ver alertas
          </Link>
        </div>

        <aside className="invest-card-highlight p-6">
          <p className="invest-eyebrow">Regra editorial</p>
          <h2 className="mt-2 text-lg font-black text-white">
            Comunicação responsável
          </h2>
          <p className="mt-4 text-sm leading-6 text-[var(--invest-muted)]">
            As peças não declaram fraude. Elas comunicam pontos de atenção com
            fonte, alerta de origem e linguagem pública simples.
          </p>
        </aside>
      </section>
    </div>
  );
}
