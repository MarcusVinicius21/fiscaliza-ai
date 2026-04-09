"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface City {
  id: string;
  name: string;
  state: string;
  portal_url: string;
  clients?: { name: string }; // Join com a tabela de clientes
}

interface Client {
  id: string;
  name: string;
}

export default function CitiesPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do formulário
  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Buscar clientes para popular o Select (Dropdown)
    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, name")
      .order("name");
    setClients(clientsData || []);

    // Buscar cidades fazendo um "Join" simples com a tabela clients
    const { data: citiesData, error } = await supabase
      .from("cities")
      .select("*, clients(name)")
      .order("created_at", { ascending: false });

    if (error) console.error("Erro ao buscar cidades:", error);
    else setCities(citiesData || []);
    
    setLoading(false);
  };

  const handleAddCity = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientId) {
      alert("Por favor, selecione um cliente para vincular a esta cidade.");
      return;
    }

    const { error } = await supabase.from("cities").insert([
      { name, state, portal_url: portalUrl, client_id: clientId }
    ]);

    if (error) {
      alert("Erro ao cadastrar cidade.");
      console.error(error);
      return;
    }

    // Limpar form e recarregar
    setName("");
    setState("");
    setPortalUrl("");
    setClientId("");
    fetchData();
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Cidades Monitoradas</h1>

      {/* Formulário de Cadastro */}
      <div className="p-6 bg-white border rounded shadow-sm">
        <h2 className="text-lg font-medium mb-4">Nova Cidade</h2>
        <form onSubmit={handleAddCity} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="col-span-1 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Cidade</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: São Paulo"
            />
          </div>
          <div className="col-span-1 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado (UF)</label>
            <input
              type="text"
              required
              maxLength={2}
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border rounded focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: SP"
            />
          </div>
          <div className="col-span-1 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Portal da Transparência</label>
            <input
              type="url"
              value={portalUrl}
              onChange={(e) => setPortalUrl(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://..."
            />
          </div>
          <div className="col-span-1 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente Vinculado</label>
            <select
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="" disabled>Selecione...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-1 md:col-span-1">
            <button
              type="submit"
              className="w-full px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Cadastrar
            </button>
          </div>
        </form>
      </div>

      {/* Listagem de Cidades */}
      <div className="bg-white border rounded shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-medium">Cidades Cadastradas</h2>
        </div>
        <div className="p-0">
          {loading ? (
            <p className="p-6 text-gray-500">Carregando...</p>
          ) : cities.length === 0 ? (
            <p className="p-6 text-gray-500">Nenhuma cidade cadastrada ainda.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-4 font-medium text-sm text-gray-600">Cidade/UF</th>
                  <th className="p-4 font-medium text-sm text-gray-600">Cliente Responsável</th>
                  <th className="p-4 font-medium text-sm text-gray-600">Portal</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((city) => (
                  <tr key={city.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 text-sm text-gray-800 font-medium">
                      {city.name} - {city.state}
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {/* Exibe o nome do cliente através do Join do Supabase */}
                      {city.clients?.name || "Não vinculado"}
                    </td>
                    <td className="p-4 text-sm text-blue-600">
                      {city.portal_url ? (
                        <a href={city.portal_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          Acessar Link
                        </a>
                      ) : (
                        <span className="text-gray-400">Sem link</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}