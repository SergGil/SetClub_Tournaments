import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useMatch, useSaveScore } from '@/features/matches/api';
import { sideNames } from '@/features/matches/format';
import type { Match, Side } from '@/features/matches/types';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';

type SetDraft = { sideAGames: string; sideBGames: string };

export default function ScoreEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useMatch(id);

  if (isLoading || !data) return <ActivityIndicator style={styles.center} />;
  return <ScoreEntryForm matchId={id} match={data.match} />;
}

/** Separate component so initial state can come straight from useState() initializers (the match is already loaded by the time this mounts) instead of a setState-in-effect sync. */
function ScoreEntryForm({ matchId, match }: { matchId: string; match: Match }) {
  const router = useRouter();
  const theme = useTheme();
  const saveScore = useSaveScore(matchId, match.tournamentId);

  const [sets, setSets] = useState<SetDraft[]>(
    match.sets.length > 0
      ? match.sets.map((s) => ({ sideAGames: String(s.sideAGames), sideBGames: String(s.sideBGames) }))
      : [{ sideAGames: '', sideBGames: '' }],
  );
  const [retired, setRetired] = useState(match.retired);
  const [retiredWinnerSide, setRetiredWinnerSide] = useState<Side>(match.winnerSide ?? 'A');
  const [error, setError] = useState<string | null>(null);

  function submit(acknowledgedCascadeReset = false) {
    setError(null);
    const parsedSets = sets
      .filter((s) => s.sideAGames !== '' || s.sideBGames !== '')
      .map((s) => ({ sideAGames: Number(s.sideAGames) || 0, sideBGames: Number(s.sideBGames) || 0 }));

    saveScore.mutate(
      {
        matchId,
        expectedUpdatedAt: match.updatedAt,
        retired,
        retiredWinnerSide: retired ? retiredWinnerSide : null,
        sets: parsedSets,
        acknowledgedCascadeReset,
      },
      {
        onSuccess: (result) => {
          if ('error' in result) {
            if (result.cascadeResets?.length) {
              Alert.alert('Це скине рахунок нижче по сітці', result.error, [
                { text: 'Скасувати', style: 'cancel' },
                { text: 'Підтвердити', style: 'destructive', onPress: () => submit(true) },
              ]);
            } else {
              setError(result.error);
            }
            return;
          }
          router.back();
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти рахунок'),
      },
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.form}>
        <ThemedText type="smallBold">
          {sideNames(match, 'A')} — {sideNames(match, 'B')}
        </ThemedText>

        {sets.map((set, index) => (
          <ThemedView key={index} style={styles.setRow}>
            <ThemedText type="small" style={styles.setLabel}>
              Сет {index + 1}
            </ThemedText>
            <TextInput
              value={set.sideAGames}
              onChangeText={(text) => setSets((prev) => prev.map((s, i) => (i === index ? { ...s, sideAGames: text } : s)))}
              keyboardType="number-pad"
              style={[styles.setInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
            <ThemedText type="small">:</ThemedText>
            <TextInput
              value={set.sideBGames}
              onChangeText={(text) => setSets((prev) => prev.map((s, i) => (i === index ? { ...s, sideBGames: text } : s)))}
              keyboardType="number-pad"
              style={[styles.setInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
            {sets.length > 1 && (
              <Pressable onPress={() => setSets((prev) => prev.filter((_, i) => i !== index))}>
                <ThemedText type="small">✕</ThemedText>
              </Pressable>
            )}
          </ThemedView>
        ))}

        {sets.length < 5 && (
          <Pressable onPress={() => setSets((prev) => [...prev, { sideAGames: '', sideBGames: '' }])}>
            <ThemedText type="small" themeColor="textSecondary">
              + Додати сет
            </ThemedText>
          </Pressable>
        )}

        <Pressable style={styles.retiredRow} onPress={() => setRetired((r) => !r)}>
          <ThemedText type="small">{retired ? '☑' : '☐'} Завершено зняттям гравця</ThemedText>
        </Pressable>
        {retired && (
          <SegmentedControl
            options={['A', 'B']}
            labels={{ A: sideNames(match, 'A'), B: sideNames(match, 'B') }}
            value={retiredWinnerSide}
            onChange={setRetiredWinnerSide}
          />
        )}

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <Pressable style={styles.submit} disabled={saveScore.isPending} onPress={() => submit(false)}>
          {saveScore.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText themeColor="background">Зберегти рахунок</ThemedText>
          )}
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1 },
  form: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.six },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  setLabel: { width: 60 },
  setInput: { width: 56, textAlign: 'center', borderRadius: Spacing.two, paddingVertical: Spacing.two },
  retiredRow: { marginTop: Spacing.three },
  error: { color: '#d33' },
  submit: {
    marginTop: Spacing.three,
    backgroundColor: '#3c87f7',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
