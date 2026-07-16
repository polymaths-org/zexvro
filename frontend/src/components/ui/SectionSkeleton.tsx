/** Dashboard in-page skeleton — prefer over brand GIF for console data loads. */

type SectionSkeletonProps = {
  rows?: number;
  className?: string;
  label?: string;
};

export default function SectionSkeleton({
  rows = 4,
  className = '',
  label = 'Loading',
}: SectionSkeletonProps) {
  return (
    <div
      className={`space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#0A0A0B] ${className}`}
      role="status"
      aria-label={label}
    >
      <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-900 animate-pulse" />
      <div className="h-3 w-full max-w-md rounded bg-zinc-200 dark:bg-zinc-900 animate-pulse" />
      <div className="mt-2 space-y-2.5">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
