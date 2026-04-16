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
    <aside className="rounded-lg border border-[var(--invest-border)] bg-white p-5 shadow-[var(--invest-shadow-soft)]">
      <p className="invest-eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-lg font-black text-[var(--invest-heading)]">
        {title}
      </h2>
      <div className="mt-4 text-sm leading-6 text-[var(--invest-muted)]">
        {children}
      </div>
    </aside>
  );
}
