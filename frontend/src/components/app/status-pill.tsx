export function StatusPill({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "danger" | "success" | "muted" | "warning";
}) {
  const classes = {
    info: "border-blue-200 bg-blue-50 text-blue-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-orange-200 bg-orange-50 text-orange-700",
    muted: "border-slate-200 bg-slate-50 text-slate-600",
  };

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-extrabold ${classes[tone]}`}
    >
      {children}
    </span>
  );
}
