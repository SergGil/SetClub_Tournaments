import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { usePlayers } from '@/features/players/api';
import { useRating } from '@/features/rating/api';
import type { DoublesRatingRow, SinglesRatingRow } from '@/features/rating/types';
import { useTheme } from '@/hooks/use-theme';
import { conservativeOrdinal, conservativeRating } from '@/lib/rating-math';
import { useSport, type Sport } from '@/lib/sport-context';

type Format = 'singles' | 'doubles';

const SPORT_LABEL: Record<Sport, string> = { tennis: 'Теніс', padel: 'Падел' };
const FORMAT_LABEL: Record<Format, string> = { singles: 'Одиночний', doubles: 'Парний' };

type Row = { playerId: string; display: number; matchesPlayed: number; trend: number };

/** Mirrors PROVISIONAL_MATCH_THRESHOLD (src/app/rating/page.tsx on the web) - below this many
 * completed matches, a player's rating is still converging and shows unranked ("–") in its own
 * "ще формується" section instead of holding a numbered spot off a tiny sample. */
const PROVISIONAL_MATCH_THRESHOLD = 10;

type Section = { title: string | null; data: Row[] };

export default function RatingScreen() {
  const { sport, setSport } = useSport();
  const [format, setFormat] = useState<Format>('singles');
  const { data, isLoading, isError } = useRating(sport);
  const { data: playersData } = usePlayers();
  const theme = useTheme();

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const player of playersData?.players ?? []) map.set(player.id, player.name);
    return map;
  }, [playersData]);

  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    if (format === 'singles') {
      return data.singles.ratings
        .map(
          (row: SinglesRatingRow): Row => ({
            playerId: row.playerId,
            display: Math.round(conservativeRating(row.rating)),
            matchesPlayed: row.matchesPlayed,
            trend: data.singles.trend[row.playerId] ?? 0,
          }),
        )
        .sort((a, b) => b.display - a.display);
    }
    return data.doubles.ratings
      .map(
        (row: DoublesRatingRow): Row => ({
          playerId: row.playerId,
          display: Math.round(conservativeOrdinal(row.rating)),
          matchesPlayed: row.matchesPlayed,
          trend: data.doubles.trend[row.playerId] ?? 0,
        }),
      )
      .sort((a, b) => b.display - a.display);
  }, [data, format]);

  const sections: Section[] = useMemo(() => {
    const rankedRows = rows.filter((row) => row.matchesPlayed >= PROVISIONAL_MATCH_THRESHOLD);
    const provisionalRows = rows.filter((row) => row.matchesPlayed < PROVISIONAL_MATCH_THRESHOLD);
    const result: Section[] = [{ title: null, data: rankedRows }];
    if (provisionalRows.length > 0) {
      result.push({
        title: `Менше ${PROVISIONAL_MATCH_THRESHOLD} матчів — рейтинг ще формується`,
        data: provisionalRows,
      });
    }
    return result;
  }, [rows]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.header}>
          <SegmentedControl options={['tennis', 'padel']} labels={SPORT_LABEL} value={sport} onChange={setSport} />
          <SegmentedControl options={['singles', 'doubles']} labels={FORMAT_LABEL} value={format} onChange={setFormat} />
          <Link href={{ pathname: '/(tabs)/rating/compare', params: { sport, format } }} asChild>
            <Pressable style={[styles.compareButton, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small">Порівняти двох гравців →</ThemedText>
            </Pressable>
          </Link>
        </ThemedView>

        {isLoading ? (
          <ActivityIndicator style={styles.center} />
        ) : isError ? (
          <ThemedText style={styles.center}>Не вдалося завантажити рейтинг</ThemedText>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(row) => row.playerId}
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) =>
              section.title ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.sectionHeader}>
                  {section.title}
                </ThemedText>
              ) : sections[0].data.length === 0 && rows.length > 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.sectionHeader}>
                  Ще ніхто не зіграв {PROVISIONAL_MATCH_THRESHOLD}+ матчів цього формату — див. список нижче.
                </ThemedText>
              ) : null
            }
            renderItem={({ item, index, section }) => {
              const provisional = section.title !== null;
              return (
                <ThemedView style={styles.row}>
                  <ThemedText type="smallBold" themeColor={provisional ? 'textSecondary' : undefined} style={styles.rank}>
                    {provisional ? '–' : index + 1}
                  </ThemedText>
                  <ThemedView style={styles.info}>
                    <ThemedText type="smallBold" themeColor={provisional ? 'textSecondary' : undefined}>
                      {nameById.get(item.playerId) ?? item.playerId}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.matchesPlayed} матчів
                    </ThemedText>
                  </ThemedView>
                  <ThemedText type="smallBold" themeColor={provisional ? 'textSecondary' : undefined}>
                    {item.display}
                  </ThemedText>
                  {item.trend !== 0 && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.trend > 0 ? '▲' : '▼'}
                    </ThemedText>
                  )}
                </ThemedView>
              );
            }}
            ListEmptyComponent={<ThemedText style={styles.center}>Немає даних для рейтингу</ThemedText>}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { padding: Spacing.three, gap: Spacing.two },
  compareButton: { alignSelf: 'flex-start', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
  center: { marginTop: Spacing.five, textAlign: 'center' },
  sectionHeader: { paddingTop: Spacing.three, paddingBottom: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#8884',
  },
  rank: { width: 28, textAlign: 'right' },
  info: { flex: 1, gap: Spacing.half },
});
