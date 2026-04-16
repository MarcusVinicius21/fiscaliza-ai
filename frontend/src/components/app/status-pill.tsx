export function StatusPill({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "danger" | "success" | "muted" | "warning";
}) {
  const classes = {
    info: "border-[rgba(125,211,252,0.36)] bg-[rgba(78,168,222,0.12)] text-[var(--invest-cyan)]",
    danger: "border-[rgba(230,57,70,0.42)] bg-[rgba(230,57,70,0.12)] text-[#ff9aa2]",
    success: "border-[rgba(45,212,191,0.42)] bg-[rgba(45,212,191,0.12)] text-[var(--invest-success)]",
    warning: "border-[rgba(245,184,75,0.42)] bg-[rgba(245,184,75,0.12)] text-[var(--invest-warning)]",
    muted: "border-[rgba(148,163,184,0.24)] bg-[rgba(15,23,42,0.58)] text-[var(--invest-muted)]",
  };

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-extrabold ${classes[tone]}`}
    >
      {children}
    </span>
  );
}
