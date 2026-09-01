import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  useCommitDoublesGroups,
  useCommitDoublesTeams,
  useCommitGroups12Playoff,
  useCommitSinglesGroups,
  useCommitSinglesRoundRobin,
  useDrawDoublesGroups,
  useDrawDoublesTeams,
  useDrawGroups12Playoff,
  useDrawSinglesGroups,
} from '@/features/randomize/api';
import type {
  DoublesDrawState,
  DoublesGroupDrawState,
  Groups12PlayoffDrawState,
  NamedGroupedMatchup,
  NamedMatchup,
  NamedSinglesMatchup,
  SinglesGroupDrawState,
} from '@/features/randomize/types';
import { useTournament } from '@/features/tournaments/api';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';

type Extracted<T> = Extract<T, { ok: true }>;

/** Generic success/error handler for every "commit" mutation below - all share the same {error?, cascadeResets-less} shape and the same completed-matches confirm dialog. */
function handleCommit(
  result: { error?: string; matchCount?: number },
  onRetry: (acknowledgedCompletedLoss: true) => void,
  onSuccess: () => void,
) {
  if (result.error) {
    Alert.alert('Не вдалося зберегти матчі', result.error, [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Підтвердити', style: 'destructive', onPress: () => onRetry(true) },
    ]);
    return;
  }
  Alert.alert('Готово', `Згенеровано ${result.matchCount} матч(ів)`, [{ text: 'OK', onPress: onSuccess }]);
}

