export default function PostCardSkeleton() {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-3 w-3 rounded-full" />
        <div className="skeleton h-3 w-14 rounded" />
      </div>
      <div className="skeleton h-5 w-4/5 rounded mb-2" />
      <div className="skeleton h-3.5 w-full rounded mb-1.5" />
      <div className="skeleton h-3.5 w-2/3 rounded mb-4" />
      <div className="skeleton h-3.5 w-16 rounded" />
    </div>
  );
}
