export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="skeleton-line h-4 animate-pulse rounded-md"
          style={{ width: `${100 - index * 11}%` }}
        />
      ))}
    </div>
  );
}
