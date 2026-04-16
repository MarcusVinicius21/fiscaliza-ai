"use client";

import { HelpPanel } from "@/components/app/help-panel";
import { InlineToast } from "@/components/app/inline-toast";
import { ProgressSteps } from "@/components/app/progress-steps";
import { UploadCategory, categoryInfo } from "@/lib/category-detector";

const steps = [
  { label: "Arquivo", description: "Escolha a base pública" },
  { label: "Categoria", description: "Confirme o tipo certo" },
  { label: "Prévia", description: "Confira os campos" },
  { label: "Enviar", description: "Use o fluxo validado" },
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
        <section className="rounded-lg border border-[var(--invest-border)] bg-white p-5 shadow-[var(--invest-shadow-soft)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="invest-eyebrow">Escolha guiada</p>
              <h2 className="mt-2 text-xl font-black text-[var(--invest-heading)]">
                Que tipo de arquivo é este?
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--invest-muted)]">
                A sugestão olha apenas os cabeçalhos. Ela ajuda, mas você
                confirma a categoria antes do envio.
              </p>
            </div>

            {suggestedCategory && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                  Sugestão
                </p>
                <p className="mt-1 text-sm font-black text-blue-950">
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
                    "min-h-[148px] rounded-lg border p-4 text-left transition duration-200",
                    selected
                      ? "border-[rgba(49,92,255,0.62)] bg-[#f2f5ff] shadow-[0_16px_30px_rgba(49,92,255,0.1)]"
                      : "border-[var(--invest-border)] bg-white hover:border-[rgba(49,92,255,0.34)] hover:bg-[#fbfcff]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-black text-[var(--invest-heading)]">
                      {info.label}
                    </span>
                    {suggested && (
                      <span className="app-chip border-blue-200 bg-blue-50 text-blue-700">
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

        <HelpPanel title={activeInfo.label} eyebrow="Categoria">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                Quando usar
              </p>
              <p className="mt-1">{activeInfo.whenToUse}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                O sistema ajuda a ver
              </p>
              <ul className="mt-2 space-y-2">
                {activeInfo.detects.map((item) => (
                  <li
                    key={item}
                    className="rounded-md border border-[var(--invest-border)] bg-[#fbfcff] px-3 py-2"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </HelpPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-[var(--invest-border)] bg-white p-5 shadow-[var(--invest-shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="invest-eyebrow">Prévia</p>
              <h2 className="mt-2 text-lg font-black text-[var(--invest-heading)]">
                Campos encontrados no arquivo
              </h2>
            </div>
            {file && <span className="app-chip">{file.name}</span>}
          </div>

          {previewHeaders.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {previewHeaders.slice(0, 18).map((header) => (
                <span
                  key={header}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700"
                >
                  {header}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-[var(--invest-muted)]">
              Selecione um CSV para ver os primeiros campos. Excel continua
              aceito; a prévia automática depende de cabeçalho textual.
            </p>
          )}
        </section>

        <div className="space-y-4">
          {file && (
            <InlineToast
              title="Arquivo selecionado"
              message={`Base pronta para revisão: ${file.name}`}
              tone="info"
            />
          )}

          {suggestedCategory && (
            <InlineToast
              title="Sugestão não obrigatória"
              message={`${categoryInfo[suggestedCategory].label} parece compatível. Confirme antes de enviar.`}
              tone="success"
            />
          )}
        </div>
      </div>
    </div>
  );
}
