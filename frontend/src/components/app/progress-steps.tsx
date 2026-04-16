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
              "rounded-lg border bg-white p-4 transition duration-200",
              active
                ? "border-[rgba(49,92,255,0.34)] shadow-[0_14px_28px_rgba(49,92,255,0.1)]"
                : done
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-[var(--invest-border)]",
            ].join(" ")}
          >
            <div className="mb-4 flex items-center justify-between">
              <span
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-black",
                  active
                    ? "border-[var(--invest-primary)] bg-[var(--invest-primary)] text-white"
                    : done
                      ? "border-emerald-200 bg-white text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-500",
                ].join(" ")}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--invest-faint)]">
                {done ? "feito" : active ? "agora" : "próximo"}
              </span>
            </div>
            <p className="text-sm font-black text-[var(--invest-heading)]">
              {step.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--invest-muted)]">
              {step.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
