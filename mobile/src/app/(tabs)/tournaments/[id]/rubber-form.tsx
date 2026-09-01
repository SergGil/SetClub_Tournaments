import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { DateField } from '@/components/date-field';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCreateRubber, useTies } from '@/features/teams/api';
import type { MatchType } from '@/features/matches/types';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';

const MATCH_TYPE_LABEL: Record<MatchType, string> = { SINGLES: 'Одиночний', DOUBLES: 'Парний' };

/** Rubber = one match within a tie, players restricted to that tie's own two team rosters (unlike a plain match, whose player pool is the whole tournament). */
export default function RubberFormScreen() {
  const { id, tieId } = useLocalSearchParams<{ id: string; tieId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { data } = useTies(id);
  const tie = data?.ties.find((t) => t.id === tieId);
  const create = useCreateRubber(id, tieId);

  const [matchType, setMatchType] = useState<MatchType>('SINGLES');
  const [scheduledDate, setScheduledDate] = useState('');
  const [sideA, setSideA] = useState<string[]>([]);
  const [sideB, setSideB] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>();

  const maxPerSide = matchType === 'SINGLES' ? 1 : 2;

  function toggle(setter: typeof setSideA, current: string[], playerId: string) {
    setter(current.includes(playerId) ? current.filter((pid) => pid !== playerId) : [...current, playerId]);
  }

  function submit() {
    setError(null);
    setFieldErrors(undefined);
    create.mutate(
      { matchType, scheduledDate, sideAPlayerIds: sideA, sideBPlayerIds: sideB },
      {
        onSuccess: (result) => {
          if ('error' in result) {
            setError(result.error);
            setFieldErrors(result.fieldErrors);
            return;
          }
          router.back();
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Не вдалося створити раббер'),
      },
    );
  }

  if (!tie) return <ActivityIndicator style={styles.center} />;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.form}>
        <ThemedText type="smallBold">Тип матчу</ThemedText>
        <SegmentedControl options={['SINGLES', 'DOUBLES']} labels={MATCH_TYPE_LABEL} value={matchType} onChange={setMatchType} />

        <ThemedText type="smallBold">
          {tie.teamA.name} ({sideA.length}/{maxPerSide})
        </ThemedText>
        <ThemedView style={styles.chipRow}>
          {tie.teamA.members.map((player) => {
            const isSelected = sideA.includes(player.id);
            const disabled = !isSelected && sideA.length >= maxPerSide;
            return (
              <Pressable
                key={player.id}
                disabled={disabled}
                onPress={() => toggle(setSideA, sideA, player.id)}
                style={[styles.chip, { backgroundColor: isSelected ? theme.backgroundSelected : theme.backgroundElement, opacity: disabled ? 0.4 : 1 }]}>
                <ThemedText type="small">{player.name}</ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>

        <ThemedText type="smallBold">
          {tie.teamB.name} ({sideB.length}/{maxPerSide})
        </ThemedText>
        <ThemedView style={styles.chipRow}>
          {tie.teamB.members.map((player) => {
            const isSelected = sideB.includes(player.id);
            const disabled = !isSelected && sideB.length >= maxPerSide;
            return (
              <Pressable
                key={player.id}
                disabled={disabled}
                onPress={() => toggle(setSideB, sideB, player.id)}
                style={[styles.chip, { backgroundColor: isSelected ? theme.backgroundSelected : theme.backgroundElement, opacity: disabled ? 0.4 : 1 }]}>
                <ThemedText type="small">{player.name}</ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>

        <ThemedText type="smallBold">Дата (необов&apos;язково)</ThemedText>
        <DateField value={scheduledDate} onChange={setScheduledDate} placeholder="Обрати дату" optional />

        {(error || fieldErrors) && (
          <ThemedText style={styles.error}>{error ?? Object.values(fieldErrors ?? {})[0]}</ThemedText>
        )}

        <Pressable style={styles.submit} disabled={create.isPending} onPress={submit}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <ThemedText themeColor="background">Створити раббер</ThemedText>}
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, marginTop: Spacing.five },
  form: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.six },
  input: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  error: { color: '#d33' },
  submit: {
    marginTop: Spacing.three,
    backgroundColor: '#3c87f7',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
