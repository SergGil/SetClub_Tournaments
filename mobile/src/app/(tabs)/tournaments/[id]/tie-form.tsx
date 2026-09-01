import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCreateTie, useTeams } from '@/features/teams/api';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';

export default function TieFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { data } = useTeams(id);
  const create = useCreateTie(id);

  const [teamAId, setTeamAId] = useState<string | null>(null);
  const [teamBId, setTeamBId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const teams = data?.teams ?? [];

  function submit() {
    if (!teamAId || !teamBId) {
      setError('Оберіть обидві команди');
      return;
    }
    setError(null);
    create.mutate(
      { teamAId, teamBId, label },
      {
        onSuccess: (result) => {
          if ('error' in result) {
            setError(result.error);
            return;
          }
          router.back();
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Не вдалося створити зустріч'),
      },
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.form}>
        <ThemedText type="smallBold">Команда А</ThemedText>
        <ThemedView style={styles.chipRow}>
          {teams.map((team) => (
            <Pressable
              key={team.id}
              onPress={() => setTeamAId(team.id)}
              style={[styles.chip, { backgroundColor: teamAId === team.id ? theme.backgroundSelected : theme.backgroundElement }]}>
              <ThemedText type="small">{team.name}</ThemedText>
            </Pressable>
          ))}
        </ThemedView>

        <ThemedText type="smallBold">Команда Б</ThemedText>
        <ThemedView style={styles.chipRow}>
          {teams
            .filter((team) => team.id !== teamAId)
            .map((team) => (
              <Pressable
                key={team.id}
                onPress={() => setTeamBId(team.id)}
                style={[styles.chip, { backgroundColor: teamBId === team.id ? theme.backgroundSelected : theme.backgroundElement }]}>
                <ThemedText type="small">{team.name}</ThemedText>
              </Pressable>
            ))}
        </ThemedView>

        <ThemedText type="smallBold">Мітка (необов&apos;язково)</ThemedText>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="Наприклад, Фінал"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <Pressable style={styles.submit} disabled={create.isPending} onPress={submit}>
          {create.isPending ? <ActivityIndicator color="#fff" /> : <ThemedText themeColor="background">Створити зустріч</ThemedText>}
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
