"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { StatusPill } from "@/components/app/status-pill";

interface CreativeText {
  title: string;
  subtitle: string;
  body: string;
  cta: string;
  footer: string;
}

interface CreativeSource {
  alert?: {
    title?: string | null;
    explanation?: string | null;
    severity?: string | null;
    amount?: number | string | null;
    supplier_name?: string | null;
  };
  upload?: {
    file_name?: string | null;
    category?: string | null;
    category_label?: string | null;
    report_type?: string | null;
    report_label?: string | null;
    analysis_status?: string | null;
  };
  raw_fields?: Record<string, string>;
}

interface CreativeResponse {
  status: string;
  ai_used: boolean;
  alert_id: string;
  upload_id?: string | null;
  source_record_id?: string | null;
  creative: CreativeText;
  source: CreativeSource;
}

function normalizeLabel(value: unknown) {
  const txt = String(value || "").trim();
  return txt || "Não informado";
}

function severityLabel(value: unknown) {
  const sev = String(value || "").toLowerCase();

  if (sev.includes("alta")) return "Alta";
  if (sev.includes("media") || sev.includes("média")) return "Média";
  if (sev.includes("baixa")) return "Baixa";

  return "Baixa";
}

function severityColor(value: unknown) {
  const sev = String(value || "").toLowerCase();

  if (sev.includes("alta")) return "#E63946";
  if (sev.includes("media") || sev.includes("média")) return "#F5B84B";

  return "#4EA8DE";
}

function severityTone(value: unknown) {
  const sev = String(value || "").toLowerCase();
  if (sev.includes("alta")) return "danger";
  if (sev.includes("media") || sev.includes("média")) return "warning";
  return "info";
}

function parseAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value)
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: unknown) {
  return parseAmount(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  const words = String(text || "").split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const width = ctx.measureText(test).width;

    if (width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  return lines;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const lines = wrapCanvasText(ctx, text, maxWidth).slice(0, maxLines);

  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });

  return y + lines.length * lineHeight;
}

