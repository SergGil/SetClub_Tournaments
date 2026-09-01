import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCommitDoublesTeams, useCommitSinglesRoundRobin, useDrawDoublesTeams } from '@/features/randomize/api';
import type { DoublesDrawState, NamedMatchup } from '@/features/randomize/types';
import { useTournament } from '@/features/tournaments/api';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';

/**
 * Only the two most common randomizer strategies are wired up so far:
 * singles round robin (ALL/SEEDED_SPLIT) and the plain doubles team draw.
 * CUSTOM_GROUPS, GROUPS_12_PLAYOFF, and the doubles "За групами" strategy
 * are the same draw/commit pattern - see docs/MOBILE_APP.md for what's left.
 */
export default function RandomizeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { data } = useTournament(id);
  const tournament = data?.tournament;

  const commitSingles = useCommitSinglesRoundRobin(id);
  const drawDoubles = useDrawDoublesTeams(id);
  const commitDoubles = useCommitDoublesTeams(id);
  const [draw, setDraw] = useState<Extract<DoublesDrawState, { ok: true }> | null>(null);

  if (!tournament) return <ActivityIndicator style={styles.center} />;

  function runSingles(strategy: 'ALL' | 'SEEDED_SPLIT', acknowledgedCompletedLoss = false) {
    commitSingles.mutate(
      { strategy, acknowledgedCompletedLoss },
      {
        onSuccess: (result) => {
          if (result.error) {
            Alert.alert('Не вдалося сформувати матчі', result.error, [
              { text: 'Скасувати', style: 'cancel' },
              { text: 'Підтвердити', style: 'destructive', onPress: () => runSingles(strategy, true) },
            ]);
            return;
          }
          Alert.alert('Готово', `Згенеровано ${result.matchCount} матч(ів)`, [
            { text: 'OK', onPress: () => router.back() },
          ]);
        },
        onError: (err) => Alert.alert('Помилка', err instanceof ApiError ? err.message : 'Не вдалося сформувати матчі'),
      },
    );
  }

  function runDrawDoubles() {
    setDraw(null);
    drawDoubles.mutate(undefined, {
      onSuccess: (result) => {
        if (!result.ok) {
          Alert.alert('Не вдалося сформувати жеребкування', result.error);
          return;
        }
        setDraw(result);
      },
      onError: (err) => Alert.alert('Помилка', err instanceof ApiError ? err.message : 'Не вдалося сформувати жеребкування'),
    });
  }

  function commitDrawDoubles(matchups: NamedMatchup[], acknowledgedCompletedLoss = false) {
    commitDoubles.mutate(
      { matchups, acknowledgedCompletedLoss },
      {
        onSuccess: (result) => {
          if (result.error) {
            Alert.alert('Не вдалося зберегти матчі', result.error, [
              { text: 'Скасувати', style: 'cancel' },
              { text: 'Підтвердити', style: 'destructive', onPress: () => commitDrawDoubles(matchups, true) },
            ]);
            return;
          }
          Alert.alert('Готово', `Згенеровано ${result.matchCount} матч(ів)`, [
            { text: 'OK', onPress: () => router.back() },
          ]);
        },
        onError: (err) => Alert.alert('Помилка', err instanceof ApiError ? err.message : 'Не вдалося зберегти матчі'),
      },
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {tournament.format === 'SINGLES' && (
          <>
            <ThemedText type="smallBold">Одиночний round robin</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Замінює всі наявні матчі турніру новими.
            </ThemedText>
            <Pressable
              style={[styles.button, { backgroundColor: theme.backgroundElement }]}
              disabled={commitSingles.isPending}
              onPress={() => runSingles('ALL')}>
              {commitSingles.isPending ? <ActivityIndicator /> : <ThemedText type="small">Усі проти всіх</ThemedText>}
            </Pressable>
            <Pressable
              style={[styles.button, { backgroundColor: theme.backgroundElement }]}
              disabled={commitSingles.isPending}
              onPress={() => runSingles('SEEDED_SPLIT')}>
              {commitSingles.isPending ? <ActivityIndicator /> : <ThemedText type="small">Сіяні окремо від несіяних</ThemedText>}
            </Pressable>
          </>
        )}

        {tournament.format === 'DOUBLES' && (
          <>
            <ThemedText type="smallBold">Парне жеребкування</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Замінює всі наявні матчі турніру новими.
            </ThemedText>
            <Pressable
              style={[styles.button, { backgroundColor: theme.backgroundElement }]}
              disabled={drawDoubles.isPending}
              onPress={runDrawDoubles}>
              {drawDoubles.isPending ? <ActivityIndicator /> : <ThemedText type="small">{draw ? 'Перегенерувати' : 'Жеребкувати пари'}</ThemedText>}
            </Pressable>

            {draw && (
              <ThemedView style={[styles.preview, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">Пари ({draw.randomTeams.length + draw.fixedTeams.length})</ThemedText>
                {[...draw.fixedTeams, ...draw.randomTeams].map((team) => (
                  <ThemedText key={team.playerIds.join('-')} type="small">
                    {team.names.join(' / ')}
                  </ThemedText>
                ))}
                <ThemedText type="smallBold" style={styles.matchupsTitle}>
                  Матчі ({draw.matchups.length})
                </ThemedText>
                {draw.matchups.map((matchup, index) => (
                  <ThemedText key={index} type="small" themeColor="textSecondary">
                    {matchup.sideA.names.join('/')} — {matchup.sideB.names.join('/')}
                  </ThemedText>
                ))}
                <Pressable
                  style={styles.submit}
                  disabled={commitDoubles.isPending}
                  onPress={() => commitDrawDoubles(draw.matchups)}>
                  {commitDoubles.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText themeColor="background">Підтвердити</ThemedText>
                  )}
                </Pressable>
              </ThemedView>
            )}
          </>
        )}

        {tournament.format === 'MIXED' && (
          <ThemedText type="small" themeColor="textSecondary">
            MIXED-турніри не використовують рандомайзер — керуйте матчами через &quot;Команди та
            зустрічі&quot; на картці турніру.
          </ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, marginTop: Spacing.five },
  content: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.six },
  button: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, borderRadius: Spacing.two, alignItems: 'center' },
  preview: { marginTop: Spacing.three, padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
  matchupsTitle: { marginTop: Spacing.two },
  submit: {
    marginTop: Spacing.three,
    backgroundColor: '#3c87f7',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
