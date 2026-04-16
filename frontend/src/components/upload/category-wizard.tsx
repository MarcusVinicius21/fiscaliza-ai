"use client";

import { HelpPanel } from "@/components/app/help-panel";
import { InlineToast } from "@/components/app/inline-toast";
import { ProgressSteps } from "@/components/app/progress-steps";
import { UploadCategory, categoryInfo } from "@/lib/category-detector";

const steps = [
  { label: "Arquivo", description: "Escolha a base pública" },
  { label: "Categoria", description: "Valide o tipo do dado" },
  { label: "Prévia", description: "Confira os cabeçalhos" },
  { label: "Processar", description: "Envie para o fluxo validado" },
];

export function CategoryWizard({
  currentStep,
  file,
  category,
  suggestedCategory,
  previewHeaders,
  onCategoryChange,
}: {
  currentStep: number;
  file: File | null;
  category: UploadCategory | "";
  suggestedCategory: UploadCategory | "";
  previewHeaders: string[];
  onCategoryChange: (category: UploadCategory) => void;
}) {
  const activeCategory = (category || suggestedCategory || "contracts") as UploadCategory;
  const activeInfo = categoryInfo[activeCategory];

  return (
    <div className="space-y-5">
      <ProgressSteps steps={steps} current={currentStep} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <section className="invest-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="invest-eyebrow">Classificação assistida</p>
              <h2 className="mt-2 text-xl font-black text-white">
                Escolha a categoria sem mexer no ETL
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--invest-muted)]">
                A sugestão automática só interpreta os cabeçalhos do arquivo. A
                decisão final continua sendo sua e o backend recebe os mesmos
                campos já validados.
              </p>
            </div>

            {suggestedCategory && (
              <div className="rounded-lg border border-[rgba(125,211,252,0.34)] bg-[rgba(78,168,222,0.1)] px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-cyan)]">
                  Sugestão
                </p>
                <p className="mt-1 text-sm font-black text-white">
                  {categoryInfo[suggestedCategory].label}
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(Object.keys(categoryInfo) as UploadCategory[]).map((key) => {
              const info = categoryInfo[key];
              const selected = category === key;
              const suggested = suggestedCategory === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onCategoryChange(key)}
                  className={[
                    "group min-h-[148px] rounded-lg border p-4 text-left transition duration-200",
                    selected
                      ? "border-[rgba(125,211,252,0.72)] bg-[rgba(78,168,222,0.16)] shadow-[0_16px_36px_rgba(78,168,222,0.12)]"
                      : "border-[var(--invest-border)] bg-[rgba(3,7,18,0.35)] hover:border-[rgba(125,211,252,0.46)] hover:bg-[rgba(16,24,39,0.9)]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-black text-white">
                      {info.label}
                    </span>
                    {suggested && (
                      <span className="invest-chip border-[rgba(125,211,252,0.32)] text-[var(--invest-cyan)]">
                        sugerida
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[var(--invest-muted)]">
                    {info.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <HelpPanel title={activeInfo.label} eyebrow="Detalhe da categoria">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                Quando usar
              </p>
              <p className="mt-1">{activeInfo.whenToUse}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                O que o sistema consegue apoiar
              </p>
              <ul className="mt-2 space-y-2">
                {activeInfo.detects.map((item) => (
                  <li key={item} className="rounded-md border border-[var(--invest-border)] bg-[rgba(3,7,18,0.28)] px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </HelpPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="invest-card-solid p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="invest-eyebrow">Prévia do arquivo</p>
              <h2 className="mt-2 text-lg font-black text-white">
                Cabeçalhos identificados
              </h2>
            </div>
            {file && <span className="invest-chip">{file.name}</span>}
          </div>

          {previewHeaders.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {previewHeaders.slice(0, 18).map((header) => (
                <span
                  key={header}
                  className="rounded-full border border-[rgba(148,163,184,0.22)] bg-[rgba(3,7,18,0.45)] px-3 py-1.5 text-xs font-bold text-[#d8e2f0]"
                >
                  {header}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-[var(--invest-muted)]">
              Selecione um CSV para visualizar os primeiros campos. Arquivos
              Excel continuam aceitos, mas a prévia automática usa o cabeçalho
              textual quando disponível.
            </p>
          )}
        </section>

        <div className="space-y-4">
          {file && (
            <InlineToast
              title="Arquivo pronto para revisão"
              message={`Base selecionada: ${file.name}`}
              tone="info"
            />
          )}

          {suggestedCategory && (
            <InlineToast
              title="Sugestão não vinculante"
              message={`${categoryInfo[suggestedCategory].label} parece compatível. Confirme antes de enviar.`}
              tone="success"
            />
          )}
        </div>
      </div>
    </div>
  );
}
