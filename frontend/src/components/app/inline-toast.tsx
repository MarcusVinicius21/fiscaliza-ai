export function InlineToast({
  title,
  message,
  tone = "info",
}: {
  title: string;
  message: string;
  tone?: "info" | "danger" | "success";
}) {
  const border = {
    info: "border-[#4EA8DE]",
    danger: "border-[#E63946]",
    success: "border-emerald-500",
  };

  return (
    <div className={`rounded-md border ${border[tone]} bg-[#141B2D] p-3`}>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-[#CBD5E1]">{message}</p>
    </div>
  );
}
