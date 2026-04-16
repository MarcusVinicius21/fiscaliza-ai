export function StatusPill({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "danger" | "success" | "muted";
}) {
  const classes = {
    info: "border-[#4EA8DE] text-[#4EA8DE]",
    danger: "border-[#E63946] text-[#E63946]",
    success: "border-emerald-400 text-emerald-300",
    muted: "border-[#2D3748] text-[#CBD5E1]",
  };

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs ${classes[tone]}`}
    >
      {children}
    </span>
  );
}
