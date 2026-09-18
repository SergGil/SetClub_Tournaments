"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Список лишається за замовчуванням (docs/DESIGN_ROADMAP_2026.md #2) -
 * перемикач на візуальну сітку зберігається лише локально (useState, не URL)
 * і скидається при новому заході на сторінку. Власні кнопки, а не
 * PillFilterGroup/PillFilterLink - той компонент навігує через <Link>
 * (зміна URL), тут перемикання суто локальне, без переходу.
 */
export function PlayoffViewToggle({ list, bracket }: { list: ReactNode; bracket: ReactNode | null }) {
  const [view, setView] = useState<"list" | "bracket">("list");

  if (!bracket) return <>{list}</>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-fit gap-1 rounded-lg bg-muted p-1 text-sm">
        <button
          type="button"
          onClick={() => setView("list")}
          aria-pressed={view === "list"}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition-colors",
            view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Список
        </button>
        <button
          type="button"
          onClick={() => setView("bracket")}
          aria-pressed={view === "bracket"}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition-colors",
            view === "bracket" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Сітка
        </button>
      </div>
      {view === "list" ? list : bracket}
    </div>
  );
}
