"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FaqBlock } from "@/components/app/faq-block";
import { InlineToast } from "@/components/app/inline-toast";
import { StatusPill } from "@/components/app/status-pill";
import {
  UploadCategory,
  categoryInfo,
  parseCsvPreview,
  suggestCategoryFromHeaders,
} from "@/lib/category-detector";
import { supabase } from "@/lib/supabase";

interface City {
  id: string;
  name: string;
  state: string;
  clients: { name: string } | null;
}

interface UploadRecord {
  id: string;
  file_name: string;
  category: string;
  report_type?: string;
  report_label?: string;
  status: string;
  analysis_status?: string;
  created_at: string;
  cities: { name: string; state: string } | null;
}

type StatusTone = "info" | "danger" | "success" | "muted" | "warning";

const WIZARD_STEPS = [
  {
    title: "Qual base você quer analisar?",
    subtitle:
      "Escolha a cidade e envie o arquivo original. O sistema preserva os dados brutos como prova.",
    short: "Base",
  },
  {
    title: "Que tipo de dado este arquivo contém?",
    subtitle:
      "A categoria muda a forma de leitura. Se tiver dúvida, use a sugestão do sistema como apoio.",
    short: "Categoria",
  },
  {
    title: "Confira o que encontramos no arquivo",
    subtitle:
      "Veja os primeiros cabeçalhos detectados para confirmar se a categoria faz sentido.",
    short: "Prévia",
  },
  {
    title: "Tudo pronto para enviar?",
    subtitle: "Revise as informações antes de salvar o arquivo no sistema.",
    short: "Revisão",
  },
];

const REPORT_TYPES: Record<string, { id: string; label: string }[]> = {
  payroll: [
    { id: "servidores", label: "Lista de servidores" },
    { id: "salarios", label: "Folha de pagamento" },
    { id: "diarias", label: "Diárias de viagem" },
    { id: "terceirizados", label: "Terceirizados" },
  ],
  expenses: [
    { id: "empenhos", label: "Empenhos" },
    { id: "liquidacoes", label: "Liquidações" },
    { id: "pagamentos", label: "Pagamentos realizados" },
  ],
  default: [{ id: "geral", label: "Relatório geral" }],
};

function statusTone(status?: string): StatusTone {
  if (status === "processed" || status === "analyzed") return "success";
  if (status === "error") return "danger";
  if (status === "pending") return "warning";
  return "muted";
}

function categoryLabel(value?: string) {
  return categoryInfo[value as UploadCategory]?.label || value || "Sem categoria";
}

