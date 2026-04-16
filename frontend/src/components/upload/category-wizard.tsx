"use client";

import { HelpPanel } from "@/components/app/help-panel";
import { InlineToast } from "@/components/app/inline-toast";
import { ProgressSteps } from "@/components/app/progress-steps";
import { UploadCategory, categoryInfo } from "@/lib/category-detector";

const steps = [
  { label: "Arquivo", description: "Selecione a base" },
  { label: "Categoria", description: "Confirme o tipo" },
  { label: "Prévia", description: "Revise os campos" },
  { label: "Processar", description: "Enviar e analisar" },
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
  return (
    <div className="space-y-4">
      <ProgressSteps steps={steps} current={currentStep} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        <div className="rounded-md border border-[#2D3748] bg-[#141B2D] p-4">
          <p className="text-sm font-semibold text-white">
            Escolha guiada de categoria
          </p>
          <p className="mt-1 text-sm text-[#CBD5E1]">
            A categoria define como o Fiscaliza.AI interpreta o arquivo. Em caso
            de dúvida, use a sugestão automática apenas como apoio.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {(Object.keys(categoryInfo) as UploadCategory[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onCategoryChange(key)}
                className={[
                  "rounded-md border p-3 text-left transition",
                  category === key
                    ? "border-[#4EA8DE] bg-[#0C111F]"
                    : "border-[#2D3748] bg-[#141B2D] hover:border-[#4EA8DE]",
                ].join(" ")}
              >
                <span className="block text-sm font-semibold text-white">
                  {categoryInfo[key].label}
                </span>
                <span className="mt-1 block text-xs text-[#CBD5E1]">
                  {categoryInfo[key].description}
                </span>
              </button>
            ))}
          </div>
        </div>

        <HelpPanel title="Como escolher a categoria?">
          <ul className="space-y-2">
            <li>Contratos: objeto, vigência, fornecedor ou número de contrato.</li>
            <li>Pessoal/RH: servidor, matrícula, cargo ou remuneração.</li>
            <li>Despesas: empenho, credor, pagamento ou liquidação.</li>
            <li>Licitações: pregão, modalidade, certame ou processo.</li>
          </ul>
        </HelpPanel>
      </div>

      {file && (
        <InlineToast
          title="Arquivo selecionado"
          message={`Arquivo pronto para leitura inicial: ${file.name}`}
          tone="info"
        />
      )}

      {suggestedCategory && (
        <InlineToast
          title="Sugestão automática"
          message={`Pelos campos do arquivo, a categoria sugerida é ${categoryInfo[suggestedCategory].label}. Revise antes de enviar.`}
          tone="info"
        />
      )}

      {previewHeaders.length > 0 && (
        <div className="rounded-md border border-[#2D3748] bg-[#141B2D] p-4">
          <p className="text-sm font-semibold text-white">Campos identificados</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {previewHeaders.slice(0, 12).map((header) => (
              <span
                key={header}
                className="rounded-md border border-[#2D3748] px-2 py-1 text-xs text-[#CBD5E1]"
              >
                {header}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
