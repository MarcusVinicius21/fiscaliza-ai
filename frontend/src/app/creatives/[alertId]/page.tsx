"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

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

  if (sev.includes("alta")) return "#dc2626";
  if (sev.includes("media") || sev.includes("média")) return "#ca8a04";

  return "#2563eb";
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

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, width, 220);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 220, width, 16);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 34px Arial";
  ctx.fillText("Fiscaliza.AI", margin, 92);

  ctx.font = "400 24px Arial";
  ctx.fillText("Transparência pública em linguagem simples", margin, 138);

  ctx.fillStyle = accent;
  ctx.fillRect(margin, 270, 210, 54);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 24px Arial";
  ctx.fillText(
    `Alerta ${severityLabel(data.source.alert?.severity)}`,
    margin + 24,
    305
  );

  ctx.fillStyle = "#111827";
  ctx.font = "700 60px Arial";
  let currentY = drawWrappedText(
    ctx,
    data.creative.title,
    margin,
    410,
    width - margin * 2,
    68,
    3
  );

  currentY += 34;

  ctx.fillStyle = "#374151";
  ctx.font = "400 34px Arial";
  currentY = drawWrappedText(
    ctx,
    data.creative.subtitle,
    margin,
    currentY,
    width - margin * 2,
    44,
    3
  );

  currentY += 50;

  ctx.fillStyle = "#111827";
  ctx.font = "700 42px Arial";
  ctx.fillText(formatMoney(data.source.alert?.amount), margin, currentY);

  currentY += 54;

  ctx.fillStyle = "#4b5563";
  ctx.font = "400 27px Arial";
  ctx.fillText(
    `Fornecedor: ${normalizeLabel(data.source.alert?.supplier_name)}`,
    margin,
    currentY
  );

  currentY += 64;

  ctx.fillStyle = "#1f2937";
  ctx.font = "400 32px Arial";
  currentY = drawWrappedText(
    ctx,
    data.creative.body,
    margin,
    currentY,
    width - margin * 2,
    44,
    5
  );

  currentY += 58;

  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(margin, currentY, width - margin * 2, 2);

  currentY += 56;

  ctx.fillStyle = "#111827";
  ctx.font = "700 30px Arial";
  ctx.fillText("Origem do dado", margin, currentY);

  currentY += 44;

  ctx.fillStyle = "#4b5563";
  ctx.font = "400 25px Arial";
  ctx.fillText(
    `Categoria: ${normalizeLabel(data.source.upload?.category_label)}`,
    margin,
    currentY
  );

  currentY += 36;

  ctx.fillText(
    `Relatório: ${normalizeLabel(
      data.source.upload?.report_type || data.source.upload?.report_label
    )}`,
    margin,
    currentY
  );

  currentY += 36;

  ctx.fillText(
    `Upload: ${normalizeLabel(data.source.upload?.file_name)}`,
    margin,
    currentY
  );

  ctx.fillStyle = "#111827";
  ctx.fillRect(margin, height - 190, width - margin * 2, 86);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 28px Arial";
  drawWrappedText(
    ctx,
    data.creative.cta,
    margin + 32,
    height - 137,
    width - margin * 2 - 64,
    34,
    2
  );

  ctx.fillStyle = "#6b7280";
  ctx.font = "400 22px Arial";
  ctx.fillText(
    `${data.creative.footer} • Alerta ${data.alert_id.slice(0, 8)}`,
    margin,
    height - 48
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
    <div className="space-y-6">
      <header className="space-y-3">
        <Link
          href={`/alerts/${alertId}`}
          className="text-sm text-blue-700 hover:underline"
        >
          Voltar para o alerta
        </Link>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">
            Gerar arte do alerta
          </h1>

          <p className="text-sm text-gray-600">
            Crie uma peça visual simples a partir do alerta selecionado, usando
            o contexto já validado nas etapas anteriores.
          </p>
        </div>
      </header>

      <section className="border rounded bg-white p-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={generateCreative}
            disabled={loading}
            className="border rounded px-4 py-2 text-sm text-white bg-gray-900 disabled:opacity-50"
          >
            {loading ? "Gerando..." : "Gerar arte"}
          </button>

          <button
            type="button"
            onClick={downloadPng}
            disabled={!creativeData}
            className="border rounded px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            Baixar PNG
          </button>
        </div>

        {errorMessage && (
          <div className="border border-red-200 bg-red-50 p-4 rounded text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {!creativeData && !errorMessage && (
          <p className="text-sm text-gray-600">
            Clique em <strong>Gerar arte</strong> para montar o texto com IA e
            aplicar no template visual.
          </p>
        )}

        {creativeData && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
            <div className="overflow-auto border rounded bg-gray-100 p-4">
              <canvas
                ref={canvasRef}
                className="w-full max-w-[540px] mx-auto border bg-white"
              />
            </div>

            <aside className="space-y-4 text-sm">
              <div className="border rounded p-3">
                <p className="text-xs text-gray-500 mb-1">Geração</p>
                <p className="font-medium text-gray-900">
                  {creativeData.ai_used
                    ? "Texto gerado com IA"
                    : "Texto gerado por fallback local"}
                </p>
              </div>

              <div className="border rounded p-3 space-y-2">
                <p className="text-xs text-gray-500">Textos da arte</p>

                <p>
                  <strong>Título:</strong> {creativeData.creative.title}
                </p>

                <p>
                  <strong>Subtítulo:</strong> {creativeData.creative.subtitle}
                </p>

                <p>
                  <strong>Texto:</strong> {creativeData.creative.body}
                </p>

                <p>
                  <strong>CTA:</strong> {creativeData.creative.cta}
                </p>
              </div>

              <div className="border rounded p-3 space-y-2">
                <p className="text-xs text-gray-500">Rastreabilidade</p>

                <p>
                  <strong>Alerta:</strong> {creativeData.alert_id}
                </p>

                <p>
                  <strong>Upload:</strong>{" "}
                  {creativeData.upload_id || "Não informado"}
                </p>

                <p>
                  <strong>Registro origem:</strong>{" "}
                  {creativeData.source_record_id || "Não vinculado"}
                </p>

                <p>
                  <strong>Categoria:</strong>{" "}
                  {normalizeLabel(creativeData.source.upload?.category_label)}
                </p>

                <p>
                  <strong>Fornecedor:</strong>{" "}
                  {normalizeLabel(creativeData.source.alert?.supplier_name)}
                </p>
              </div>

              {creativeData.source.raw_fields &&
                Object.keys(creativeData.source.raw_fields).length > 0 && (
                  <div className="border rounded p-3 space-y-2">
                    <p className="text-xs text-gray-500">
                      Campos de origem usados
                    </p>

                    {Object.entries(creativeData.source.raw_fields).map(
                      ([key, value]) => (
                        <p key={key}>
                          <strong>{key}:</strong> {value}
                        </p>
                      )
                    )}
                  </div>
                )}
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
