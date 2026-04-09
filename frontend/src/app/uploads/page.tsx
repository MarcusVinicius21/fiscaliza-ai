"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

// Tipagens rigorosas baseadas no retorno de FKs do Supabase (Objetos, não arrays)
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
  status: string;
  created_at: string;
  cities: { name: string; state: string } | null;
}

const CATEGORIES = [
  { id: "payroll", label: "Folha de Pagamento (Salários)" },
  { id: "contracts", label: "Contratos" },
  { id: "expenses", label: "Despesas / Pagamentos" },
  { id: "payments", label: "Pagamentos" },
  { id: "suppliers", label: "Fornecedores" },
  { id: "bids", label: "Licitações" },
  { id: "per_diems", label: "Diárias" },
  { id: "public_purchases", label: "Compras Públicas" },
  { id: "commitments", label: "Empenhos" },
  { id: "agreements", label: "Convênios" },
  { id: "others", label: "Outros" },
];

export default function UploadsPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Estados do formulário
  const [cityId, setCityId] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Ref para limpar o input de arquivo corretamente no React
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    
    // Busca cidades (com nome do cliente) para o Select
    const { data: citiesData, error: citiesError } = await supabase
      .from("cities")
      .select("id, name, state, clients(name)")
      .order("name");
      
    if (citiesError) {
      console.error("Erro ao buscar cidades:", citiesError);
    } else {
      // Cast seguro forçando a tipagem
      setCities((citiesData as unknown as City[]) || []);
    }

    await fetchUploads();
  };

  const fetchUploads = async () => {
    const { data: uploadsData, error: uploadsError } = await supabase
      .from("uploads")
      .select("id, file_name, category, status, created_at, cities(name, state)")
      .order("created_at", { ascending: false });
    
    if (uploadsError) {
      console.error("Erro ao buscar histórico:", uploadsError);
    } else {
      setUploads((uploadsData as unknown as UploadRecord[]) || []);
    }
    setLoading(false);
  };

  const handleProcess = async (uploadId: string) => {
    if (!confirm("Deseja iniciar o processamento desta planilha? Isso pode levar alguns segundos.")) return;
    
    try {
      const res = await fetch(`http://localhost:8000/process/${uploadId}`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (res.ok) {
        alert(`Sucesso! ${data.linhas_processadas} linhas extraídas e limpas.`);
      } else {
        alert(`Erro no servidor: ${data.detail}`);
      }
    } catch (error) {
      alert("Erro fatal de conexão. O seu terminal do Python (porta 8000) está rodando?");
    } finally {
      // Independentemente se deu certo ou errado, recarrega a tabela para atualizar os status
      fetchUploads();
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cityId || !category || !file) {
      alert("Por favor, preencha todos os campos e selecione um arquivo.");
      return;
    }

    setUploading(true);

    try {
      // 1. Sanitização do nome do arquivo para evitar erros de URL/Storage
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const uniquePath = `${cityId}/${Date.now()}_${safeFileName}`;

      // 2. Upload para o Supabase Storage (Bucket 'uploads')
      const { error: storageError } = await supabase.storage
        .from("uploads")
        .upload(uniquePath, file, {
          cacheControl: "3600",
          upsert: false
        });

      if (storageError) {
        throw new Error(`Falha no envio físico: ${storageError.message}`);
      }

      // 3. Registro lógico no Banco de Dados
      const { error: dbError } = await supabase.from("uploads").insert([
        {
          city_id: cityId,
          file_name: file.name,
          file_path: uniquePath,
          category: category,
          status: "pending" // Status inicial fixo para a Etapa 4
        }
      ]);

      if (dbError) {
        throw new Error(`Falha ao registrar no banco: ${dbError.message}`);
      }

      alert("Planilha enviada com sucesso!");
      
      // 4. Limpeza segura dos estados
      setFile(null);
      setCategory("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      // 5. Atualiza o histórico
      await fetchUploads();

    } catch (error: any) {
      console.error("Erro no processo de upload:", error);
      alert(error.message || "Ocorreu um erro desconhecido durante o envio.");
    } finally {
      setUploading(false);
    }
  };

  const getCategoryLabel = (catId: string) => {
    return CATEGORIES.find(c => c.id === catId)?.label || catId;
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Upload de Planilhas</h1>

      {/* Formulário de Envio */}
      <div className="p-6 bg-white border rounded shadow-sm">
        <h2 className="text-lg font-medium mb-4">Novo Envio</h2>
        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cidade Destino</label>
            <select
              required
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-blue-500 bg-white"
            >
              <option value="" disabled>Selecione a cidade...</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}/{c.state} ({c.clients?.name || "Sem cliente"})
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-blue-500 bg-white"
            >
              <option value="" disabled>Selecione a categoria...</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo</label>
            <input
              ref={fileInputRef}
              type="file"
              required
              accept=".csv, .xls, .xlsx, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                const selectedFile =
                  e.target.files && e.target.files.length > 0
                    ? e.target.files[0]
                    : null;
                setFile(selectedFile);
              }}
              className="w-full px-3 py-1.5 border rounded focus:ring-blue-500 bg-white text-sm"
            />
          </div>

          <div className="col-span-1">
            <button
              type="submit"
              disabled={uploading}
              className={`w-full px-4 py-2 text-white rounded transition-colors focus:outline-none ${
                uploading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {uploading ? "Enviando..." : "Fazer Upload"}
            </button>
          </div>
        </form>
      </div>

      {/* Histórico de Envios */}
      <div className="bg-white border rounded shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-medium">Histórico de Arquivos</h2>
        </div>
        <div className="p-0">
          {loading ? (
            <p className="p-6 text-gray-500">Carregando histórico...</p>
          ) : uploads.length === 0 ? (
            <p className="p-6 text-gray-500">Nenhum upload realizado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-4 font-medium text-sm text-gray-600 whitespace-nowrap">Data</th>
                    <th className="p-4 font-medium text-sm text-gray-600">Arquivo</th>
                    <th className="p-4 font-medium text-sm text-gray-600">Cidade</th>
                    <th className="p-4 font-medium text-sm text-gray-600">Categoria</th>
                    <th className="p-4 font-medium text-sm text-gray-600">Status</th>
                    <th className="p-4 font-medium text-sm text-gray-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((up) => (
                    <tr key={up.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 text-sm text-gray-600 whitespace-nowrap">
                        {new Date(up.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-4 text-sm text-gray-800 font-medium truncate max-w-xs" title={up.file_name}>
                        {up.file_name}
                      </td>
                      <td className="p-4 text-sm text-gray-600 whitespace-nowrap">
                        {up.cities?.name} - {up.cities?.state}
                      </td>
                      <td className="p-4 text-sm text-gray-600 whitespace-nowrap">
                        {getCategoryLabel(up.category)}
                      </td>
                      <td className="p-4 text-sm whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          up.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                          up.status === 'processed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {up.status === 'pending' ? 'Aguardando' : up.status === 'processed' ? 'Processado' : 'Erro'}
                        </span>
                      </td>
                      <td className="p-4 text-sm whitespace-nowrap">
                        {up.status === 'pending' && (
                          <button
                            onClick={() => handleProcess(up.id)}
                            className="px-3 py-1 bg-slate-800 text-white rounded hover:bg-slate-700 transition shadow-sm"
                          >
                            Processar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}