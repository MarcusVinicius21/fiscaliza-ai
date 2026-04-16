interface Step {
  label: string;
  description: string;
}

export function ProgressSteps({
  steps,
  current,
}: {
  steps: Step[];
  current: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      {steps.map((step, index) => {
        const active = index === current;
        const done = index < current;

        return (
          <div
            key={step.label}
            className={[
              "relative overflow-hidden rounded-lg border p-4 transition duration-200",
              active
                ? "border-[rgba(125,211,252,0.54)] bg-[rgba(78,168,222,0.13)] shadow-[0_16px_36px_rgba(78,168,222,0.1)]"
                : done
                  ? "border-[rgba(45,212,191,0.38)] bg-[rgba(45,212,191,0.08)]"
                  : "border-[var(--invest-border)] bg-[rgba(16,24,39,0.58)]",
            ].join(" ")}
          >
            <div className="mb-4 flex items-center justify-between">
              <span
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-md border text-xs font-black",
                  active
                    ? "border-[rgba(125,211,252,0.6)] bg-[rgba(125,211,252,0.18)] text-[var(--invest-cyan)]"
                    : done
                      ? "border-[rgba(45,212,191,0.5)] bg-[rgba(45,212,191,0.14)] text-[var(--invest-success)]"
                      : "border-[var(--invest-border)] text-[var(--invest-muted)]",
                ].join(" ")}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                {done ? "feito" : active ? "agora" : "próximo"}
              </span>
            </div>
            <p className="text-sm font-black text-white">{step.label}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--invest-muted)]">
              {step.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
