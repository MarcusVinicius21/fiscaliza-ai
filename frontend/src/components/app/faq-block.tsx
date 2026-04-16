const faqs = [
  {
    question: "O Fiscaliza.AI prova fraude sozinho?",
    answer:
      "Não. Ele mostra sinais que exigem explicação e guarda a origem para checagem humana.",
  },
  {
    question: "Por que escolher a categoria certa?",
    answer:
      "Porque contrato, folha, despesa e licitação têm campos e leituras diferentes.",
  },
  {
    question: "O que é raw_json?",
    answer:
      "É a linha original do arquivo, preservada para rastrear a origem do achado.",
  },
  {
    question: "A IA decide o resultado?",
    answer:
      "Não. A IA resume dados já calculados pelo backend e deve ser lida como apoio.",
  },
];

export function FaqBlock() {
  return (
    <section className="rounded-lg border border-[var(--invest-border)] bg-white p-5 shadow-[var(--invest-shadow-soft)]">
      <p className="invest-eyebrow">Ajuda rápida</p>
      <h2 className="mt-2 text-lg font-black text-[var(--invest-heading)]">
        Perguntas comuns
      </h2>
      <div className="mt-5 space-y-3">
        {faqs.map((faq) => (
          <details
            key={faq.question}
            className="group rounded-lg border border-[var(--invest-border)] bg-[#fbfcff] p-4 transition open:border-[rgba(49,92,255,0.32)]"
          >
            <summary className="flex list-none items-center justify-between gap-3 text-sm font-bold text-[var(--invest-heading)]">
              {faq.question}
              <span className="text-[var(--invest-primary)] transition group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-6 text-[var(--invest-muted)]">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