export default function RandomizeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { data } = useTournament(id);
  const tournament = data?.tournament;
  const done = () => router.back();

  const commitSingles = useCommitSinglesRoundRobin(id);
  const drawSinglesGroups = useDrawSinglesGroups(id);
  const commitSinglesGroups = useCommitSinglesGroups(id);
  const drawGroups12 = useDrawGroups12Playoff(id);
  const commitGroups12 = useCommitGroups12Playoff(id);
  const drawDoubles = useDrawDoublesTeams(id);
  const commitDoubles = useCommitDoublesTeams(id);
  const drawDoublesGroups = useDrawDoublesGroups(id);
  const commitDoublesGroups = useCommitDoublesGroups(id);

  const [singlesGroupsDraw, setSinglesGroupsDraw] = useState<Extracted<SinglesGroupDrawState> | null>(null);
  const [groups12Draw, setGroups12Draw] = useState<Extracted<Groups12PlayoffDrawState> | null>(null);
  const [doublesDraw, setDoublesDraw] = useState<Extracted<DoublesDrawState> | null>(null);
  const [doublesGroupsDraw, setDoublesGroupsDraw] = useState<Extracted<DoublesGroupDrawState> | null>(null);

  if (!tournament) return <ActivityIndicator style={styles.center} />;

  function runSingles(strategy: 'ALL' | 'SEEDED_SPLIT', acknowledgedCompletedLoss = false) {
    commitSingles.mutate(
      { strategy, acknowledgedCompletedLoss },
      {
        onSuccess: (result) => handleCommit(result, (ack) => runSingles(strategy, ack), done),
        onError: (err) => Alert.alert('Помилка', err instanceof ApiError ? err.message : 'Не вдалося сформувати матчі'),
      },
    );
  }

  function runDrawSinglesGroups() {
    setSinglesGroupsDraw(null);
    drawSinglesGroups.mutate(undefined, {
      onSuccess: (result) => (result.ok ? setSinglesGroupsDraw(result) : Alert.alert('Не вдалося', result.error)),
      onError: (err) => Alert.alert('Помилка', err instanceof ApiError ? err.message : 'Не вдалося сформувати жеребкування'),
    });
  }

  function commitSinglesGroupsDraw(matchups: NamedSinglesMatchup[], groupAssignment: Record<string, number>, acknowledgedCompletedLoss = false) {
    commitSinglesGroups.mutate(
      { groupAssignment, matchups, acknowledgedCompletedLoss },
      {
        onSuccess: (result) => handleCommit(result, (ack) => commitSinglesGroupsDraw(matchups, groupAssignment, ack), done),
        onError: (err) => Alert.alert('Помилка', err instanceof ApiError ? err.message : 'Не вдалося зберегти матчі'),
      },
    );
  }

  function runDrawGroups12() {
    setGroups12Draw(null);
    drawGroups12.mutate(undefined, {
      onSuccess: (result) => (result.ok ? setGroups12Draw(result) : Alert.alert('Не вдалося', result.error)),
      onError: (err) => Alert.alert('Помилка', err instanceof ApiError ? err.message : 'Не вдалося сформувати жеребкування'),
    });
  }

  function commitGroups12Draw(matchups: NamedSinglesMatchup[], groupAssignment: Record<string, number>, acknowledgedCompletedLoss = false) {
    commitGroups12.mutate(
      { groupAssignment, matchups, acknowledgedCompletedLoss },
      {
        onSuccess: (result) => handleCommit(result, (ack) => commitGroups12Draw(matchups, groupAssignment, ack), done),
        onError: (err) => Alert.alert('Помилка', err instanceof ApiError ? err.message : 'Не вдалося зберегти матчі'),
      },
    );
  }

  function runDrawDoubles() {
    setDoublesDraw(null);
    drawDoubles.mutate(undefined, {
      onSuccess: (result) => (result.ok ? setDoublesDraw(result) : Alert.alert('Не вдалося', result.error)),
      onError: (err) => Alert.alert('Помилка', err instanceof ApiError ? err.message : 'Не вдалося сформувати жеребкування'),
    });
  }

  function commitDoublesDraw(matchups: NamedMatchup[], acknowledgedCompletedLoss = false) {
    commitDoubles.mutate(
      { matchups, acknowledgedCompletedLoss },
      {
        onSuccess: (result) => handleCommit(result, (ack) => commitDoublesDraw(matchups, ack), done),
        onError: (err) => Alert.alert('Помилка', err instanceof ApiError ? err.message : 'Не вдалося зберегти матчі'),
      },
    );
  }

  function runDrawDoublesGroups() {
    setDoublesGroupsDraw(null);
    drawDoublesGroups.mutate(undefined, {
      onSuccess: (result) => (result.ok ? setDoublesGroupsDraw(result) : Alert.alert('Не вдалося', result.error)),
      onError: (err) => Alert.alert('Помилка', err instanceof ApiError ? err.message : 'Не вдалося сформувати жеребкування'),
    });
  }

  function commitDoublesGroupsDraw(matchups: NamedGroupedMatchup[], groupAssignment: Record<string, number>, acknowledgedCompletedLoss = false) {
    commitDoublesGroups.mutate(
      { groupAssignment, matchups, acknowledgedCompletedLoss },
      {
        onSuccess: (result) => handleCommit(result, (ack) => commitDoublesGroupsDraw(matchups, groupAssignment, ack), done),
        onError: (err) => Alert.alert('Помилка', err instanceof ApiError ? err.message : 'Не вдалося зберегти матчі'),
      },
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="small" themeColor="textSecondary">
          Кожна стратегія замінює всі наявні матчі турніру новими.
        </ThemedText>

        {tournament.format === 'SINGLES' && (
          <>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Round robin
            </ThemedText>
            <Pressable style={[styles.button, { backgroundColor: theme.backgroundElement }]} disabled={commitSingles.isPending} onPress={() => runSingles('ALL')}>
              <ThemedText type="small">Усі проти всіх</ThemedText>
            </Pressable>
            <Pressable style={[styles.button, { backgroundColor: theme.backgroundElement }]} disabled={commitSingles.isPending} onPress={() => runSingles('SEEDED_SPLIT')}>
              <ThemedText type="small">Сіяні окремо від несіяних</ThemedText>
            </Pressable>

            <ThemedText type="smallBold" style={styles.sectionTitle}>
              За групами
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Потрібно, щоб хоча б одному учаснику вже було призначено групу в ростері.
            </ThemedText>
            <Pressable style={[styles.button, { backgroundColor: theme.backgroundElement }]} disabled={drawSinglesGroups.isPending} onPress={runDrawSinglesGroups}>
              {drawSinglesGroups.isPending ? <ActivityIndicator /> : <ThemedText type="small">{singlesGroupsDraw ? 'Перегенерувати' : 'Жеребкувати за групами'}</ThemedText>}
            </Pressable>
            {singlesGroupsDraw && (
              <ThemedView style={[styles.preview, { backgroundColor: theme.backgroundElement }]}>
                {singlesGroupsDraw.matchups.map((m, i) => (
                  <ThemedText key={i} type="small" themeColor="textSecondary">
                    {m.round}: {m.sideA.name} — {m.sideB.name}
                  </ThemedText>
                ))}
                <Pressable style={styles.submit} disabled={commitSinglesGroups.isPending} onPress={() => commitSinglesGroupsDraw(singlesGroupsDraw.matchups, singlesGroupsDraw.groupAssignment)}>
                  {commitSinglesGroups.isPending ? <ActivityIndicator color="#fff" /> : <ThemedText themeColor="background">Підтвердити</ThemedText>}
                </Pressable>
              </ThemedView>
            )}

            <ThemedText type="smallBold" style={styles.sectionTitle}>
              12 учасників (групи + плейоф)
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Потрібно рівно 12 учасників і рівно 4 сіяних.
            </ThemedText>
            <Pressable style={[styles.button, { backgroundColor: theme.backgroundElement }]} disabled={drawGroups12.isPending} onPress={runDrawGroups12}>
              {drawGroups12.isPending ? <ActivityIndicator /> : <ThemedText type="small">{groups12Draw ? 'Перегенерувати' : 'Жеребкувати'}</ThemedText>}
            </Pressable>
            {groups12Draw && (
              <ThemedView style={[styles.preview, { backgroundColor: theme.backgroundElement }]}>
                {groups12Draw.matchups.map((m, i) => (
                  <ThemedText key={i} type="small" themeColor="textSecondary">
                    {m.round}: {m.sideA.name} — {m.sideB.name}
                  </ThemedText>
                ))}
                <Pressable style={styles.submit} disabled={commitGroups12.isPending} onPress={() => commitGroups12Draw(groups12Draw.matchups, groups12Draw.groupAssignment)}>
                  {commitGroups12.isPending ? <ActivityIndicator color="#fff" /> : <ThemedText themeColor="background">Підтвердити</ThemedText>}
                </Pressable>
              </ThemedView>
            )}
          </>
        )}

        {tournament.format === 'DOUBLES' && (
          <>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Прості пари
            </ThemedText>
            <Pressable style={[styles.button, { backgroundColor: theme.backgroundElement }]} disabled={drawDoubles.isPending} onPress={runDrawDoubles}>
              {drawDoubles.isPending ? <ActivityIndicator /> : <ThemedText type="small">{doublesDraw ? 'Перегенерувати' : 'Жеребкувати пари'}</ThemedText>}
            </Pressable>
            {doublesDraw && (
              <ThemedView style={[styles.preview, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">Пари ({doublesDraw.randomTeams.length + doublesDraw.fixedTeams.length})</ThemedText>
                {[...doublesDraw.fixedTeams, ...doublesDraw.randomTeams].map((team) => (
                  <ThemedText key={team.playerIds.join('-')} type="small">
                    {team.names.join(' / ')}
                  </ThemedText>
                ))}
                <ThemedText type="smallBold" style={styles.matchupsTitle}>
                  Матчі ({doublesDraw.matchups.length})
                </ThemedText>
                {doublesDraw.matchups.map((m, i) => (
                  <ThemedText key={i} type="small" themeColor="textSecondary">
                    {m.sideA.names.join('/')} — {m.sideB.names.join('/')}
                  </ThemedText>
                ))}
                <Pressable style={styles.submit} disabled={commitDoubles.isPending} onPress={() => commitDoublesDraw(doublesDraw.matchups)}>
                  {commitDoubles.isPending ? <ActivityIndicator color="#fff" /> : <ThemedText themeColor="background">Підтвердити</ThemedText>}
                </Pressable>
              </ThemedView>
            )}

            <ThemedText type="smallBold" style={styles.sectionTitle}>
              За групами
            </ThemedText>
            <Pressable style={[styles.button, { backgroundColor: theme.backgroundElement }]} disabled={drawDoublesGroups.isPending} onPress={runDrawDoublesGroups}>
              {drawDoublesGroups.isPending ? <ActivityIndicator /> : <ThemedText type="small">{doublesGroupsDraw ? 'Перегенерувати' : 'Жеребкувати за групами'}</ThemedText>}
            </Pressable>
            {doublesGroupsDraw && (
              <ThemedView style={[styles.preview, { backgroundColor: theme.backgroundElement }]}>
                {doublesGroupsDraw.matchups.map((m, i) => (
                  <ThemedText key={i} type="small" themeColor="textSecondary">
                    Група {m.group}: {m.sideA.names.join('/')} — {m.sideB.names.join('/')}
                  </ThemedText>
                ))}
                <Pressable
                  style={styles.submit}
                  disabled={commitDoublesGroups.isPending}
                  onPress={() => commitDoublesGroupsDraw(doublesGroupsDraw.matchups, doublesGroupsDraw.groupAssignment)}>
                  {commitDoublesGroups.isPending ? <ActivityIndicator color="#fff" /> : <ThemedText themeColor="background">Підтвердити</ThemedText>}
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
  sectionTitle: { marginTop: Spacing.four },
  button: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, borderRadius: Spacing.two, alignItems: 'center' },
  preview: { marginTop: Spacing.two, padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
  matchupsTitle: { marginTop: Spacing.two },
  submit: {
    marginTop: Spacing.three,
    backgroundColor: '#3c87f7',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
