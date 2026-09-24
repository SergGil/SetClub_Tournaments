import { TrophyIcon } from "lucide-react";

import type { BracketNode, BracketTree } from "@/lib/playoff-bracket-tree";
import { displayName } from "@/lib/player-display";
import type { MatchWithDetails } from "@/lib/queries/matches";
import { cn } from "@/lib/utils";

const BOX_WIDTH = 176;
const BOX_HEIGHT = 56;
const COL_GAP = 40;
const ROW_GAP = 20;
// Room for the round-label row (1/4, 1/2, Фінал…) above the match boxes -
// every y-coordinate below is shifted down by this much.
const LABEL_HEIGHT = 28;
// The bronze box's own "За 3 місце" label sits above it in normal flow
// (label + MatchBox stacked, not just the box alone) - its wrapper is
// therefore taller than BOX_HEIGHT, so totalHeight needs this much extra
// room past the box's own bottom edge or the wrapper visually overflows the
// declared container height (harmless-looking on its own, except the parent
// overflow-x-auto container's overflow-y computes to "auto" too per the CSS
// Overflow spec - see tournament-standings sticky-header investigation for
// the same rule - so a few stray px of overflow here turns into a real,
// pointless vertical scrollbar).
const BRONZE_LABEL_HEIGHT = 20;

function sideNames(match: MatchWithDetails, side: "A" | "B"): string {
  const players = match.players.filter((p) => p.side === side);
  if (players.length === 0) return "?";
  return players.map((p) => displayName(p.player)).join(" / ");
}

function sideScore(match: MatchWithDetails, side: "A" | "B"): string {
  // "тех." marks the side that lost by technical default (walkover) - the
  // opponent won a real, awarded match, not a "тех." result of their own.
  if (match.walkover) return side === match.winnerSide ? "" : "тех.";
  if (match.sets.length === 0) return "";
  return match.sets.map((s) => (side === "A" ? s.sideAGames : s.sideBGames)).join(" ");
}

