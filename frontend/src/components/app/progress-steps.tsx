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
              "rounded-md border p-3",
              active
                ? "border-[#4EA8DE] bg-[#141B2D]"
                : done
                  ? "border-emerald-500/60 bg-[#141B2D]"
                  : "border-[#2D3748] bg-[#0C111F]",
            ].join(" ")}
          >
            <p className="text-sm font-semibold text-white">{step.label}</p>
            <p className="mt-1 text-xs text-[#CBD5E1]">{step.description}</p>
          </div>
        );
      })}
    </div>
  );
}
