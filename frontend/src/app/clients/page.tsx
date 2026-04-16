"use client";

import { useEffect, useState } from "react";
import { StatusPill } from "@/components/app/status-pill";
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [document, setDocument] = useState("");

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
      { name, email, document },
    ]);

    if (error) {
      alert("Erro ao cadastrar cliente. Verifique o console.");
      console.error(error);
      return;
    }

    setName("");
    setEmail("");
    setDocument("");
    fetchClients();
  };

  return (
    <div className="page-shell">
      <section className="page-header p-6 md:p-8">
        <p className="invest-eyebrow">Clientes</p>
        <h1 className="invest-title mt-3 max-w-4xl text-3xl md:text-5xl">
          Responsáveis por cada base monitorada.
        </h1>
        <p className="invest-subtitle mt-4 max-w-3xl text-base">
          Cadastre quem acompanha as cidades e arquivos sem mexer na análise.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <form onSubmit={handleAddClient} className="rounded-lg border border-[var(--invest-border)] bg-white p-5 shadow-[var(--invest-shadow-soft)]">
          <p className="invest-eyebrow">Novo cliente</p>
          <h2 className="mt-2 text-xl font-black text-[var(--invest-heading)]">
            Cadastro rápido
          </h2>
          <div className="mt-6 space-y-4">
            <div>
              <label className="invest-label">Nome</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="invest-input"
                placeholder="Ex: Gabinete técnico"
              />
            </div>
            <div>
              <label className="invest-label">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="invest-input"
                placeholder="contato@cliente.com"
              />
            </div>
            <div>
              <label className="invest-label">Documento CPF/CNPJ</label>
              <input
                type="text"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                className="invest-input"
                placeholder="000.000.000-00"
              />
            </div>
            <button type="submit" className="invest-button w-full px-4 py-2">
              Cadastrar cliente
            </button>
          </div>
        </form>

        <section className="overflow-hidden rounded-lg border border-[var(--invest-border)] bg-white shadow-[var(--invest-shadow-soft)]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--invest-border)] p-5">
            <div>
              <p className="invest-eyebrow">Carteira</p>
              <h2 className="mt-2 text-xl font-black text-[var(--invest-heading)]">
                Clientes cadastrados
              </h2>
            </div>
            <StatusPill tone="muted">{clients.length} registros</StatusPill>
          </div>

          <div className="invest-soft-scroll overflow-x-auto">
            {loading ? (
              <p className="p-6 text-sm text-[var(--invest-muted)]">
                Carregando...
              </p>
            ) : clients.length === 0 ? (
              <p className="p-6 text-sm text-[var(--invest-muted)]">
                Nenhum cliente cadastrado ainda.
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Documento</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id}>
                      <td className="font-bold text-[var(--invest-heading)]">
                        {client.name}
                      </td>
                      <td>{client.email || "-"}</td>
                      <td>{client.document || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
