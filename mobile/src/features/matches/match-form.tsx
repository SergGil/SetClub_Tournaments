import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTournament } from '@/features/tournaments/api';
import { useTheme } from '@/hooks/use-theme';

import type { MatchFormInput, MatchType } from './types';

const MATCH_TYPE_LABEL: Record<MatchType, string> = { SINGLES: 'Одиночний', DOUBLES: 'Парний' };

type Props = {
  tournamentId: string;
  initialValues?: Partial<MatchFormInput>;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  onSubmit: (values: MatchFormInput) => void;
};

function PlayerSidePicker({
  label,
  roster,
  maxCount,
  selected,
  onToggle,
}: {
  label: string;
  roster: { playerId: string; name: string }[];
  maxCount: number;
  selected: string[];
  onToggle: (playerId: string) => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.side}>
      <ThemedText type="smallBold">
        {label} ({selected.length}/{maxCount})
      </ThemedText>
      <ThemedView style={styles.chipRow}>
        {roster.map((player) => {
          const isSelected = selected.includes(player.playerId);
          const disabled = !isSelected && selected.length >= maxCount;
          return (
            <Pressable
              key={player.playerId}
              disabled={disabled}
              onPress={() => onToggle(player.playerId)}
              style={[
                styles.chip,
                { backgroundColor: isSelected ? theme.backgroundSelected : theme.backgroundElement, opacity: disabled ? 0.4 : 1 },
              ]}>
              <ThemedText type="small">{player.name}</ThemedText>
            </Pressable>
          );
        })}
      </ThemedView>
    </ThemedView>
  );
}

/** Mirrors matchFormSchema (src/lib/validation/match.ts) - shared by matches/new.tsx and [id]/edit.tsx. */
export function MatchForm({ tournamentId, initialValues, submitLabel, submitting, error, onSubmit }: Props) {
  const { data } = useTournament(tournamentId);
  const [matchType, setMatchType] = useState<MatchType>(initialValues?.matchType ?? 'SINGLES');
  const [round, setRound] = useState(initialValues?.round ?? '');
  const [scheduledDate, setScheduledDate] = useState(initialValues?.scheduledDate?.slice(0, 10) ?? '');
  const [sideA, setSideA] = useState<string[]>(initialValues?.sideAPlayerIds ?? []);
  const [sideB, setSideB] = useState<string[]>(initialValues?.sideBPlayerIds ?? []);
  const theme = useTheme();

  const maxPerSide = matchType === 'SINGLES' ? 1 : 2;
  const roster = (data?.tournament.participants ?? [])
    .filter((p) => !p.withdrawnAt)
    .map((p) => ({ playerId: p.playerId, name: p.player.name }));

  function toggleSide(setter: typeof setSideA, current: string[], playerId: string) {
    setter(current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]);
  }

  return (
    <ScrollView contentContainerStyle={styles.form}>
      <ThemedText type="smallBold">Тип матчу</ThemedText>
      <SegmentedControl options={['SINGLES', 'DOUBLES']} labels={MATCH_TYPE_LABEL} value={matchType} onChange={setMatchType} />

      <PlayerSidePicker
        label="Сторона А"
        roster={roster}
        maxCount={maxPerSide}
        selected={sideA}
        onToggle={(id) => toggleSide(setSideA, sideA, id)}
      />
      <PlayerSidePicker
        label="Сторона Б"
        roster={roster}
        maxCount={maxPerSide}
        selected={sideB}
        onToggle={(id) => toggleSide(setSideB, sideB, id)}
      />

      <ThemedText type="smallBold">Раунд (необов&apos;язково)</ThemedText>
      <TextInput
        value={round}
        onChangeText={setRound}
        placeholder="Наприклад, Фінал"
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        placeholderTextColor={theme.textSecondary}
      />

      <ThemedText type="smallBold">Дата (РРРР-ММ-ДД, необов&apos;язково)</ThemedText>
      <TextInput
        value={scheduledDate}
        onChangeText={setScheduledDate}
        placeholder="2026-06-05"
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        placeholderTextColor={theme.textSecondary}
      />

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <Pressable
        style={styles.submit}
        disabled={submitting}
        onPress={() =>
          onSubmit({ tournamentId, matchType, round, scheduledDate, sideAPlayerIds: sideA, sideBPlayerIds: sideB })
        }>
        {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText themeColor="background">{submitLabel}</ThemedText>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.six },
  input: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  side: { gap: Spacing.one, marginTop: Spacing.two },
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
