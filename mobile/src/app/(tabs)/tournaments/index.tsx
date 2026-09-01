import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTournaments } from '@/features/tournaments/api';
import {
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_STATUS_LABEL,
  type TournamentListItem,
} from '@/features/tournaments/types';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { isDomainAdmin } from '@/lib/permissions';

function TournamentRow({ item }: { item: TournamentListItem }) {
  const theme = useTheme();
  return (
    <Link href={`/(tabs)/tournaments/${item.id}`} asChild>
      <Pressable style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">{item.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {TOURNAMENT_FORMAT_LABEL[item.format]} · {TOURNAMENT_STATUS_LABEL[item.status]} ·{' '}
          {item._count.participants} учасників · {item._count.matches} матчів
        </ThemedText>
      </Pressable>
    </Link>
  );
}

export default function TournamentsListScreen() {
  const [query, setQuery] = useState('');
  const { data, isLoading, isError, refetch, isRefetching } = useTournaments(query || undefined);
  const { session } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const canCreate = isDomainAdmin(session?.user, 'TENNIS');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.header}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Пошук турніру"
            placeholderTextColor={theme.textSecondary}
            style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          {canCreate && (
            <Pressable style={styles.addButton} onPress={() => router.push('/(tabs)/tournaments/new')}>
              <ThemedText themeColor="background" type="smallBold">
                +
              </ThemedText>
            </Pressable>
          )}
        </ThemedView>

        {isLoading ? (
          <ActivityIndicator style={styles.center} />
        ) : isError ? (
          <ThemedText style={styles.center}>Не вдалося завантажити турніри</ThemedText>
        ) : (
          <FlatList
            data={data?.tournaments ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <TournamentRow item={item} />}
            contentContainerStyle={styles.list}
            refreshing={isRefetching}
            onRefresh={refetch}
            ListEmptyComponent={<ThemedText style={styles.center}>Турнірів не знайдено</ThemedText>}
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3c87f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  row: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
  center: { marginTop: Spacing.five, textAlign: 'center' },
});