function MatchBox({ match }: { match: MatchWithDetails }) {
  const winnerSide = match.winnerSide;
  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border bg-card text-xs shadow-sm"
      style={{ height: BOX_HEIGHT }}
    >
      {(["A", "B"] as const).map((side) => (
        <div
          key={side}
          className={cn(
            "flex h-1/2 min-w-0 items-center justify-between gap-2 px-2",
            side === "A" && "border-b",
            winnerSide === side && "bg-primary/10 font-semibold",
          )}
        >
          <span className="min-w-0 truncate" title={sideNames(match, side)}>
            {sideNames(match, side)}
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{sideScore(match, side)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Renders BracketTree as a connected diagram - SVG lines over absolutely
 * positioned match boxes, same technique as the original mockup
 * (docs/DESIGN_ROADMAP_2026.md #2), but with box coordinates computed from
 * the actual tree shape (leaf round evenly spaced, each later round's box
 * centered on its resolved children) instead of hardcoded pixels, so it
 * works for whatever size bracket a real tournament actually has.
 */
export function TournamentBracket({ tree }: { tree: BracketTree }) {
  const yById = new Map<string, number>();
  const shallow = tree.columns[0];
  shallow.nodes.forEach((node, i) => {
    yById.set(node.match.id, i * (BOX_HEIGHT + ROW_GAP) + BOX_HEIGHT / 2);
  });
  for (let c = 1; c < tree.columns.length; c++) {
    for (const node of tree.columns[c].nodes) {
      const childYs = [node.sideA.source, node.sideB.source]
        .filter((s): s is BracketNode => s !== null)
        .map((s) => yById.get(s.match.id)!);
      const y =
        childYs.length > 0
          ? childYs.reduce((a, b) => a + b, 0) / childYs.length
          : yById.size * (BOX_HEIGHT + ROW_GAP) + BOX_HEIGHT / 2;
      yById.set(node.match.id, y);
    }
  }

  const finalNode = tree.columns[tree.columns.length - 1]?.nodes[0];
  const finalY = finalNode ? yById.get(finalNode.match.id)! : 0;
  const bronzeY = tree.bronze ? Math.max(...Array.from(yById.values())) + BOX_HEIGHT + ROW_GAP : 0;

  const maxY = Math.max(...Array.from(yById.values()), bronzeY || 0);
  const totalHeight = maxY + BOX_HEIGHT / 2 + 8 + LABEL_HEIGHT + (tree.bronze ? BRONZE_LABEL_HEIGHT : 0);
  const champion =
    finalNode && finalNode.match.status === "COMPLETED" && finalNode.match.winnerSide
      ? sideNames(finalNode.match, finalNode.match.winnerSide)
      : null;
  // The champion badge needs room for a full doubles-pair name ("Іванов Іван
  // / Петренко Петро"), not just one BOX_WIDTH column - it sits past the
  // last column, so the bracket needs extra width to fit it instead of
  // squeezing the name down to a near-useless truncated stub.
  const championWidth = champion ? Math.max(BOX_WIDTH, Math.min(340, champion.length * 8 + 48)) : 0;
  // totalWidth must cover whichever extends furthest right: the last
  // column's boxes (bronze sits at that same left/width, so it's already
  // covered), or the champion badge past them. Previously this only ever
  // considered one or the other depending on whether bronze existed, so a
  // long doubles-pair champion name alongside a bronze match rendered wider
  // than the declared totalWidth - the badge visually overflowed its
  // "w-fit" container, forcing a real (but bogus) horizontal scrollbar
  // instead of the container just being wide enough for its own content.
  const lastColumnRight = (tree.columns.length - 1) * (BOX_WIDTH + COL_GAP) + BOX_WIDTH;
  const championRight = champion ? lastColumnRight + 16 + championWidth : 0;
  const totalWidth = Math.max(lastColumnRight, championRight) + 24;

  return (
    // w-fit + max-w-full: hugs the diagram's actual width (a small
    // Фінал-only bracket doesn't leave a huge empty gap to the right) but
    // still caps at the available space, so overflow-x-auto only ever
    // scrolls when the diagram is genuinely wider than the page - a real
    // 4-round bracket on a narrow screen, not every bracket regardless of size.
    <div className="w-fit max-w-full overflow-x-auto pb-2">
      <div className="relative" style={{ width: totalWidth, height: totalHeight }}>
        {tree.columns.map((col, ci) => (
          <p
            key={col.round}
            className="absolute top-0 text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase"
            style={{ left: ci * (BOX_WIDTH + COL_GAP), width: BOX_WIDTH }}
          >
            {col.round}
          </p>
        ))}

        <svg className="absolute inset-0" width={totalWidth} height={totalHeight} aria-hidden>
          <g fill="none" stroke="var(--border)" strokeWidth={2}>
            {tree.columns.slice(1).map((col, ci) => {
              const x = (ci + 1) * (BOX_WIDTH + COL_GAP);
              return col.nodes.map((node) => {
                const nodeY = yById.get(node.match.id)! + LABEL_HEIGHT;
                return [node.sideA.source, node.sideB.source]
                  .filter((s): s is BracketNode => s !== null)
                  .map((source) => {
                    const childY = yById.get(source.match.id)! + LABEL_HEIGHT;
                    const childRight = ci * (BOX_WIDTH + COL_GAP) + BOX_WIDTH;
                    const midX = childRight + COL_GAP / 2;
                    return (
                      <path
                        key={`${node.match.id}-${source.match.id}`}
                        d={`M${childRight},${childY} H${midX} V${nodeY} H${x}`}
                      />
                    );
                  });
              });
            })}
          </g>
        </svg>

        {tree.columns.map((col, ci) => (
          <div key={col.round}>
            {col.nodes.map((node) => (
              <div
                key={node.match.id}
                className="absolute"
                style={{
                  left: ci * (BOX_WIDTH + COL_GAP),
                  top: yById.get(node.match.id)! - BOX_HEIGHT / 2 + LABEL_HEIGHT,
                  width: BOX_WIDTH,
                }}
              >
                <MatchBox match={node.match} />
              </div>
            ))}
          </div>
        ))}

        {tree.bronze && (
          <div
            className="absolute"
            style={{
              left: (tree.columns.length - 1) * (BOX_WIDTH + COL_GAP),
              top: bronzeY - BOX_HEIGHT / 2 + LABEL_HEIGHT,
              width: BOX_WIDTH,
            }}
          >
            <p className="mb-1 text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
              За 3 місце
            </p>
            <MatchBox match={tree.bronze} />
          </div>
        )}

        {champion && (
          <div
            className="absolute flex items-center gap-1.5 rounded-lg bg-home-accent px-2.5 py-1.5 text-xs font-bold text-home-accent-ink"
            style={{
              left: tree.columns.length * (BOX_WIDTH + COL_GAP) - COL_GAP + 16,
              top: finalY - 14 + LABEL_HEIGHT,
              width: championWidth,
            }}
            title={champion}
          >
            <TrophyIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="leading-snug break-words">{champion}</span>
          </div>
        )}
      </div>
    </div>
  );
}
