import { Skeleton } from "@/components/ui/skeleton";

export function TableLoadingSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-40" />
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-px bg-border">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-11 rounded-none bg-card" />
          ))}
        </div>
      </div>
    </div>
  );
}