function drawCreative(canvas: HTMLCanvasElement, data: CreativeResponse) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = 1080;
  const height = 1350;
  const margin = 76;
  const accent = severityColor(data.source.alert?.severity);

  canvas.width = width;
  canvas.height = height;

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#070A0F");
  gradient.addColorStop(0.48, "#101827");
  gradient.addColorStop(1, "#06080D");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(125, 211, 252, 0.13)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 54) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(16, 24, 39, 0.88)";
  ctx.fillRect(margin, 70, width - margin * 2, height - 140);
  ctx.strokeStyle = "rgba(148, 163, 184, 0.24)";
  ctx.strokeRect(margin, 70, width - margin * 2, height - 140);

  ctx.fillStyle = accent;
  ctx.fillRect(margin, 70, 12, height - 140);

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "800 34px Arial";
  ctx.fillText("FISCALIZA.AI", margin + 44, 136);

  ctx.fillStyle = "#A8B3C7";
  ctx.font = "400 24px Arial";
  ctx.fillText("Transparência pública em linguagem simples", margin + 44, 178);

  ctx.fillStyle = "rgba(3, 7, 18, 0.62)";
  ctx.fillRect(margin + 44, 230, 238, 58);
  ctx.strokeStyle = accent;
  ctx.strokeRect(margin + 44, 230, 238, 58);

  ctx.fillStyle = accent;
  ctx.font = "800 23px Arial";
  ctx.fillText(
    `Alerta ${severityLabel(data.source.alert?.severity)}`,
    margin + 66,
    268
  );

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "800 62px Arial";
  let currentY = drawWrappedText(
    ctx,
    data.creative.title,
    margin + 44,
    395,
    width - margin * 2 - 88,
    70,
    3
  );

  currentY += 34;

  ctx.fillStyle = "#CBD5E1";
  ctx.font = "400 34px Arial";
  currentY = drawWrappedText(
    ctx,
    data.creative.subtitle,
    margin + 44,
    currentY,
    width - margin * 2 - 88,
    45,
    3
  );

  currentY += 58;

  ctx.fillStyle = accent;
  ctx.font = "800 46px Arial";
  ctx.fillText(formatMoney(data.source.alert?.amount), margin + 44, currentY);

  currentY += 58;

  ctx.fillStyle = "#A8B3C7";
  ctx.font = "400 27px Arial";
  currentY = drawWrappedText(
    ctx,
    `Fornecedor: ${normalizeLabel(data.source.alert?.supplier_name)}`,
    margin + 44,
    currentY,
    width - margin * 2 - 88,
    36,
    2
  );

  currentY += 68;

  ctx.fillStyle = "#E2E8F0";
  ctx.font = "400 32px Arial";
  currentY = drawWrappedText(
    ctx,
    data.creative.body,
    margin + 44,
    currentY,
    width - margin * 2 - 88,
    45,
    5
  );

  currentY += 58;

  ctx.strokeStyle = "rgba(148, 163, 184, 0.28)";
  ctx.beginPath();
  ctx.moveTo(margin + 44, currentY);
  ctx.lineTo(width - margin - 44, currentY);
  ctx.stroke();

  currentY += 56;

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "800 29px Arial";
  ctx.fillText("Origem do dado", margin + 44, currentY);

  currentY += 46;

  ctx.fillStyle = "#CBD5E1";
  ctx.font = "400 25px Arial";
  ctx.fillText(
    `Categoria: ${normalizeLabel(data.source.upload?.category_label)}`,
    margin + 44,
    currentY
  );

  currentY += 38;

  ctx.fillText(
    `Relatório: ${normalizeLabel(
      data.source.upload?.report_type || data.source.upload?.report_label
    )}`,
    margin + 44,
    currentY
  );

  currentY += 38;

  drawWrappedText(
    ctx,
    `Upload: ${normalizeLabel(data.source.upload?.file_name)}`,
    margin + 44,
    currentY,
    width - margin * 2 - 88,
    34,
    2
  );

  ctx.fillStyle = accent;
  ctx.fillRect(margin + 44, height - 214, width - margin * 2 - 88, 88);

  ctx.fillStyle = "#04111D";
  ctx.font = "800 28px Arial";
  drawWrappedText(
    ctx,
    data.creative.cta,
    margin + 74,
    height - 160,
    width - margin * 2 - 148,
    34,
    2
  );

  ctx.fillStyle = "#A8B3C7";
  ctx.font = "400 22px Arial";
  ctx.fillText(
    `${data.creative.footer} • Alerta ${data.alert_id.slice(0, 8)}`,
    margin + 44,
    height - 78
  );
}

