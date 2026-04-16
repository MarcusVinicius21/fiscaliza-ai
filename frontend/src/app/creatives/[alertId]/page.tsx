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

type StatusTone = "info" | "danger" | "success" | "muted" | "warning";

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
  if (sev.includes("alta")) return "#e63946";
  if (sev.includes("media") || sev.includes("média")) return "#f97316";
  return "#315cff";
}

function severityTone(value: unknown): StatusTone {
  const sev = String(value || "").toLowerCase();
  if (sev.includes("alta")) return "danger";
  if (sev.includes("media") || sev.includes("média")) return "warning";
  return "info";
}

function parseAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

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

  ctx.fillStyle = "#f5f7fb";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(54, 54, width - 108, height - 108);
  ctx.strokeStyle = "#dbe3ef";
  ctx.lineWidth = 2;
  ctx.strokeRect(54, 54, width - 108, height - 108);

  ctx.fillStyle = accent;
  ctx.fillRect(54, 54, width - 108, 14);

  ctx.fillStyle = "#111827";
  ctx.font = "800 34px Arial";
  ctx.fillText("Fiscaliza.AI", margin, 126);

  ctx.fillStyle = "#667085";
  ctx.font = "400 24px Arial";
  ctx.fillText("Dados públicos em linguagem simples", margin, 168);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(margin, 220, 260, 62);
  ctx.strokeStyle = "#dbe3ef";
  ctx.strokeRect(margin, 220, 260, 62);

  ctx.fillStyle = accent;
  ctx.font = "800 24px Arial";
  ctx.fillText(
    `Alerta ${severityLabel(data.source.alert?.severity)}`,
    margin + 24,
    260
  );

  ctx.fillStyle = "#070b18";
  ctx.font = "800 62px Arial";
  let currentY = drawWrappedText(
    ctx,
    data.creative.title,
    margin,
    386,
    width - margin * 2,
    70,
    3
  );

  currentY += 34;

  ctx.fillStyle = "#344054";
  ctx.font = "400 34px Arial";
  currentY = drawWrappedText(
    ctx,
    data.creative.subtitle,
    margin,
    currentY,
    width - margin * 2,
    45,
    3
  );

  currentY += 58;

  ctx.fillStyle = accent;
  ctx.font = "800 48px Arial";
  ctx.fillText(formatMoney(data.source.alert?.amount), margin, currentY);

  currentY += 62;

  ctx.fillStyle = "#667085";
  ctx.font = "400 28px Arial";
  currentY = drawWrappedText(
    ctx,
    `Fornecedor: ${normalizeLabel(data.source.alert?.supplier_name)}`,
    margin,
    currentY,
    width - margin * 2,
    38,
    2
  );

  currentY += 66;

  ctx.fillStyle = "#111827";
  ctx.font = "400 32px Arial";
  currentY = drawWrappedText(
    ctx,
    data.creative.body,
    margin,
    currentY,
    width - margin * 2,
    45,
    5
  );

  currentY += 58;

  ctx.strokeStyle = "#e3e8f2";
  ctx.beginPath();
  ctx.moveTo(margin, currentY);
  ctx.lineTo(width - margin, currentY);
  ctx.stroke();

  currentY += 54;

  ctx.fillStyle = "#070b18";
  ctx.font = "800 29px Arial";
  ctx.fillText("Origem do dado", margin, currentY);

  currentY += 46;

  ctx.fillStyle = "#667085";
  ctx.font = "400 25px Arial";
  ctx.fillText(
    `Categoria: ${normalizeLabel(data.source.upload?.category_label)}`,
    margin,
    currentY
  );

  currentY += 38;
  ctx.fillText(
    `Tipo: ${normalizeLabel(
      data.source.upload?.report_type || data.source.upload?.report_label
    )}`,
    margin,
    currentY
  );

  currentY += 38;
  drawWrappedText(
    ctx,
    `Arquivo: ${normalizeLabel(data.source.upload?.file_name)}`,
    margin,
    currentY,
    width - margin * 2,
    34,
    2
  );

  ctx.fillStyle = "#111827";
  ctx.fillRect(margin, height - 214, width - margin * 2, 88);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 28px Arial";
  drawWrappedText(
    ctx,
    data.creative.cta,
    margin + 30,
    height - 160,
    width - margin * 2 - 60,
    34,
    2
  );

  ctx.fillStyle = "#667085";
  ctx.font = "400 22px Arial";
  ctx.fillText(
    `${data.creative.footer} - Alerta ${data.alert_id.slice(0, 8)}`,
    margin,
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
    <div className="page-shell">
      <section className="page-header p-6 md:p-8">
        <Link
          href={`/alerts/${alertId}`}
          className="invest-button-secondary mb-5 w-fit px-4 py-2 text-sm"
        >
          Voltar para o alerta
        </Link>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <p className="invest-eyebrow">Arte do alerta</p>
            <h1 className="invest-title mt-3 max-w-4xl text-3xl md:text-5xl">
              Gere uma peça clara, forte e rastreável.
            </h1>
            <p className="invest-subtitle mt-4 max-w-3xl text-base">
              A IA sugere texto. O canvas monta a arte localmente e o PNG não é
              salvo no banco.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--invest-border)] bg-white p-5 shadow-[var(--invest-shadow-soft)]">
            <p className="invest-eyebrow">Passos</p>
            <div className="mt-4 space-y-3 text-sm text-[var(--invest-muted)]">
              <p>1. Gerar texto pelo backend.</p>
              <p>2. Revisar a prévia.</p>
              <p>3. Baixar PNG com origem visível.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--invest-border)] bg-white p-5 shadow-[var(--invest-shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="invest-eyebrow">Workspace</p>
            <h2 className="mt-2 text-xl font-black text-[var(--invest-heading)]">
              Prévia da peça
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
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {!creativeData && !errorMessage && (
          <div className="mt-5 rounded-lg border border-[var(--invest-border)] bg-[#fbfcff] p-5 text-sm leading-6 text-[var(--invest-muted)]">
            Clique em <strong className="text-[var(--invest-heading)]">Gerar arte</strong> para
            montar uma peça vertical com título, valor, origem e chamada pública.
          </div>
        )}

        {creativeData && (
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="rounded-lg border border-[var(--invest-border)] bg-[#f5f7fb] p-4">
              <div className="invest-soft-scroll overflow-auto rounded-lg bg-white p-4 shadow-inner">
                <canvas
                  ref={canvasRef}
                  className="mx-auto w-full max-w-[560px] border border-[var(--invest-border)] bg-white"
                />
              </div>
            </div>

            <aside className="space-y-4 text-sm">
              <div className="rounded-lg border border-[var(--invest-border)] bg-white p-4">
                <p className="metric-label">Geração</p>
                <div className="mt-3">
                  <StatusPill tone={creativeData.ai_used ? "success" : "muted"}>
                    {creativeData.ai_used
                      ? "Texto gerado com IA"
                      : "Fallback local"}
                  </StatusPill>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--invest-border)] bg-white p-4">
                <p className="metric-label">Textos da arte</p>
                <div className="mt-4 space-y-3 text-[var(--invest-muted)]">
                  <p>
                    <strong className="text-[var(--invest-heading)]">Título:</strong>{" "}
                    {creativeData.creative.title}
                  </p>
                  <p>
                    <strong className="text-[var(--invest-heading)]">Subtítulo:</strong>{" "}
                    {creativeData.creative.subtitle}
                  </p>
                  <p>
                    <strong className="text-[var(--invest-heading)]">Texto:</strong>{" "}
                    {creativeData.creative.body}
                  </p>
                  <p>
                    <strong className="text-[var(--invest-heading)]">CTA:</strong>{" "}
                    {creativeData.creative.cta}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--invest-border)] bg-white p-4">
                <p className="metric-label">Rastreabilidade</p>
                <div className="mt-4 space-y-3 text-[var(--invest-muted)]">
                  <p>
                    <strong className="text-[var(--invest-heading)]">Alerta:</strong>{" "}
                    {creativeData.alert_id}
                  </p>
                  <p>
                    <strong className="text-[var(--invest-heading)]">Upload:</strong>{" "}
                    {creativeData.upload_id || "Não informado"}
                  </p>
                  <p>
                    <strong className="text-[var(--invest-heading)]">Registro origem:</strong>{" "}
                    {creativeData.source_record_id || "Não vinculado"}
                  </p>
                  <p>
                    <strong className="text-[var(--invest-heading)]">Categoria:</strong>{" "}
                    {normalizeLabel(creativeData.source.upload?.category_label)}
                  </p>
                  <p>
                    <strong className="text-[var(--invest-heading)]">Fornecedor:</strong>{" "}
                    {normalizeLabel(creativeData.source.alert?.supplier_name)}
                  </p>
                  <p>
                    <strong className="text-[var(--invest-heading)]">Severidade:</strong>{" "}
                    <StatusPill tone={severityTone(creativeData.source.alert?.severity)}>
                      {normalizeLabel(creativeData.source.alert?.severity)}
                    </StatusPill>
                  </p>
                </div>
              </div>

              {creativeData.source.raw_fields &&
                Object.keys(creativeData.source.raw_fields).length > 0 && (
                  <div className="rounded-lg border border-[var(--invest-border)] bg-white p-4">
                    <p className="metric-label">Campos usados</p>
                    <div className="mt-4 space-y-3 text-[var(--invest-muted)]">
                      {Object.entries(creativeData.source.raw_fields).map(
                        ([key, value]) => (
                          <p key={key}>
                            <strong className="text-[var(--invest-heading)]">{key}:</strong>{" "}
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
