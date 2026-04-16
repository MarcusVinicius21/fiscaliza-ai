export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-4 animate-pulse rounded-md bg-[#2D3748]"
          style={{ width: `${100 - index * 12}%` }}
        />
      ))}
    </div>
  );
}
