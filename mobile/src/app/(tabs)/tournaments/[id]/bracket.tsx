import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useMatches } from '@/features/matches/api';
import { BracketView } from '@/features/tournaments/bracket-view';
import { buildBracketTree } from '@/lib/playoff-bracket-tree';

/**
 * Mobile twin of the web bracket view (docs/DESIGN_ROADMAP_2026.md #2,
 * tournament-bracket.tsx) - reachable from the tournament screen's own
 * "Сітка плей-офф" link, list-only otherwise (the flat matches list already
 * covers every match; this is purely the visual 1/8→1/4→1/2→Фінал diagram).
 */
export default function TournamentBracketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError } = useMatches({ tournamentId: id });

  const tree = useMemo(() => (data ? buildBracketTree(data.matches) : null), [data]);

  if (isLoading) return <ActivityIndicator style={styles.center} />;
  if (isError) return <ThemedText style={styles.center}>Не вдалося завантажити матчі</ThemedText>;
  if (!tree) {
    return (
      <ThemedText style={styles.center}>
        Сітку плей-офф ще не можна побудувати - потрібен принаймні один завершений матч у турнірній сітці (1/8-1/2) і
        матч «Фінал».
      </ThemedText>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <BracketView tree={tree} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.three },
  center: { marginTop: Spacing.five, textAlign: 'center', paddingHorizontal: Spacing.four },
});
