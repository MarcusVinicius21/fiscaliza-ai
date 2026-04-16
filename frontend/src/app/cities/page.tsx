"use client";

import { useEffect, useState } from "react";
import { StatusPill } from "@/components/app/status-pill";
import { supabase } from "@/lib/supabase";

interface City {
  id: string;
  name: string;
  state: string;
  portal_url: string;
  clients?: { name: string };
}

interface Client {
  id: string;
  name: string;
}

export default function CitiesPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, name")
      .order("name");
    setClients(clientsData || []);

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
      { name, state, portal_url: portalUrl, client_id: clientId },
    ]);

    if (error) {
      alert("Erro ao cadastrar cidade.");
      console.error(error);
      return;
    }

    setName("");
    setState("");
    setPortalUrl("");
    setClientId("");
    fetchData();
  };

  return (
    <div className="page-shell">
      <section className="page-header p-6 md:p-8">
        <p className="invest-eyebrow">Cidades</p>
        <h1 className="invest-title mt-3 max-w-4xl text-3xl md:text-5xl">
          Bases públicas prontas para fiscalização.
        </h1>
        <p className="invest-subtitle mt-4 max-w-3xl text-base">
          Organize município, UF, portal e cliente responsável. A análise
          continua intocada.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">
        <form onSubmit={handleAddCity} className="rounded-lg border border-[var(--invest-border)] bg-white p-5 shadow-[var(--invest-shadow-soft)]">
          <p className="invest-eyebrow">Nova cidade</p>
          <h2 className="mt-2 text-xl font-black text-[var(--invest-heading)]">
            Base monitorada
          </h2>
          <div className="mt-6 space-y-4">
            <div>
              <label className="invest-label">Nome da cidade</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="invest-input"
                placeholder="Ex: São Paulo"
              />
            </div>
            <div>
              <label className="invest-label">Estado UF</label>
              <input
                type="text"
                required
                maxLength={2}
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                className="invest-input"
                placeholder="Ex: SP"
              />
            </div>
            <div>
              <label className="invest-label">Portal da Transparência</label>
              <input
                type="url"
                value={portalUrl}
                onChange={(e) => setPortalUrl(e.target.value)}
                className="invest-input"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="invest-label">Cliente vinculado</label>
              <select
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="invest-select"
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="invest-button w-full px-4 py-2">
              Cadastrar cidade
            </button>
          </div>
        </form>

        <section className="overflow-hidden rounded-lg border border-[var(--invest-border)] bg-white shadow-[var(--invest-shadow-soft)]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--invest-border)] p-5">
            <div>
              <p className="invest-eyebrow">Mapa operacional</p>
              <h2 className="mt-2 text-xl font-black text-[var(--invest-heading)]">
                Cidades cadastradas
              </h2>
            </div>
            <StatusPill tone="muted">{cities.length} bases</StatusPill>
          </div>

          <div className="invest-soft-scroll overflow-x-auto">
            {loading ? (
              <p className="p-6 text-sm text-[var(--invest-muted)]">
                Carregando...
              </p>
            ) : cities.length === 0 ? (
              <p className="p-6 text-sm text-[var(--invest-muted)]">
                Nenhuma cidade cadastrada ainda.
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cidade/UF</th>
                    <th>Cliente responsável</th>
                    <th>Portal</th>
                  </tr>
                </thead>
                <tbody>
                  {cities.map((city) => (
                    <tr key={city.id}>
                      <td className="font-bold text-[var(--invest-heading)]">
                        {city.name} - {city.state}
                      </td>
                      <td>{city.clients?.name || "Não vinculado"}</td>
                      <td>
                        {city.portal_url ? (
                          <a
                            href={city.portal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-[var(--invest-primary)] hover:underline"
                          >
                            Acessar portal
                          </a>
                        ) : (
                          <span className="text-[var(--invest-muted)]">
                            Sem link
                          </span>
                        )}
                      </td>
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
