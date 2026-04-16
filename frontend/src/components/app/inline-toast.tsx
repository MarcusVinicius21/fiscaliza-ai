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
    info: "border-blue-200 bg-blue-50 text-blue-800",
    danger: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };

  return (
    <div className={`rounded-lg border p-4 ${classes[tone]}`} role="status">
      <p className="text-sm font-black">{title}</p>
      <p className="mt-1 text-sm leading-6">{message}</p>
    </div>
  );
}
