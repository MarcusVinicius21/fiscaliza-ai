"use client";

import { useState, useEffect, useRef } from "react";
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

// Subtipos dependendo da categoria
const REPORT_TYPES: Record<string, { id: string; label: string }[]> = {
  payroll: [
    { id: "servidores", label: "Lista de Servidores" },
    { id: "salarios", label: "Folha de Pagamento" },
    { id: "diarias", label: "Diárias de Viagem" },
    { id: "terceirizados", label: "Terceirizados" },
  ],
  expenses: [
    { id: "empenhos", label: "Empenhos" },
    { id: "liquidacoes", label: "Liquidações" },
    { id: "pagamentos", label: "Pagamentos Realizados" },
  ],
  default: [{ id: "geral", label: "Relatório Geral" }],
};

function statusTone(status?: string) {
  if (status === "processed" || status === "analyzed") return "success";
  if (status === "error") return "danger";
  return "muted";
}

export default function UploadsPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Estados do formulário
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
    } catch (error) {
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

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-[#4EA8DE]">
          Entrada de dados
        </p>
        <h1 className="text-2xl font-bold text-white">Upload investigativo</h1>
        <p className="max-w-3xl text-sm text-[#CBD5E1]">
          Envie bases públicas com contexto claro. O wizard ajuda a escolher a
          categoria certa sem alterar o ETL validado.
        </p>
      </header>

      {statusMessage && (
        <InlineToast title="Status operacional" message={statusMessage} />
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
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

          <form
            onSubmit={handleUpload}
            className="grid grid-cols-1 gap-4 rounded-md border border-[#2D3748] bg-[#141B2D] p-5 md:grid-cols-2 xl:grid-cols-5"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-[#CBD5E1]">
                Cidade *
              </label>
              <select
                required
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                className="invest-input w-full px-3 py-2"
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#CBD5E1]">
                Categoria *
              </label>
              <select
                required
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setReportType("");
                  setWizardStep(2);
                }}
                className="invest-input w-full px-3 py-2"
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {(Object.keys(categoryInfo) as UploadCategory[]).map((key) => (
                  <option key={key} value={key}>
                    {categoryInfo[key].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#CBD5E1]">
                Relatório (Subtipo) *
              </label>
              <select
                required
                disabled={!category}
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="invest-input w-full px-3 py-2 disabled:opacity-50"
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {currentReportTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#CBD5E1]">
                Rótulo opcional
              </label>
              <input
                type="text"
                placeholder="Ex: Jan a Mar/2026"
                value={reportLabel}
                onChange={(e) => setReportLabel(e.target.value)}
                className="invest-input w-full px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#CBD5E1]">
                Arquivo (CSV/Excel) *
              </label>
              <input
                ref={fileInputRef}
                type="file"
                required
                onChange={(e) => {
                  const selected = e.target.files?.[0] || null;
                  setFile(selected);
                  if (selected) handleFilePreview(selected);
                }}
                className="invest-input w-full px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                disabled={uploading}
                className="mt-3 w-full rounded-md bg-[#4EA8DE] px-4 py-2 text-sm font-semibold text-[#0C111F] hover:opacity-90 disabled:opacity-50"
              >
                {uploading ? "Enviando..." : "Fazer upload"}
              </button>
            </div>
          </form>
        </div>

        <FaqBlock />
      </section>

      <section className="overflow-hidden rounded-md border border-[#2D3748] bg-[#141B2D]">
        <div className="border-b border-[#2D3748] p-4">
          <h2 className="text-lg font-semibold text-white">Histórico de uploads</h2>
          <p className="mt-1 text-sm text-[#CBD5E1]">
            Ações preservadas: upload, processamento e análise continuam usando
            os endpoints já validados.
          </p>
        </div>

        <div className="invest-soft-scroll overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#2D3748] bg-[#0C111F]">
                <th className="p-4 text-sm font-medium text-[#CBD5E1]">Arquivo</th>
                <th className="p-4 text-sm font-medium text-[#CBD5E1]">Contexto</th>
                <th className="p-4 text-sm font-medium text-[#CBD5E1]">Status</th>
                <th className="p-4 text-sm font-medium text-[#CBD5E1]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-4 text-sm text-[#CBD5E1]">
                    Carregando uploads...
                  </td>
                </tr>
              ) : (
                uploads.map((up) => (
                  <tr key={up.id} className="border-b border-[#2D3748]">
                    <td
                      className="max-w-[240px] truncate p-4 text-sm text-white"
                      title={up.file_name}
                    >
                      {up.file_name}
                    </td>
                    <td className="p-4 text-sm">
                      <span className="block font-medium text-white">
                        {up.category} &rarr; {up.report_type}
                      </span>
                      <span className="text-xs text-[#CBD5E1]">
                        {up.report_label || "Sem rótulo"}
                      </span>
                    </td>
                    <td className="p-4 text-sm">
                      <StatusPill tone={statusTone(up.analysis_status || up.status)}>
                        {up.analysis_status || up.status}
                      </StatusPill>
                    </td>
                    <td className="flex items-center gap-2 p-4 text-sm">
                      {up.status === "pending" && (
                        <button
                          onClick={() => handleProcess(up.id)}
                          className="rounded-md border border-[#4EA8DE] px-3 py-1 text-[#4EA8DE] hover:bg-[#4EA8DE] hover:text-[#0C111F]"
                        >
                          Processar IA
                        </button>
                      )}

                      {up.status === "processed" &&
                        up.analysis_status !== "analyzed" && (
                          <button
                            onClick={() => handleAnalyze(up.id)}
                            className="rounded-md border border-emerald-400 px-3 py-1 text-emerald-300 hover:bg-emerald-400 hover:text-[#0C111F]"
                          >
                            Rodar análise IA
                          </button>
                        )}

                      {up.analysis_status === "analyzed" && (
                        <StatusPill tone="success">Analisado</StatusPill>
                      )}

                      {up.analysis_status === "error" && (
                        <StatusPill tone="danger">Erro na análise</StatusPill>
                      )}
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
