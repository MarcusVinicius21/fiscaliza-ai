export function StatusPill({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "danger" | "success" | "muted" | "warning";
}) {
  const classes = {
    info: "status-pill-info",
    danger: "status-pill-danger",
    success: "status-pill-success",
    warning: "status-pill-warning",
    muted: "status-pill-muted",
  };

  return (
    <span
      className={`status-pill inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-extrabold ${classes[tone]}`}
    >
      {children}
    </span>
  );
}
