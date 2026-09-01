import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { scoreSummary, sideNames } from '@/features/matches/format';
import { useMatches } from '@/features/matches/api';
import type { Match } from '@/features/matches/types';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { isDomainAdmin } from '@/lib/permissions';
import { sportDomain, useSport, type Sport } from '@/lib/sport-context';

const SPORT_LABEL: Record<Sport, string> = { tennis: 'Теніс', padel: 'Падел' };

function MatchRow({ item }: { item: Match }) {
  const theme = useTheme();
  return (
    <Link href={`/(tabs)/matches/${item.id}`} asChild>
      <Pressable style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">
          {sideNames(item, 'A')} — {sideNames(item, 'B')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {item.tournament.name}
          {item.round ? ` · ${item.round}` : ''} · {scoreSummary(item)}
        </ThemedText>
      </Pressable>
    </Link>
  );
}

export default function MatchesListScreen() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId?: string }>();
  const { data, isLoading, isError, refetch, isRefetching } = useMatches({ tournamentId });
  const { session } = useAuth();
  const router = useRouter();
  const { sport, setSport } = useSport();
  const canCreate = Boolean(tournamentId) && isDomainAdmin(session?.user, sportDomain(sport));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {!tournamentId && (
          <ThemedView style={styles.sportRow}>
            <SegmentedControl options={['tennis', 'padel']} labels={SPORT_LABEL} value={sport} onChange={setSport} />
          </ThemedView>
        )}
        {canCreate && (
          <ThemedView style={styles.header}>
            <Pressable
              style={styles.addButton}
              onPress={() => router.push({ pathname: '/(tabs)/matches/new', params: { tournamentId } })}>
              <ThemedText themeColor="background" type="smallBold">
                + Матч
              </ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {isLoading ? (
          <ActivityIndicator style={styles.center} />
        ) : isError ? (
          <ThemedText style={styles.center}>Не вдалося завантажити матчі</ThemedText>
        ) : (
          <FlatList
            data={data?.matches ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MatchRow item={item} />}
            contentContainerStyle={styles.list}
            refreshing={isRefetching}
            onRefresh={refetch}
            ListEmptyComponent={<ThemedText style={styles.center}>Матчів не знайдено</ThemedText>}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  sportRow: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  header: { padding: Spacing.three, alignItems: 'flex-end' },
  addButton: { backgroundColor: '#3c87f7', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  row: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
  center: { marginTop: Spacing.five, textAlign: 'center' },
});
