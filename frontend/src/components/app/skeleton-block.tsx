export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-4 animate-pulse rounded-md bg-[linear-gradient(90deg,rgba(148,163,184,0.08),rgba(125,211,252,0.16),rgba(148,163,184,0.08))]"
          style={{ width: `${100 - index * 11}%` }}
        />
      ))}
    </div>
  );
}
