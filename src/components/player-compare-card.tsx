import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Shared pieces of the two-player comparison layout (docs/DESIGN_ROADMAP_2026.md
 * #6), used by both /rating/compare and /padel/rating/compare - sport-agnostic,
 * takes plain data, no rating-engine imports.
 */
export function PlayerHead({
  id,
  name,
  image,
  rating,
  align,
}: {
  id: string;
  name: string;
  image: string | null;
  rating: { rating: number; spread: number };
  align: "left" | "right";
}) {
  return (
    <Link
      href={`/players/${id}`}
      className={cn(
        // min-w-0: this Link is itself a grid item (grid-cols-[1fr_auto_1fr]
        // in the parent) - without it, a flex/grid item's default
        // min-width:auto keeps it from shrinking below its content's natural
        // width, so a long name overflowed the card on narrow screens
        // instead of the child's own `truncate` ever kicking in.
        "flex min-w-0 items-center gap-2.5 hover:opacity-90",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <Avatar className="size-10 shrink-0">
        <AvatarImage src={image ?? undefined} alt={name} />
        <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {rating.rating} <span className="text-[0.7rem]">±{rating.spread}</span>
        </p>
      </div>
    </Link>
  );
}

export function CompareRow({
  label,
  valueA,
  valueB,
  better,
}: {
  label: string;
  valueA: string | number;
  valueB: string | number;
  better?: "a" | "b" | null;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t py-2.5 text-sm first:border-t-0">
      <span className={cn("tabular-nums", better === "a" ? "font-bold text-primary" : "text-foreground")}>
        {valueA}
      </span>
      <span className="text-center text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className={cn("text-right tabular-nums", better === "b" ? "font-bold text-primary" : "text-foreground")}>
        {valueB}
      </span>
    </div>
  );
}
