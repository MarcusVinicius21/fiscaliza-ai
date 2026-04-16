"use client";

import { useEffect, useRef, useState } from "react";
import { FaqBlock } from "@/components/app/faq-block";
import { InlineToast } from "@/components/app/inline-toast";
import { StatusPill } from "@/components/app/status-pill";
import { CategoryWizard } from "@/components/upload/category-wizard";
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

  async function handleFilePreview(selectedFile: File) {
    try {
      const text = await selectedFile.text();
      const headers = parseCsvPreview(text);
      const suggestion = suggestCategoryFromHeaders(headers);

      setPreviewHeaders(headers);
      setSuggestedCategory(suggestion);
      setWizardStep(1);
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
    if (!cityId || !category || !reportType || !file) {
      alert("Preencha todos os campos obrigatórios e selecione um arquivo.");
      return;
    }

    setUploading(true);
    setWizardStep(3);
    setStatusMessage("Enviando arquivo para o repositório do projeto...");
    try {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const uniquePath = `${cityId}/${Date.now()}_${safeFileName}`;

      const { error: storageError } = await supabase.storage
        .from("uploads")
        .upload(uniquePath, file);
      if (storageError) throw new Error(storageError.message);

      const { error: dbError } = await supabase.from("uploads").insert([
        {
          city_id: cityId,
          file_name: file.name,
          file_path: uniquePath,
          category: category,
          report_type: reportType,
          report_label: reportLabel || null,
          status: "pending",
        },
      ]);
      if (dbError) throw new Error(dbError.message);

      alert("Planilha enviada com sucesso!");
      setStatusMessage("Upload concluído. O arquivo está pronto para processamento.");
      setFile(null);
      setCategory("");
      setReportType("");
      setReportLabel("");
      setSuggestedCategory("");
      setPreviewHeaders([]);
      setWizardStep(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchUploads();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro inesperado.";
      alert("Erro: " + message);
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
      if (res.ok)
        alert(
          `Sucesso! Status: ${data.mapping_source}. Linhas salvas: ${data.linhas_processadas}`
        );
      else alert(`Erro: ${data.detail}`);
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
  const processedCount = uploads.filter((item) => item.status === "processed").length;
  const analyzedCount = uploads.filter((item) => item.analysis_status === "analyzed").length;

  return (
    <div className="page-shell">
      <section className="page-header p-6 md:p-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <p className="invest-eyebrow">Entrada de dados</p>
            <h1 className="invest-title mt-3 max-w-3xl text-3xl md:text-5xl">
              Envie um arquivo sem escolher a categoria no escuro.
            </h1>
            <p className="invest-subtitle mt-4 max-w-3xl text-base">
              A prévia ajuda a entender o arquivo antes do envio. O upload,
              processamento e análise continuam usando os fluxos já validados.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="metric-card">
              <p className="metric-label">Cidades</p>
              <p className="metric-value mt-3">{cities.length}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Processados</p>
              <p className="metric-value mt-3">{processedCount}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Analisados</p>
              <p className="metric-value mt-3">{analyzedCount}</p>
            </div>
          </div>
        </div>
      </section>

      {statusMessage && (
        <InlineToast title="Status" message={statusMessage} />
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <CategoryWizard
            currentStep={wizardStep}
            file={file}
            category={category as UploadCategory | ""}
            suggestedCategory={suggestedCategory}
            previewHeaders={previewHeaders}
            onCategoryChange={(nextCategory) => {
              setCategory(nextCategory);
              setReportType("");
              setWizardStep(2);
            }}
          />

          <form onSubmit={handleUpload} className="rounded-lg border border-[var(--invest-border)] bg-white p-5 shadow-[var(--invest-shadow-soft)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="invest-eyebrow">Dados obrigatórios</p>
                <h2 className="mt-2 text-xl font-black text-[var(--invest-heading)]">
                  Prepare o arquivo para entrada
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--invest-muted)]">
                  Esses campos são os mesmos enviados ao backend. Nada aqui
                  altera o ETL nem o raw_json.
                </p>
              </div>
              <StatusPill tone={uploading ? "warning" : "info"}>
                {uploading ? "Enviando" : "Pronto"}
              </StatusPill>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="invest-label">Categoria *</label>
                <select
                  required
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setReportType("");
                    setWizardStep(2);
                  }}
                  className="invest-select"
                >
                  <option value="" disabled>
                    Selecione a categoria
                  </option>
                  {(Object.keys(categoryInfo) as UploadCategory[]).map((key) => (
                    <option key={key} value={key}>
                      {categoryInfo[key].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="invest-label">Tipo do documento *</label>
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
              </div>

              <div>
                <label className="invest-label">Rótulo opcional</label>
                <input
                  type="text"
                  placeholder="Ex: Jan a Mar/2026"
                  value={reportLabel}
                  onChange={(e) => setReportLabel(e.target.value)}
                  className="invest-input"
                />
              </div>

              <div>
                <label className="invest-label">Arquivo *</label>
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
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--invest-border)] pt-5">
              <p className="max-w-2xl text-sm leading-6 text-[var(--invest-muted)]">
                A categoria orienta a análise, mas não muda o arquivo original.
              </p>
              <button
                type="submit"
                disabled={uploading}
                className="invest-button px-5 py-2"
              >
                {uploading ? "Enviando..." : "Fazer upload"}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-5">
          <FaqBlock />
          <section className="rounded-lg border border-[var(--invest-border)] bg-white p-5 shadow-[var(--invest-shadow-soft)]">
            <p className="invest-eyebrow">Categorias</p>
            <h2 className="mt-2 text-lg font-black text-[var(--invest-heading)]">
              Como decidir rápido
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
                        {categoryLabel(up.category)} - {up.report_type || "geral"}
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
    </div>
  );
}
