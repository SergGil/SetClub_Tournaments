import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-9 w-64 rounded-lg" />
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-px bg-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-11 rounded-none bg-card" />
          ))}
        </div>
      </div>
    </div>
  );
}
