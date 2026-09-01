import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useDeletePlayer, usePlayers } from '@/features/players/api';
import type { Player } from '@/features/players/types';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';

function PlayerRow({ item, onDelete }: { item: Player; onDelete: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <ThemedView style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <Pressable style={styles.info} onPress={() => router.push(`/(tabs)/profile/players/${item.id}/edit`)}>
        <ThemedText type="smallBold">
          {item.name}
          {item.nickname ? ` (${item.nickname})` : ''}
        </ThemedText>
        {item.email && (
          <ThemedText type="small" themeColor="textSecondary">
            {item.email}
          </ThemedText>
        )}
      </Pressable>
      <Pressable onPress={onDelete}>
        <ThemedText type="small">Видалити</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

export default function PlayersListScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = usePlayers();
  const deletePlayer = useDeletePlayer();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const theme = useTheme();

  const filtered = useMemo(() => {
    const all = data?.players ?? [];
    if (!query.trim()) return all;
    const q = query.trim().toLowerCase();
    return all.filter((p) => p.name.toLowerCase().includes(q) || p.nickname?.toLowerCase().includes(q));
  }, [data, query]);

  function confirmDelete(player: Player) {
    Alert.alert('Видалити гравця', `«${player.name}» буде видалено безповоротно.`, [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: () =>
          deletePlayer.mutate(player.id, {
            onSuccess: (result) => {
              if ('error' in result) Alert.alert('Помилка', result.error);
            },
            onError: (error) =>
              Alert.alert('Помилка', error instanceof ApiError ? error.message : 'Не вдалося видалити гравця'),
          }),
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ThemedView style={styles.header}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Пошук гравця"
            placeholderTextColor={theme.textSecondary}
            style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          <Pressable style={styles.addButton} onPress={() => router.push('/(tabs)/profile/players/new')}>
            <ThemedText themeColor="background" type="smallBold">
              +
            </ThemedText>
          </Pressable>
        </ThemedView>

        {isLoading ? (
          <ActivityIndicator style={styles.center} />
        ) : isError ? (
          <ThemedText style={styles.center}>Не вдалося завантажити гравців</ThemedText>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <PlayerRow item={item} onDelete={() => confirmDelete(item)} />}
            contentContainerStyle={styles.list}
            refreshing={isRefetching}
            onRefresh={refetch}
            ListEmptyComponent={<ThemedText style={styles.center}>Гравців не знайдено</ThemedText>}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, alignItems: 'center' },
  search: { flex: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3c87f7', alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two },
  info: { flex: 1, gap: Spacing.half },
  center: { marginTop: Spacing.five, textAlign: 'center' },
});
