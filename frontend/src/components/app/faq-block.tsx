const faqs = [
  {
    question: "O Fiscaliza.AI detecta fraude automaticamente?",
    answer:
      "Não. O sistema aponta indícios e pontos de atenção para investigação humana.",
  },
  {
    question: "Por que a categoria do upload importa?",
    answer:
      "Porque contratos, folha, despesas e licitações têm semânticas diferentes.",
  },
  {
    question: "O que é raw_json?",
    answer:
      "É a linha original preservada do arquivo, usada para rastreabilidade.",
  },
  {
    question: "A IA decide sozinha?",
    answer:
      "Não. A IA resume e interpreta dados já calculados pelo backend.",
  },
];

export function FaqBlock() {
  return (
    <section className="invest-card p-5">
      <p className="invest-eyebrow">Ajuda contextual</p>
      <h2 className="mt-2 text-lg font-black text-white">Perguntas rápidas</h2>
      <div className="mt-5 space-y-3">
        {faqs.map((faq) => (
          <details
            key={faq.question}
            className="group rounded-lg border border-[var(--invest-border)] bg-[rgba(3,7,18,0.34)] p-4 transition open:border-[rgba(125,211,252,0.36)]"
          >
            <summary className="flex list-none items-center justify-between gap-3 text-sm font-bold text-white">
              {faq.question}
              <span className="text-[var(--invest-cyan)] transition group-open:rotate-45">
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
