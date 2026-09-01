import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useDeleteNewsPost, useNewsPost } from '@/features/news/api';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { hasAnyAdminAccess } from '@/lib/permissions';

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError } = useNewsPost(id);
  const { session } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const deletePost = useDeleteNewsPost(id);
  const canManage = hasAnyAdminAccess(session?.user);

  if (isLoading) return <ActivityIndicator style={styles.center} />;
  if (isError || !data) return <ThemedText style={styles.center}>Новину не знайдено</ThemedText>;

  const post = data.post;

  function confirmDelete() {
    Alert.alert('Видалити новину', `«${post.title}» буде видалено безповоротно.`, [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: () =>
          deletePost.mutate(undefined, {
            onSuccess: () => router.replace('/(tabs)/news'),
            onError: (error) =>
              Alert.alert('Помилка', error instanceof ApiError ? error.message : 'Не вдалося видалити новину'),
          }),
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{post.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {post.createdAt.slice(0, 10)} · {post.author.player?.name ?? post.author.name ?? 'SET.club'}
        </ThemedText>
        <ThemedText style={styles.body}>{post.body}</ThemedText>

        {canManage && (
          <ThemedView style={styles.actionsRow}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundElement }]}
              onPress={() => router.push(`/(tabs)/news/${id}/edit`)}>
              <ThemedText type="small">Редагувати</ThemedText>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.destructive]} onPress={confirmDelete}>
              <ThemedText type="small" themeColor="background">
                Видалити
              </ThemedText>
            </Pressable>
          </ThemedView>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.six },
  center: { marginTop: Spacing.five },
  body: { marginTop: Spacing.two, lineHeight: 24 },
  actionsRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.four },
  actionButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  destructive: { backgroundColor: '#d33' },
});
