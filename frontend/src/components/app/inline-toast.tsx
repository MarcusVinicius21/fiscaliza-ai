export function InlineToast({
  title,
  message,
  tone = "info",
}: {
  title: string;
  message: string;
  tone?: "info" | "danger" | "success";
}) {
  const classes = {
    info: "border-[rgba(125,211,252,0.34)] bg-[rgba(78,168,222,0.1)]",
    danger: "border-[rgba(230,57,70,0.34)] bg-[rgba(230,57,70,0.1)]",
    success: "border-[rgba(45,212,191,0.34)] bg-[rgba(45,212,191,0.1)]",
  };

  return (
    <div className={`rounded-lg border p-4 ${classes[tone]}`} role="status">
      <p className="text-sm font-black text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--invest-muted)]">
        {message}
      </p>
    </div>
  );
}
