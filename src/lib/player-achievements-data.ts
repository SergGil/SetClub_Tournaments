import { buildGiantKillerMatchIds, buildPlayerAchievements, toAchievementMatchInput } from "./achievements";
import type { Achievement, AchievementMatchInput, AchievementSport, RawAchievementMatch } from "./achievements";
import { getPadelUpsetWinsByPlayer } from "./rating/padel-ratings-data";
import { getUpsetWinsByPlayer } from "./rating/ratings-data";

/**
 * One player's achievements for ONE sport, from that sport's already-fetched match rows -
 * the single place that assembles the pieces (match normalization, "giant killer" upset
 * lookup, the badge catalog) so the Tennis profile, the Padel profile and the mobile
 * achievements route can't drift apart.
 *
 * `womensOnlyTournamentIds` is the sport's set from getWomensOnlyTournamentIds /
 * getPadelWomensOnlyTournamentIds. The women's pool is built only from those tournaments, so
 * its upset index is fetched only when the player actually played in one (two club-wide
 * replays skipped for almost every profile view).
 */
export async function loadPlayerAchievements({
  sport,
  playerId,
  gender,
  matches,
  womensOnlyTournamentIds,
}: {
  sport: AchievementSport;
  playerId: string;
  gender: "MALE" | "FEMALE" | null;
  matches: RawAchievementMatch[];
  womensOnlyTournamentIds: Set<string>;
}): Promise<Achievement[]> {
  const hasWomensTournamentMatch = matches.some((m) => womensOnlyTournamentIds.has(m.tournamentId));
  const scopes = hasWomensTournamentMatch ? (["general", "women"] as const) : (["general"] as const);
  const upsetIndexes = await Promise.all(
    scopes.flatMap((scope) =>
      (["SINGLES", "DOUBLES"] as const).map((matchType) =>
        sport === "padel" ? getPadelUpsetWinsByPlayer(matchType, scope) : getUpsetWinsByPlayer(matchType, scope),
      ),
    ),
  );

  const giantKillerMatchIds = buildGiantKillerMatchIds(playerId, upsetIndexes);
  const inputs = matches
    .map((m) =>
      toAchievementMatchInput(m, playerId, giantKillerMatchIds.has(m.id), {
        sport,
        womensOnly: womensOnlyTournamentIds.has(m.tournamentId),
      }),
    )
    .filter((m): m is AchievementMatchInput => m !== null);
  return buildPlayerAchievements(inputs, { playerId, gender, sport });
}
