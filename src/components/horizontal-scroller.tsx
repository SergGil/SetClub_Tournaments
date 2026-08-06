"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const DEFAULT_SCROLL_STEP_PX = 280;

/**
 * Horizontal scroller with edge fades + arrow buttons that fade/disable at
 * the start/end - plain CSS scroll-snap alone gives no visible cue that
 * there's more to see, and a mouse wheel scrolls the page vertically rather
 * than this row, so desktop visitors without a trackpad had no discoverable
 * way to see the rest. Shared shell for any horizontally-scrolling strip
 * (match result tiles, monthly activity bars, ...) - callers own the
 * item markup and widths, this only owns the scroll chrome.
 */
export function HorizontalScroller({
  children,
  scrollStepPx = DEFAULT_SCROLL_STEP_PX,
  className,
}: {
  children: ReactNode;
  scrollStepPx?: number;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  function updateEdges() {
    const el = scrollerRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 0);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }

  function scrollByStep(direction: 1 | -1) {
    scrollerRef.current?.scrollBy({ left: direction * scrollStepPx, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={updateEdges}
        className={cn("flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1", className)}
      >
        {children}
      </div>
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity",
          atStart ? "opacity-0" : "opacity-100",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent transition-opacity",
          atEnd ? "opacity-0" : "opacity-100",
        )}
      />
      <button
        type="button"
        aria-label="Прокрутити ліворуч"
        onClick={() => scrollByStep(-1)}
        disabled={atStart}
        className="absolute top-1/2 left-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border bg-card shadow-sm transition-opacity hover:bg-muted disabled:pointer-events-none disabled:opacity-0"
      >
        <ChevronLeftIcon className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Прокрутити праворуч"
        onClick={() => scrollByStep(1)}
        disabled={atEnd}
        className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border bg-card shadow-sm transition-opacity hover:bg-muted disabled:pointer-events-none disabled:opacity-0"
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  );
}
