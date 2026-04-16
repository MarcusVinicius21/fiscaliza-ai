export function HelpPanel({
  title,
  eyebrow = "Guia rápido",
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="invest-card-highlight p-5">
      <p className="invest-eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-lg font-black text-white">{title}</h2>
      <div className="mt-4 text-sm leading-6 text-[var(--invest-muted)]">
        {children}
      </div>
    </aside>
  );
}
