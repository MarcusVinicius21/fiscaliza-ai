"use client";

import { useState, useEffect, useRef } from "react";
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
  created_at: string;
  cities: { name: string; state: string } | null;
}

const CATEGORIES = [
  { id: "payroll", label: "Pessoal / RH" },
  { id: "contracts", label: "Contratos" },
  { id: "expenses", label: "Despesas / Pagamentos" },
  { id: "bids", label: "Licitações" },
  { id: "others", label: "Outros" },
];

// Subtipos dependendo da categoria
const REPORT_TYPES: Record<string, { id: string, label: string }[]> = {
  payroll: [
    { id: "servidores", label: "Lista de Servidores" },
    { id: "salarios", label: "Folha de Pagamento" },
    { id: "diarias", label: "Diárias de Viagem" },
    { id: "terceirizados", label: "Terceirizados" }
  ],
  expenses: [
    { id: "empenhos", label: "Empenhos" },
    { id: "liquidacoes", label: "Liquidações" },
    { id: "pagamentos", label: "Pagamentos Realizados" }
  ],
  default: [
    { id: "geral", label: "Relatório Geral" }
  ]
};

export default function UploadsPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Estados do formulário
  const [cityId, setCityId] = useState("");
  const [category, setCategory] = useState("");
  const [reportType, setReportType] = useState("");
  const [reportLabel, setReportLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: citiesData } = await supabase.from("cities").select("id, name, state, clients(name)").order("name");
    setCities((citiesData as unknown as City[]) || []);
    await fetchUploads();
  };

  const fetchUploads = async () => {
    const { data: uploadsData } = await supabase
      .from("uploads")
      .select("id, file_name, category, report_type, report_label, status, created_at, cities(name, state)")
      .order("created_at", { ascending: false });
    setUploads((uploadsData as unknown as UploadRecord[]) || []);
    setLoading(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityId || !category || !reportType || !file) {
      alert("Preencha todos os campos obrigatórios e selecione um arquivo.");
      return;
    }

    setUploading(true);
    try {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const uniquePath = `${cityId}/${Date.now()}_${safeFileName}`;

      const { error: storageError } = await supabase.storage.from("uploads").upload(uniquePath, file);
      if (storageError) throw new Error(storageError.message);

      const { error: dbError } = await supabase.from("uploads").insert([{
        city_id: cityId,
        file_name: file.name,
        file_path: uniquePath,
        category: category,
        report_type: reportType,
        report_label: reportLabel || null,
        status: "pending"
      }]);
      if (dbError) throw new Error(dbError.message);

      alert("Planilha enviada com sucesso!");
      setFile(null); setCategory(""); setReportType(""); setReportLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchUploads();
    } catch (error: any) {
      alert("Erro: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleProcess = async (uploadId: string) => {
    if (!confirm("Iniciar processamento e interpretação semântica (Etapa 4.5)?")) return;
    try {
      const res = await fetch(`http://localhost:8000/process/${uploadId}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) alert(`Sucesso! Status: ${data.mapping_source}. Linhas salvas: ${data.linhas_processadas}`);
      else alert(`Erro: ${data.detail}`);
    } catch (error) {
      alert("Erro de conexão com o Backend Python na porta 8000.");
    } finally {
      fetchUploads();
    }
  };

  const currentReportTypes = REPORT_TYPES[category] || REPORT_TYPES.default;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Upload & Interpretação</h1>

      <div className="p-6 bg-white border rounded shadow-sm">
        <h2 className="text-lg font-medium mb-4">Novo Envio</h2>
        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cidade *</label>
            <select required value={cityId} onChange={(e) => setCityId(e.target.value)} className="w-full px-3 py-2 border rounded">
              <option value="" disabled>Selecione...</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
            <select required value={category} onChange={(e) => {setCategory(e.target.value); setReportType("");}} className="w-full px-3 py-2 border rounded">
              <option value="" disabled>Selecione...</option>
              {CATEGORIES.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Relatório (Subtipo) *</label>
            <select required disabled={!category} value={reportType} onChange={(e) => setReportType(e.target.value)} className="w-full px-3 py-2 border rounded">
              <option value="" disabled>Selecione...</option>
              {currentReportTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rótulo Opcional</label>
            <input type="text" placeholder="Ex: Jan a Mar/2026" value={reportLabel} onChange={(e) => setReportLabel(e.target.value)} className="w-full px-3 py-2 border rounded" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo (CSV/Excel) *</label>
            <input ref={fileInputRef} type="file" required onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full px-3 py-1.5 border rounded text-sm" />
            <button type="submit" disabled={uploading} className="w-full mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              {uploading ? "Enviando..." : "Fazer Upload"}
            </button>
          </div>
        </form>
      </div>

      {/* Tabela de Histórico (Resumida para o tutorial) */}
      <div className="bg-white border rounded shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="p-4 text-sm font-medium text-gray-600">Arquivo</th>
              <th className="p-4 text-sm font-medium text-gray-600">Contexto</th>
              <th className="p-4 text-sm font-medium text-gray-600">Status</th>
              <th className="p-4 text-sm font-medium text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((up) => (
              <tr key={up.id} className="border-b">
                <td className="p-4 text-sm max-w-[200px] truncate" title={up.file_name}>{up.file_name}</td>
                <td className="p-4 text-sm">
                  <span className="block font-medium">{up.category} &rarr; {up.report_type}</span>
                  <span className="text-xs text-gray-500">{up.report_label || 'Sem rótulo'}</span>
                </td>
                <td className="p-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${up.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                    {up.status}
                  </span>
                </td>
                <td className="p-4 text-sm">
                  {up.status === 'pending' && (
                    <button onClick={() => handleProcess(up.id)} className="px-3 py-1 bg-slate-800 text-white rounded hover:bg-slate-700">Processar IA</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}