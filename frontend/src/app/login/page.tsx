"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Login tentado com:", email);
    router.push("/dashboard");
  };

  return (
    <main className="min-h-dvh bg-[var(--invest-bg)] text-[var(--invest-text)]">
      <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden overflow-hidden border-r border-[var(--invest-border)] bg-[#060a12] p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(78,168,222,0.16),transparent_36%),linear-gradient(220deg,rgba(245,184,75,0.12),transparent_34%)]" />
          <div className="relative">
            <p className="invest-eyebrow">Fiscaliza.AI</p>
            <h1 className="mt-5 max-w-2xl text-5xl font-black leading-tight text-white">
              Estúdio investigativo para dados públicos.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[var(--invest-muted)]">
              Leia bases públicas, acompanhe alertas e comunique achados com
              rastreabilidade sem declarar conclusões precipitadas.
            </p>
          </div>

          <div className="relative grid grid-cols-3 gap-3">
            {["ETL validado", "IA contextual", "Arte rastreável"].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-[var(--invest-border)] bg-[rgba(16,24,39,0.72)] p-4"
              >
                <p className="text-sm font-black text-white">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">
            <div className="invest-card p-6 md:p-8">
              <div>
                <p className="invest-eyebrow">Acesso restrito</p>
                <h2 className="mt-3 text-3xl font-black text-white">
                  Entrar no painel
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--invest-muted)]">
                  Sessão local para continuidade do MVP. Autenticação real fica
                  fora deste redesign.
                </p>
              </div>

              <form className="mt-7 space-y-5" onSubmit={handleLogin}>
                <div>
                  <label className="invest-label">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="invest-input"
                    placeholder="voce@instituicao.gov.br"
                    required
                  />
                </div>
                <div>
                  <label className="invest-label">Senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="invest-input"
                    placeholder="Digite sua senha"
                    required
                  />
                </div>
                <button type="submit" className="invest-button w-full px-4 py-2">
                  Entrar
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
