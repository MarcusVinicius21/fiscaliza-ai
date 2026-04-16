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
    <section className="rounded-md border border-[#2D3748] bg-[#141B2D] p-4">
      <h2 className="text-sm font-semibold text-white">Perguntas rápidas</h2>
      <div className="mt-4 space-y-3">
        {faqs.map((faq) => (
          <details
            key={faq.question}
            className="rounded-md border border-[#2D3748] p-3"
          >
            <summary className="cursor-pointer text-sm font-medium text-white">
              {faq.question}
            </summary>
            <p className="mt-2 text-sm text-[#CBD5E1]">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
