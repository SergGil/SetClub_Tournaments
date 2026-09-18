import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { usePlayers } from '@/features/players/api';
import { PlayerPicker } from '@/features/players/player-picker';
import { useRating, useRatingHistory } from '@/features/rating/api';
import { RatingCompareChart } from '@/features/rating/compare-chart';
import { useTheme } from '@/hooks/use-theme';
import { conservativeOrdinal, conservativeRating, displaySpread } from '@/lib/rating-math';
import type { Sport } from '@/lib/sport-context';

type Format = 'singles' | 'doubles';

const SPORT_LABEL: Record<Sport, string> = { tennis: 'Теніс', padel: 'Падел' };
const FORMAT_LABEL: Record<Format, string> = { singles: 'Одиночний', doubles: 'Парний' };
const COLOR_A = '#3c87f7';
const COLOR_B = '#f59e0b';

type Summary = { rating: number; spread: number; matchesPlayed: number } | null;

/**
 * Mobile twin of /rating/compare (docs/DESIGN_ROADMAP_2026.md #6) - two
 * players' rating-over-time history side by side, same data source
 * (GET /api/v1/players/[id]/rating-history, added alongside this screen)
 * and chart technique as the web page, adapted to react-native-svg. Scoped
 * to the official Glicko-2/OpenSkill rating only (no head-to-head/win-rate
 * rows) - those would need their own new API endpoints, kept out of this
 * first mobile pass.
 */
export default function RatingCompareScreen() {
  const params = useLocalSearchParams<{ sport?: string; format?: string }>();
  const [sport, setSport] = useState<Sport>(params.sport === 'padel' ? 'padel' : 'tennis');
  const [format, setFormat] = useState<Format>(params.format === 'doubles' ? 'doubles' : 'singles');
  const [idA, setIdA] = useState('');
  const [idB, setIdB] = useState('');
  const theme = useTheme();

  const { data: playersData } = usePlayers();
  const players = useMemo(
    () => (playersData?.players ?? []).map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)),
    [playersData],
  );
  const nameById = useMemo(() => new Map(players.map((p) => [p.id, p.name])), [players]);

  const { data: ratingData } = useRating(sport);
  const historyA = useRatingHistory(idA, sport, format);
  const historyB = useRatingHistory(idB, sport, format);

  const summaries: [Summary, Summary] = useMemo(() => {
    if (!ratingData) return [null, null];
    const summaryFor = (playerId: string): Summary => {
      if (!playerId) return null;
      if (format === 'singles') {
        const row = ratingData.singles.ratings.find((r) => r.playerId === playerId);
        if (!row) return null;
        return { rating: Math.round(conservativeRating(row.rating)), spread: Math.round(row.rating.rd), matchesPlayed: row.matchesPlayed };
      }
      const row = ratingData.doubles.ratings.find((r) => r.playerId === playerId);
      if (!row) return null;
      return {
        rating: Math.round(conservativeOrdinal(row.rating)),
        spread: Math.round(displaySpread(row.rating.sigma)),
        matchesPlayed: row.matchesPlayed,
      };
    };
    return [summaryFor(idA), summaryFor(idB)];
  }, [ratingData, idA, idB, format]);

  const ready = Boolean(idA && idB);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedView style={styles.filters}>
            <SegmentedControl options={['tennis', 'padel']} labels={SPORT_LABEL} value={sport} onChange={setSport} />
            <SegmentedControl options={['singles', 'doubles']} labels={FORMAT_LABEL} value={format} onChange={setFormat} />
          </ThemedView>

          <ThemedView style={styles.pickers}>
            <PlayerPicker label="Гравець A" players={players} excludeId={idB} value={idA} onChange={setIdA} />
            <PlayerPicker label="Гравець B" players={players} excludeId={idA} value={idB} onChange={setIdB} />
          </ThemedView>

          {!ready && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              Оберіть двох гравців вище, щоб порівняти їхній рейтинг.
            </ThemedText>
          )}

          {ready && (
            <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
              <ThemedView style={styles.summaryRow}>
                <ThemedView style={styles.summaryCol}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {nameById.get(idA)}
                  </ThemedText>
                  {summaries[0] ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {summaries[0].rating} ±{summaries[0].spread} · {summaries[0].matchesPlayed} матчів
                    </ThemedText>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      Ще не грав(-ла)
                    </ThemedText>
                  )}
                </ThemedView>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  VS
                </ThemedText>
                <ThemedView style={[styles.summaryCol, styles.summaryColRight]}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {nameById.get(idB)}
                  </ThemedText>
                  {summaries[1] ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {summaries[1].rating} ±{summaries[1].spread} · {summaries[1].matchesPlayed} матчів
                    </ThemedText>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      Ще не грав(-ла)
                    </ThemedText>
                  )}
                </ThemedView>
              </ThemedView>

              {historyA.isLoading || historyB.isLoading ? (
                <ActivityIndicator style={styles.chartLoading} />
              ) : (
                <RatingCompareChart
                  seriesA={historyA.data?.history ?? []}
                  seriesB={historyB.data?.history ?? []}
                  colorA={COLOR_A}
                  colorB={COLOR_B}
                />
              )}

              <ThemedView style={styles.legendRow}>
                <ThemedView style={styles.legendItem}>
                  <ThemedView style={[styles.swatch, { backgroundColor: COLOR_A }]} />
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {nameById.get(idA)}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.legendItem}>
                  <ThemedView style={[styles.swatch, { backgroundColor: COLOR_B }]} />
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {nameById.get(idB)}
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  filters: { gap: Spacing.two },
  pickers: { gap: Spacing.two },
  hint: { textAlign: 'center', marginTop: Spacing.five },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  summaryCol: { flex: 1, gap: Spacing.half },
  summaryColRight: { alignItems: 'flex-end' },
  chartLoading: { height: 140 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.four },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, maxWidth: 140 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
});
