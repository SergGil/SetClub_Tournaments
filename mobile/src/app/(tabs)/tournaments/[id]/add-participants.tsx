import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAddParticipants, useTournament } from '@/features/tournaments/api';
import { usePlayers } from '@/features/players/api';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';

export default function AddParticipantsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { data: tournamentData } = useTournament(id);
  const { data: playersData, isLoading } = usePlayers();
  const { mutate, isPending } = useAddParticipants(id);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const existingIds = useMemo(
    () => new Set(tournamentData?.tournament.participants.map((p) => p.playerId) ?? []),
    [tournamentData],
  );

  const candidates = useMemo(() => {
    const all = (playersData?.players ?? []).filter((p) => !existingIds.has(p.id));
    if (!query.trim()) return all;
    const q = query.trim().toLowerCase();
    return all.filter((p) => p.name.toLowerCase().includes(q) || p.nickname?.toLowerCase().includes(q));
  }, [playersData, existingIds, query]);

  function toggle(playerId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  function submit() {
    if (selected.size === 0) return;
    setError(null);
    mutate([...selected], {
      onSuccess: () => router.back(),
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Не вдалося додати учасників'),
    });
  }

  return (
    <ThemedView style={styles.container}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Пошук гравця"
        placeholderTextColor={theme.textSecondary}
        style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement }]}
      />
      {isLoading ? (
        <ActivityIndicator style={styles.center} />
      ) : (
        <FlatList
          data={candidates}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isSelected = selected.has(item.id);
            return (
              <Pressable
                onPress={() => toggle(item.id)}
                style={[
                  styles.row,
                  { backgroundColor: isSelected ? theme.backgroundSelected : theme.backgroundElement },
                ]}>
                <ThemedText type="small">
                  {isSelected ? '☑ ' : '☐ '}
                  {item.name}
                  {item.nickname ? ` (${item.nickname})` : ''}
                </ThemedText>
              </Pressable>
            );
          }}
          ListEmptyComponent={<ThemedText style={styles.center}>Немає доступних гравців</ThemedText>}
        />
      )}
      {error && <ThemedText style={styles.error}>{error}</ThemedText>}
      <Pressable style={styles.submit} disabled={isPending || selected.size === 0} onPress={submit}>
        {isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText themeColor="background">Додати ({selected.size})</ThemedText>
        )}
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  search: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  list: { gap: Spacing.one, paddingBottom: Spacing.four },
  row: { padding: Spacing.three, borderRadius: Spacing.two },
  center: { marginTop: Spacing.four, textAlign: 'center' },
  error: { color: '#d33' },
  submit: { backgroundColor: '#3c87f7', paddingVertical: Spacing.three, borderRadius: Spacing.two, alignItems: 'center' },
});
