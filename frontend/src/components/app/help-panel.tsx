export function HelpPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="rounded-md border border-[#2D3748] bg-[#141B2D] p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-2 text-sm text-[#CBD5E1]">{children}</div>
    </aside>
  );
}
