import type { PlayerSport } from "@/generated/prisma/enums";

export type SportKey = "TENNIS" | "PADEL";

/** Player.sports values that count as "plays this sport": the sport itself, or BOTH. */
export function sportsMatching(sport: SportKey): PlayerSport[] {
  return [sport, "BOTH"];
}

export function playsSport(player: { sports: PlayerSport }, sport: SportKey): boolean {
  return player.sports === sport || player.sports === "BOTH";
}
