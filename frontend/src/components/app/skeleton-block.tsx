export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-4 animate-pulse rounded-md bg-[linear-gradient(90deg,#eef2f8,#dbe7ff,#eef2f8)]"
          style={{ width: `${100 - index * 11}%` }}
        />
      ))}
    </div>
  );
}