function formatFileSize(file: File | null) {
  if (!file) return "Arquivo não selecionado";
  const kb = file.size / 1024;
  if (kb < 1024) {
    return `${kb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  }
  return `${(kb / 1024).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })} MB`;
}

export default function UploadsPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [cityId, setCityId] = useState("");
  const [category, setCategory] = useState("");
  const [reportType, setReportType] = useState("");
  const [reportLabel, setReportLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [stepError, setStepError] = useState("");
  const [suggestedCategory, setSuggestedCategory] = useState<
    UploadCategory | ""
  >("");
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: citiesData } = await supabase
      .from("cities")
      .select("id, name, state, clients(name)")
      .order("name");
    setCities((citiesData as unknown as City[]) || []);
    await fetchUploads();
  };

  const fetchUploads = async () => {
    const { data: uploadsData } = await supabase
      .from("uploads")
      .select("id, file_name, category, report_type, report_label, status, analysis_status, created_at, cities(name, state)")
      .order("created_at", { ascending: false });
    setUploads((uploadsData as unknown as UploadRecord[]) || []);
    setLoading(false);
  };

  function resetWizard() {
    setCityId("");
    setCategory("");
    setReportType("");
    setReportLabel("");
    setFile(null);
    setWizardStep(0);
    setStepError("");
    setSuggestedCategory("");
    setPreviewHeaders([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openWizard() {
    resetWizard();
    setWizardOpen(true);
  }

  function closeWizard() {
    if (uploading) return;
    setWizardOpen(false);
    setStepError("");
  }

  function validateStep(step: number) {
    if (step === 0 && (!cityId || !file)) {
      setStepError("Escolha a cidade e selecione o arquivo original para continuar.");
      return false;
    }
    if (step === 1 && (!category || !reportType)) {
      setStepError("Confirme a categoria e o tipo do documento antes de avançar.");
      return false;
    }
    if (step === 3 && (!cityId || !category || !reportType || !file)) {
      setStepError("Revise os campos obrigatórios antes de enviar.");
      return false;
    }
    setStepError("");
    return true;
  }

  function goToStep(nextStep: number) {
    if (nextStep <= wizardStep) {
      setWizardStep(nextStep);
      setStepError("");
      return;
    }
    if (validateStep(wizardStep)) {
      setWizardStep(Math.min(nextStep, WIZARD_STEPS.length - 1));
    }
  }

  function goNext() {
    if (validateStep(wizardStep)) {
      setWizardStep((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
    }
  }

  async function handleFilePreview(selectedFile: File) {
    try {
      const text = await selectedFile.text();
      const headers = parseCsvPreview(text);
      const suggestion = suggestCategoryFromHeaders(headers);
      setPreviewHeaders(headers);
      setSuggestedCategory(suggestion);
      setStatusMessage(
        `Prévia carregada. Sugestão inicial: ${categoryInfo[suggestion].label}.`
      );
    } catch {
      setPreviewHeaders([]);
      setSuggestedCategory("");
      setStatusMessage("Não foi possível ler a prévia do arquivo.");
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;

    setUploading(true);
    setStatusMessage("Enviando arquivo para o repositório do projeto...");

    try {
      const safeFileName = file!.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const uniquePath = `${cityId}/${Date.now()}_${safeFileName}`;

      const { error: storageError } = await supabase.storage
        .from("uploads")
        .upload(uniquePath, file!);
      if (storageError) throw new Error(storageError.message);

      const { error: dbError } = await supabase.from("uploads").insert([
        {
          city_id: cityId,
          file_name: file!.name,
          file_path: uniquePath,
          category,
          report_type: reportType,
          report_label: reportLabel || null,
          status: "pending",
        },
      ]);
      if (dbError) throw new Error(dbError.message);

      setStatusMessage("Upload concluído. O arquivo está pronto para processamento.");
      setWizardOpen(false);
      resetWizard();
      await fetchUploads();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro inesperado.";
      setStepError(message);
      setStatusMessage(`Falha no upload: ${message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleProcess = async (uploadId: string) => {
    if (!confirm("Iniciar processamento e interpretação semântica (Etapa 4.5)?")) return;
    try {
      setStatusMessage("Processamento semântico iniciado no backend.");
      const res = await fetch(`http://localhost:8000/process/${uploadId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        alert(
          `Sucesso! Status: ${data.mapping_source}. Linhas salvas: ${data.linhas_processadas}`
        );
      } else {
        alert(`Erro: ${data.detail}`);
      }
    } catch {
      alert("Erro de conexão com o Backend Python na porta 8000.");
    } finally {
      fetchUploads();
    }
  };

  const handleAnalyze = async (uploadId: string) => {
    try {
      alert("Iniciando análise dos dados. Isso pode levar alguns segundos...");
      setStatusMessage("Análise objetiva e assistida por IA em andamento.");
      const response = await fetch(`http://localhost:8000/analyze/${uploadId}`, {
        method: "POST",
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message || "Análise concluída com sucesso!");
      } else {
        alert(`Erro na análise: ${data.detail || "Falha desconhecida"}`);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao conectar com a API de análise.");
    } finally {
      await fetchUploads();
    }
  };

  const currentReportTypes = REPORT_TYPES[category] || REPORT_TYPES.default;
  const selectedCity = cities.find((city) => city.id === cityId);
  const selectedCategory = category
    ? categoryInfo[category as UploadCategory]
    : null;
  const selectedReportType = currentReportTypes.find(
    (item) => item.id === reportType
  );

  const processedCount = uploads.filter((item) => item.status === "processed").length;
  const analyzedCount = uploads.filter((item) => item.analysis_status === "analyzed").length;

  const wizardTitle = WIZARD_STEPS[wizardStep].title;
  const wizardSubtitle = WIZARD_STEPS[wizardStep].subtitle;

  const uploadStats = useMemo(
    () => [
      { label: "Cidades", value: cities.length },
      { label: "Processados", value: processedCount },
      { label: "Analisados", value: analyzedCount },
    ],
    [cities.length, processedCount, analyzedCount]
  );

  return (
    <div className="page-shell">
      <section className="page-header p-6 md:p-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <p className="invest-eyebrow">Entrada de dados</p>
            <h1 className="invest-title mt-3 max-w-3xl text-3xl md:text-5xl">
              Envie bases públicas com menos dúvida e mais controle.
            </h1>
            <p className="invest-subtitle mt-4 max-w-3xl text-base">
              O fluxo guia categoria, prévia e revisão antes de salvar. O upload,
              processamento, análise e raw_json continuam preservados.
            </p>
            <button
              type="button"
              onClick={openWizard}
              className="invest-button mt-6 px-5 py-2"
            >
              Enviar novo arquivo
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {uploadStats.map((stat) => (
              <div key={stat.label} className="metric-card">
                <p className="metric-label">{stat.label}</p>
                <p className="metric-value mt-3">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {statusMessage && <InlineToast title="Status" message={statusMessage} />}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-[var(--invest-border)] bg-white p-6 shadow-[var(--invest-shadow-soft)]">
          <p className="invest-eyebrow">Fluxo guiado</p>
          <h2 className="mt-2 text-2xl font-black text-[var(--invest-heading)]">
            Quatro passos antes de salvar
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
            {WIZARD_STEPS.map((step, index) => (
              <div
                key={step.short}
                className="rounded-lg border border-[var(--invest-border)] bg-[#fbfcff] p-4"
              >
                <span className="app-chip">{index + 1}</span>
                <p className="mt-3 font-black text-[var(--invest-heading)]">
                  {step.short}
                </p>
                <p className="mt-2 text-xs leading-5 text-[var(--invest-muted)]">
                  {step.subtitle}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <FaqBlock />
          <section className="rounded-lg border border-[var(--invest-border)] bg-white p-5 shadow-[var(--invest-shadow-soft)]">
            <p className="invest-eyebrow">Categorias</p>
            <h2 className="mt-2 text-lg font-black text-[var(--invest-heading)]">
              Escolha com base no conteúdo
            </h2>
            <div className="mt-5 space-y-3">
              {(Object.keys(categoryInfo) as UploadCategory[]).map((key) => (
                <div
                  key={key}
                  className="rounded-lg border border-[var(--invest-border)] bg-[#fbfcff] p-3"
                >
                  <p className="text-sm font-black text-[var(--invest-heading)]">
                    {categoryInfo[key].label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--invest-muted)]">
                    {categoryInfo[key].whenToUse}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--invest-border)] bg-white shadow-[var(--invest-shadow-soft)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--invest-border)] p-5">
          <div>
            <p className="invest-eyebrow">Histórico</p>
            <h2 className="mt-2 text-xl font-black text-[var(--invest-heading)]">
              Arquivos importados
            </h2>
            <p className="mt-2 text-sm text-[var(--invest-muted)]">
              Processar e analisar continuam chamando os endpoints validados.
            </p>
          </div>
          <StatusPill tone="muted">{uploads.length} arquivos</StatusPill>
        </div>

        <div className="invest-soft-scroll overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Arquivo</th>
                <th>Categoria do arquivo</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4}>Carregando uploads...</td>
                </tr>
              ) : uploads.length === 0 ? (
                <tr>
                  <td colSpan={4}>Nenhum upload registrado ainda.</td>
                </tr>
              ) : (
                uploads.map((up) => (
                  <tr key={up.id}>
                    <td>
                      <p className="max-w-[320px] truncate font-bold text-[var(--invest-heading)]" title={up.file_name}>
                        {up.file_name}
                      </p>
                      <p className="mt-1 text-xs text-[var(--invest-muted)]">
                        {up.cities?.name
                          ? `${up.cities.name}/${up.cities.state}`
                          : "Cidade não informada"}
                      </p>
                    </td>
                    <td>
                      <span className="block font-bold text-[var(--invest-heading)]">
                        {categoryLabel(up.category)} · {up.report_type || "geral"}
                      </span>
                      <span className="text-xs text-[var(--invest-muted)]">
                        {up.report_label || "Sem rótulo"}
                      </span>
                    </td>
                    <td>
                      <StatusPill tone={statusTone(up.analysis_status || up.status)}>
                        {up.analysis_status || up.status}
                      </StatusPill>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {up.status === "pending" && (
                          <button
                            onClick={() => handleProcess(up.id)}
                            className="invest-button-secondary px-3 py-1 text-xs"
                          >
                            Processar
                          </button>
                        )}
                        {up.status === "processed" &&
                          up.analysis_status !== "analyzed" && (
                            <button
                              onClick={() => handleAnalyze(up.id)}
                              className="invest-button px-3 py-1 text-xs"
                            >
                              Analisar
                            </button>
                          )}
                        {up.analysis_status === "analyzed" && (
                          <StatusPill tone="success">Analisado</StatusPill>
                        )}
                        {up.analysis_status === "error" && (
                          <StatusPill tone="danger">Erro na análise</StatusPill>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {wizardOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
          <form
            onSubmit={handleUpload}
            className="invest-soft-scroll max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[18px] border border-[var(--invest-border)] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.22)]"
            role="dialog"
            aria-modal="true"
            aria-label="Enviar novo arquivo"
          >
            <div className="sticky top-0 z-10 border-b border-[var(--invest-border)] bg-white/95 p-5 backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="invest-eyebrow">Novo upload</p>
                  <h2 className="mt-2 text-2xl font-black text-[var(--invest-heading)]">
                    {wizardTitle}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--invest-muted)]">
                    {wizardSubtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeWizard}
                  className="invest-button-secondary px-4 py-2 text-sm"
                >
                  Fechar
                </button>
              </div>

              <div className="mt-5 grid grid-cols-4 gap-2">
                {WIZARD_STEPS.map((step, index) => {
                  const active = index === wizardStep;
                  const done = index < wizardStep;
                  return (
                    <button
                      key={step.short}
                      type="button"
                      onClick={() => goToStep(index)}
                      className={[
                        "rounded-full border px-3 py-2 text-xs font-black transition",
                        active
                          ? "border-[var(--invest-primary)] bg-blue-50 text-[var(--invest-primary)]"
                          : done
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-[var(--invest-border)] bg-white text-[var(--invest-muted)]",
                      ].join(" ")}
                    >
                      {index + 1}. {step.short}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6">
              {stepError && (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                  {stepError}
                </div>
              )}

              {wizardStep === 0 && (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <div>
                    <label className="invest-label">Cidade *</label>
                    <select
                      required
                      value={cityId}
                      onChange={(e) => setCityId(e.target.value)}
                      className="invest-select"
                    >
                      <option value="" disabled>
                        Selecione a cidade
                      </option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}/{c.state}
                        </option>
                      ))}
                    </select>
                    <p className="invest-helper">
                      A cidade define o contexto e mantém o vínculo com os alertas.
                    </p>
                  </div>

                  <div>
                    <label className="invest-label">Arquivo original *</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      required
                      onChange={(e) => {
                        const selected = e.target.files?.[0] || null;
                        setFile(selected);
                        if (selected) handleFilePreview(selected);
                      }}
                    />
                    <p className="invest-helper">
                      CSV ou Excel. O arquivo bruto é preservado como origem de prova.
                    </p>
                  </div>

                  <div className="rounded-lg border border-[var(--invest-border)] bg-[#fbfcff] p-4 lg:col-span-2">
                    <p className="text-sm font-black text-[var(--invest-heading)]">
                      {file ? file.name : "Nenhum arquivo selecionado"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--invest-muted)]">
                      {formatFileSize(file)}
                    </p>
                  </div>
                </div>
              )}

              {wizardStep === 1 && (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <div>
                    {suggestedCategory && (
                      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                          Sugestão automática
                        </p>
                        <p className="mt-1 font-black text-blue-950">
                          {categoryInfo[suggestedCategory].label}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-blue-900">
                          A sugestão usa só os cabeçalhos. Ela ajuda, mas você confirma.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {(Object.keys(categoryInfo) as UploadCategory[]).map((key) => {
                        const info = categoryInfo[key];
                        const selected = category === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setCategory(key);
                              setReportType("");
                              setStepError("");
                            }}
                            className={[
                              "min-h-[172px] rounded-lg border p-4 text-left transition",
                              selected
                                ? "border-[var(--invest-primary)] bg-blue-50 shadow-[0_16px_30px_rgba(49,92,255,0.1)]"
                                : "border-[var(--invest-border)] bg-white hover:border-[rgba(49,92,255,0.34)] hover:bg-[#fbfcff]",
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-base font-black text-[var(--invest-heading)]">
                                {info.label}
                              </span>
                              {suggestedCategory === key && (
                                <span className="app-chip border-blue-200 bg-blue-50 text-blue-700">
                                  sugerida
                                </span>
                              )}
                            </div>
                            <p className="mt-3 text-sm leading-6 text-[var(--invest-muted)]">
                              {info.whenToUse}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <aside className="rounded-lg border border-[var(--invest-border)] bg-[#fbfcff] p-4">
                    <p className="invest-eyebrow">Tipo do documento</p>
                    <label className="invest-label mt-4">Relatório *</label>
                    <select
                      required
                      disabled={!category}
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                      className="invest-select disabled:opacity-50"
                    >
                      <option value="" disabled>
                        Selecione o tipo
                      </option>
                      {currentReportTypes.map((rt) => (
                        <option key={rt.id} value={rt.id}>
                          {rt.label}
                        </option>
                      ))}
                    </select>

                    <label className="invest-label mt-4">Rótulo opcional</label>
                    <input
                      type="text"
                      placeholder="Ex: Jan a Mar/2026"
                      value={reportLabel}
                      onChange={(e) => setReportLabel(e.target.value)}
                      className="invest-input"
                    />

                    {selectedCategory && (
                      <div className="mt-5 space-y-3 text-sm text-[var(--invest-muted)]">
                        <p className="font-black text-[var(--invest-heading)]">
                          O sistema ajuda a ver:
                        </p>
                        {selectedCategory.detects.map((item) => (
                          <p
                            key={item}
                            className="rounded-md border border-[var(--invest-border)] bg-white px-3 py-2"
                          >
                            {item}
                          </p>
                        ))}
                      </div>
                    )}
                  </aside>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <section className="rounded-lg border border-[var(--invest-border)] bg-[#fbfcff] p-5">
                    <p className="invest-eyebrow">Cabeçalhos detectados</p>
                    {previewHeaders.length > 0 ? (
                      <div className="mt-5 flex flex-wrap gap-2">
                        {previewHeaders.slice(0, 28).map((header) => (
                          <span
                            key={header}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
                          >
                            {header}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm leading-6 text-[var(--invest-muted)]">
                        Não foi possível montar prévia automática. Isso não bloqueia
                        o upload, mas confira categoria e tipo com mais cuidado.
                      </p>
                    )}
                  </section>

                  <aside className="rounded-lg border border-[var(--invest-border)] bg-white p-5">
                    <p className="invest-eyebrow">Conferência rápida</p>
                    <div className="mt-4 space-y-3 text-sm text-[var(--invest-muted)]">
                      <p>
                        <strong className="text-[var(--invest-heading)]">Arquivo:</strong>{" "}
                        {file?.name || "Não informado"}
                      </p>
                      <p>
                        <strong className="text-[var(--invest-heading)]">Categoria:</strong>{" "}
                        {selectedCategory?.label || "Não informada"}
                      </p>
                      <p>
                        <strong className="text-[var(--invest-heading)]">Sugestão:</strong>{" "}
                        {suggestedCategory
                          ? categoryInfo[suggestedCategory].label
                          : "Sem sugestão"}
                      </p>
                    </div>
                  </aside>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    [
                      "Cidade",
                      selectedCity
                        ? `${selectedCity.name}/${selectedCity.state}`
                        : "Não informada",
                    ],
                    ["Arquivo", file?.name || "Não informado"],
                    ["Categoria", selectedCategory?.label || "Não informada"],
                    [
                      "Tipo do documento",
                      selectedReportType?.label || "Não informado",
                    ],
                    ["Rótulo", reportLabel || "Sem rótulo"],
                    ["Tamanho", formatFileSize(file)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-[var(--invest-border)] bg-[#fbfcff] p-4"
                    >
                      <p className="metric-label">{label}</p>
                      <p className="mt-2 font-black text-[var(--invest-heading)]">
                        {value}
                      </p>
                    </div>
                  ))}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950 md:col-span-2">
                    Depois do envio, o arquivo fica pendente. Use “Processar” no
                    histórico para rodar o ETL validado e, depois, “Analisar”.
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--invest-border)] bg-white p-5">
              <button
                type="button"
                onClick={() => goToStep(Math.max(0, wizardStep - 1))}
                disabled={wizardStep === 0 || uploading}
                className="invest-button-secondary px-4 py-2 text-sm disabled:opacity-50"
              >
                Voltar
              </button>

              {wizardStep < WIZARD_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="invest-button px-5 py-2 text-sm"
                >
                  Próximo
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={uploading}
                  className="invest-button px-5 py-2 text-sm"
                >
                  {uploading ? "Enviando..." : "Enviar upload"}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