export default function CreativeByAlertPage() {
  const params = useParams<{ alertId: string }>();
  const alertId = params.alertId;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [creativeData, setCreativeData] = useState<CreativeResponse | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (creativeData && canvasRef.current) {
      drawCreative(canvasRef.current, creativeData);
    }
  }, [creativeData]);

  async function generateCreative() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `http://localhost:8000/creatives/generate/${alertId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.detail || "Falha ao gerar arte para este alerta."
        );
      }

      setCreativeData(payload as CreativeResponse);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao gerar arte para este alerta."
      );
    } finally {
      setLoading(false);
    }
  }

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `fiscaliza-alerta-${alertId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="invest-page">
      <section className="invest-page-hero p-6 md:p-8">
        <Link
          href={`/alerts/${alertId}`}
          className="invest-button-secondary mb-5 w-fit px-4 py-2 text-sm"
        >
          Voltar para o alerta
        </Link>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <p className="invest-eyebrow">Ateliê de comunicação</p>
            <h1 className="invest-title mt-3 max-w-4xl text-3xl md:text-5xl">
              Gere uma arte pública a partir de um alerta rastreável.
            </h1>
            <p className="invest-subtitle mt-4 max-w-3xl text-base">
              A IA gera somente o texto. O template visual é local, exportável
              em PNG e mantém a origem do alerta visível.
            </p>
          </div>

          <div className="invest-card p-5">
            <p className="invest-eyebrow">Fluxo</p>
            <div className="mt-4 space-y-3 text-sm text-[var(--invest-muted)]">
              <p>1. Gerar texto responsável no backend.</p>
              <p>2. Aplicar no canvas local.</p>
              <p>3. Baixar PNG sem salvar arte no banco.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="invest-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="invest-eyebrow">Controle</p>
            <h2 className="mt-2 text-xl font-black text-white">
              Gerador visual
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={generateCreative}
              disabled={loading}
              className="invest-button px-5 py-2 text-sm"
            >
              {loading ? "Gerando..." : "Gerar arte"}
            </button>

            <button
              type="button"
              onClick={downloadPng}
              disabled={!creativeData}
              className="invest-button-secondary px-5 py-2 text-sm disabled:opacity-50"
            >
              Baixar PNG
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-5 rounded-lg border border-[rgba(230,57,70,0.4)] bg-[rgba(230,57,70,0.1)] p-4 text-sm text-[#ffb4ba]">
            {errorMessage}
          </div>
        )}

        {!creativeData && !errorMessage && (
          <div className="mt-5 rounded-lg border border-[var(--invest-border)] bg-[rgba(3,7,18,0.28)] p-5 text-sm leading-6 text-[var(--invest-muted)]">
            Clique em <strong className="text-white">Gerar arte</strong> para
            montar o texto com IA e aplicar no template executivo.
          </div>
        )}

        {creativeData && (
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="rounded-lg border border-[var(--invest-border)] bg-[#030712] p-4">
              <div className="invest-soft-scroll overflow-auto rounded-md bg-[rgba(255,255,255,0.03)] p-4">
                <canvas
                  ref={canvasRef}
                  className="mx-auto w-full max-w-[560px] border border-[rgba(148,163,184,0.2)] bg-white"
                />
              </div>
            </div>

            <aside className="space-y-4 text-sm">
              <div className="invest-card-solid p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                  Geração
                </p>
                <div className="mt-3">
                  <StatusPill tone={creativeData.ai_used ? "success" : "muted"}>
                    {creativeData.ai_used
                      ? "Texto gerado com IA"
                      : "Fallback local"}
                  </StatusPill>
                </div>
              </div>

              <div className="invest-card-solid p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                  Textos da arte
                </p>
                <div className="mt-4 space-y-3 text-[var(--invest-muted)]">
                  <p>
                    <strong className="text-white">Título:</strong>{" "}
                    {creativeData.creative.title}
                  </p>
                  <p>
                    <strong className="text-white">Subtítulo:</strong>{" "}
                    {creativeData.creative.subtitle}
                  </p>
                  <p>
                    <strong className="text-white">Texto:</strong>{" "}
                    {creativeData.creative.body}
                  </p>
                  <p>
                    <strong className="text-white">CTA:</strong>{" "}
                    {creativeData.creative.cta}
                  </p>
                </div>
              </div>

              <div className="invest-card-solid p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                  Rastreabilidade
                </p>
                <div className="mt-4 space-y-3 text-[var(--invest-muted)]">
                  <p>
                    <strong className="text-white">Alerta:</strong>{" "}
                    {creativeData.alert_id}
                  </p>
                  <p>
                    <strong className="text-white">Upload:</strong>{" "}
                    {creativeData.upload_id || "Não informado"}
                  </p>
                  <p>
                    <strong className="text-white">Registro origem:</strong>{" "}
                    {creativeData.source_record_id || "Não vinculado"}
                  </p>
                  <p>
                    <strong className="text-white">Categoria:</strong>{" "}
                    {normalizeLabel(creativeData.source.upload?.category_label)}
                  </p>
                  <p>
                    <strong className="text-white">Fornecedor:</strong>{" "}
                    {normalizeLabel(creativeData.source.alert?.supplier_name)}
                  </p>
                  <p>
                    <strong className="text-white">Severidade:</strong>{" "}
                    <StatusPill tone={severityTone(creativeData.source.alert?.severity)}>
                      {normalizeLabel(creativeData.source.alert?.severity)}
                    </StatusPill>
                  </p>
                </div>
              </div>

              {creativeData.source.raw_fields &&
                Object.keys(creativeData.source.raw_fields).length > 0 && (
                  <div className="invest-card-solid p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                      Campos de origem usados
                    </p>

                    <div className="mt-4 space-y-3 text-[var(--invest-muted)]">
                      {Object.entries(creativeData.source.raw_fields).map(
                        ([key, value]) => (
                          <p key={key}>
                            <strong className="text-white">{key}:</strong>{" "}
                            {value}
                          </p>
                        )
                      )}
                    </div>
                  </div>
                )}
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
