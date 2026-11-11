import {
  buildGiantKillerMatchIds,
  buildPlayerAchievements,
  toAchievementMatchInput,
  toAchievementTitleInput,
} from "./achievements";
import type { Achievement, AchievementMatchInput, AchievementSport, RawAchievementMatch } from "./achievements";
import { getPadelUpsetWinsByPlayer } from "./rating/padel-ratings-data";
import { getUpsetWinsByPlayer } from "./rating/ratings-data";
import { getPadelRoundRobinTitles, getRoundRobinTitles } from "./tournament-titles";

/**
 * One player's achievements for ONE sport, from that sport's already-fetched match rows -
 * the single place that assembles the pieces (match normalization, "giant killer" upset
 * lookup, round-robin titles, the badge catalog) so the Tennis profile, the Padel profile
 * and the mobile achievements route can't drift apart.
 *
 * `womensOnlyTournamentIds` is the sport's set from getWomensOnlyTournamentIds /
 * getPadelWomensOnlyTournamentIds. The women's pool is built only from those tournaments, so
 * its upset index is fetched only when the player actually played in one (two club-wide
 * replays skipped for almost every profile view). The same set decides a title's scope, so a
 * women's-only round robin counts toward the women's badges exactly like its matches do.
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
  const [upsetIndexes, roundRobinTitles] = await Promise.all([
    Promise.all(
      scopes.flatMap((scope) =>
        (["SINGLES", "DOUBLES"] as const).map((matchType) =>
          sport === "padel" ? getPadelUpsetWinsByPlayer(matchType, scope) : getUpsetWinsByPlayer(matchType, scope),
        ),
      ),
    ),
    // Club-wide and cross-request cached, like the upset indexes - only this
    // player's own titles are kept below.
    sport === "padel" ? getPadelRoundRobinTitles() : getRoundRobinTitles(),
  ]);

  const giantKillerMatchIds = buildGiantKillerMatchIds(playerId, upsetIndexes);
  const inputs = matches
    .map((m) =>
      toAchievementMatchInput(m, playerId, giantKillerMatchIds.has(m.id), {
        sport,
        womensOnly: womensOnlyTournamentIds.has(m.tournamentId),
      }),
    )
    .filter((m): m is AchievementMatchInput => m !== null);
  const titles = roundRobinTitles
    .filter((t) => t.winnerIds.includes(playerId))
    .map((t) => toAchievementTitleInput(t, { sport, womensOnly: womensOnlyTournamentIds.has(t.tournamentId) }));
  return buildPlayerAchievements(inputs, { playerId, gender, sport, titles });
}
