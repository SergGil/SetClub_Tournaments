import Link from "next/link";

import { RankTrendArrow } from "@/components/rank-trend-arrow";
import { RatingHistoryChart } from "@/components/rating-history-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { pluralizeUk, POINT_FORMS } from "@/lib/pluralize";
import type { RatingCardData } from "@/lib/rating/player-rating-cards";
import type { RatingHistoryPoint } from "@/lib/rating/ratings-data";

/** The data a profile's "Рейтинг клубу" block needs - both the Tennis and Padel profile sections satisfy it. */
export type PlayerRatingBlock = {
  singlesCard: RatingCardData | null;
  doublesCard: RatingCardData | null;
  singlesHistory: RatingHistoryPoint[];
  doublesHistory: RatingHistoryPoint[];
};

/**
 * Renders nothing when the player has no rating in this block at all.
 * `basePath` is the rating page the cards link through to ("/rating" for
 * Tennis, "/padel/rating" for Padel).
 */
export function RatingClubSection({
  title,
  section,
  poolParam,
  basePath = "/rating",
}: {
  title: string;
  section: PlayerRatingBlock;
  poolParam?: "women";
  basePath?: string;
}) {
  const { singlesCard, doublesCard, singlesHistory, doublesHistory } = section;
  if (!singlesCard && !doublesCard) return null;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {singlesCard && (
          <RatingCard
            format="singles"
            label="Одиночний"
            badgeVariant="accent"
            badgeLabel="Glicko-2"
            history={singlesHistory}
            poolParam={poolParam}
            basePath={basePath}
            {...singlesCard}
          />
        )}
        {doublesCard && (
          <RatingCard
            format="doubles"
            label="Парний"
            badgeVariant="teal"
            badgeLabel="OpenSkill"
            history={doublesHistory}
            poolParam={poolParam}
            basePath={basePath}
            {...doublesCard}
          />
        )}
      </div>
    </div>
  );
}

function RatingCard({
  format,
  label,
  badgeVariant,
  badgeLabel,
  rating,
  spread,
  rank,
  rankDelta,
  total,
  isProvisional,
  setClub,
  history,
  poolParam,
  basePath,
}: {
  format: "singles" | "doubles";
  label: string;
  badgeVariant: "accent" | "teal";
  badgeLabel: string;
  history: RatingHistoryPoint[];
  /** "women" links through to /rating pre-filtered to the women's pool - see docs/RATING.md. */
  poolParam?: "women";
  basePath: string;
} & RatingCardData) {
  const ratingHref = poolParam
    ? `${basePath}?format=${format}&pool=${poolParam}`
    : `${basePath}?format=${format}`;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <Link href={ratingHref} className="flex flex-col gap-3 transition hover:opacity-90">
          <p className="text-sm font-medium text-muted-foreground">{label} рейтинг</p>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {rating}
                <span className="ml-1 text-sm font-normal text-muted-foreground">±{spread}</span>
              </p>
              {isProvisional ? (
                <p className="text-sm text-muted-foreground">Рейтинг ще формується</p>
              ) : (
                <p className="text-sm tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground"># {rank}</span> з {total} гравців
                  <RankTrendArrow delta={rankDelta} />
                </p>
              )}
            </div>
            <Badge variant={badgeVariant}>{badgeLabel}</Badge>
          </div>

          {setClub && (
            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <div>
                <p className="text-lg font-semibold tabular-nums">
                  {setClub.points}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {pluralizeUk(setClub.points, POINT_FORMS)}
                  </span>
                </p>
                <p className="text-sm tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground"># {setClub.rank}</span> з {setClub.total}{" "}
                  гравців
                  <RankTrendArrow delta={setClub.rankDelta} />
                </p>
              </div>
              <Badge variant="orange">SET.club</Badge>
            </div>
          )}
        </Link>

        {history.length >= 2 && (
          <div className="border-t pt-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Рейтинг у часі</p>
            <RatingHistoryChart points={history} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
