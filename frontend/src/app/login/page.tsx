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
      <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-[var(--invest-border)] bg-white p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_12%,rgba(49,92,255,0.12),transparent_32%),radial-gradient(circle_at_84%_0%,rgba(18,184,166,0.12),transparent_28%)]" />
          <div className="relative">
            <p className="invest-eyebrow">Fiscaliza.AI</p>
            <h1 className="mt-5 max-w-2xl text-5xl font-black leading-tight text-[var(--invest-heading)]">
              Dados públicos claros para quem precisa agir.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[var(--invest-muted)]">
              Leia bases, encontre sinais de atenção, abra a origem e comunique
              achados sem perder responsabilidade.
            </p>
          </div>

          <div className="relative grid grid-cols-3 gap-3">
            {["Upload guiado", "Alerta rastreável", "Arte pública"].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-[var(--invest-border)] bg-[#fbfcff] p-4"
              >
                <p className="text-sm font-black text-[var(--invest-heading)]">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">
            <div className="rounded-lg border border-[var(--invest-border)] bg-white p-6 shadow-[var(--invest-shadow)] md:p-8">
              <div>
                <p className="invest-eyebrow">Acesso</p>
                <h2 className="mt-3 text-3xl font-black text-[var(--invest-heading)]">
                  Entrar no painel
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--invest-muted)]">
                  Sessão local do MVP. A autenticação real fica fora deste
                  redesign.
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
