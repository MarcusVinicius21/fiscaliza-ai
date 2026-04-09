"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Client {
  id: string;
  name: string;
  email: string;
  document: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do formulário
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [document, setDocument] = useState("");

  // Buscar clientes ao montar o componente
  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar clientes:", error);
    } else {
      setClients(data || []);
    }
    setLoading(false);
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { error } = await supabase.from("clients").insert([
      { name, email, document }
    ]);

    if (error) {
      alert("Erro ao cadastrar cliente. Verifique o console.");
      console.error(error);
      return;
    }

    // Limpar formulário e recarregar lista
    setName("");
    setEmail("");
    setDocument("");
    fetchClients();
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Gestão de Clientes</h1>

      {/* Formulário de Cadastro */}
      <div className="p-6 bg-white border rounded shadow-sm">
        <h2 className="text-lg font-medium mb-4">Novo Cliente</h2>
        <form onSubmit={handleAddClient} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="col-span-1 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: Prefeito João"
            />
          </div>
          <div className="col-span-1 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-blue-500 focus:border-blue-500"
              placeholder="contato@cliente.com"
            />
          </div>
          <div className="col-span-1 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Documento (CPF/CNPJ)</label>
            <input
              type="text"
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-blue-500 focus:border-blue-500"
              placeholder="000.000.000-00"
            />
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

      {/* Listagem de Clientes */}
      <div className="bg-white border rounded shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-medium">Clientes Cadastrados</h2>
        </div>
        <div className="p-0">
          {loading ? (
            <p className="p-6 text-gray-500">Carregando...</p>
          ) : clients.length === 0 ? (
            <p className="p-6 text-gray-500">Nenhum cliente cadastrado ainda.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-4 font-medium text-sm text-gray-600">Nome</th>
                  <th className="p-4 font-medium text-sm text-gray-600">E-mail</th>
                  <th className="p-4 font-medium text-sm text-gray-600">Documento</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 text-sm text-gray-800">{client.name}</td>
                    <td className="p-4 text-sm text-gray-600">{client.email || "-"}</td>
                    <td className="p-4 text-sm text-gray-600">{client.document || "-"}</td>
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