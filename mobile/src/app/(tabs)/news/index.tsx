import { Link, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useNewsPosts } from '@/features/news/api';
import type { NewsPost } from '@/features/news/types';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { hasAnyAdminAccess } from '@/lib/permissions';

function NewsRow({ item }: { item: NewsPost }) {
  const theme = useTheme();
  return (
    <Link href={`/(tabs)/news/${item.id}`} asChild>
      <Pressable style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">{item.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {item.body}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {item.createdAt.slice(0, 10)} · {item.author.player?.name ?? item.author.name ?? 'SET.club'}
        </ThemedText>
      </Pressable>
    </Link>
  );
}

export default function NewsListScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useNewsPosts();
  const { session } = useAuth();
  const router = useRouter();
  const canCreate = hasAnyAdminAccess(session?.user);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {canCreate && (
          <ThemedView style={styles.header}>
            <Pressable style={styles.addButton} onPress={() => router.push('/(tabs)/news/new')}>
              <ThemedText themeColor="background" type="smallBold">
                + Новина
              </ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {isLoading ? (
          <ActivityIndicator style={styles.center} />
        ) : isError ? (
          <ThemedText style={styles.center}>Не вдалося завантажити новини</ThemedText>
        ) : (
          <FlatList
            data={data?.posts ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <NewsRow item={item} />}
            contentContainerStyle={styles.list}
            refreshing={isRefetching}
            onRefresh={refetch}
            ListEmptyComponent={<ThemedText style={styles.center}>Новин ще немає</ThemedText>}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { padding: Spacing.three, alignItems: 'flex-end' },
  addButton: { backgroundColor: '#3c87f7', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  list: { paddingHorizontal: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  row: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
  center: { marginTop: Spacing.five, textAlign: 'center' },
});
