import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCreateTeam, useTeams, useUpdateTeam } from '@/features/teams/api';
import { useTournament } from '@/features/tournaments/api';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';

/** Create (no `teamId` param) or edit (`teamId` present) a team - roster picker (2-4 players) scoped to the tournament's participants. */
export default function TeamFormScreen() {
  const { id, teamId } = useLocalSearchParams<{ id: string; teamId?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { data: tournamentData } = useTournament(id);
  const { data: teamsData } = useTeams(id);
  const existing = teamId ? teamsData?.teams.find((t) => t.id === teamId) : undefined;

  const create = useCreateTeam(id);
  const update = useUpdateTeam(id, teamId ?? '');
  const submitting = create.isPending || update.isPending;

  const [name, setName] = useState(existing?.name ?? '');
  const [selected, setSelected] = useState<string[]>(existing?.members.map((m) => m.id) ?? []);
  const [error, setError] = useState<string | null>(null);

  const roster = (tournamentData?.tournament.participants ?? [])
    .filter((p) => !p.withdrawnAt)
    .map((p) => ({ playerId: p.playerId, name: p.player.name }));

  function toggle(playerId: string) {
    setSelected((prev) => (prev.includes(playerId) ? prev.filter((pid) => pid !== playerId) : [...prev, playerId]));
  }

  function onDone(result: { success: true } | { error: string }) {
    if ('error' in result) {
      setError(result.error);
      return;
    }
    router.back();
  }

  function onError(err: unknown) {
    setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти команду');
  }

  function submit() {
    setError(null);
    const values = { name, memberPlayerIds: selected };
    if (teamId) update.mutate(values, { onSuccess: onDone, onError });
    else create.mutate(values, { onSuccess: onDone, onError });
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.form}>
        <ThemedText type="smallBold">Назва команди</ThemedText>
        <TextInput
          value={name}
          onChangeText={setName}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />

        <ThemedText type="smallBold">
          Склад ({selected.length}, 2-4 гравці)
        </ThemedText>
        <ThemedView style={styles.chipRow}>
          {roster.map((player) => {
            const isSelected = selected.includes(player.playerId);
            return (
              <Pressable
                key={player.playerId}
                onPress={() => toggle(player.playerId)}
                style={[styles.chip, { backgroundColor: isSelected ? theme.backgroundSelected : theme.backgroundElement }]}>
                <ThemedText type="small">{player.name}</ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <Pressable style={styles.submit} disabled={submitting} onPress={submit}>
          {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText themeColor="background">{teamId ? 'Зберегти' : 'Створити команду'}</ThemedText>}
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
