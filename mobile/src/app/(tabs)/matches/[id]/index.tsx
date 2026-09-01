import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useDeleteMatch, useMatch } from '@/features/matches/api';
import { scoreSummary, sideNames } from '@/features/matches/format';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { isDomainAdmin } from '@/lib/permissions';

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError } = useMatch(id);
  const { session } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const canManage = isDomainAdmin(session?.user, 'TENNIS');
  // Hooks can't follow the early returns below (Rules of Hooks) - default to
  // "" until the match loads; the mutation is never invoked before then anyway.
  const deleteMatch = useDeleteMatch(id, data?.match.tournamentId ?? '');

  if (isLoading) return <ActivityIndicator style={styles.center} />;
  if (isError || !data) return <ThemedText style={styles.center}>Матч не знайдено</ThemedText>;

  const match = data.match;

  function confirmDelete() {
    Alert.alert('Видалити матч', 'Матч буде видалено безповоротно.', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: () =>
          deleteMatch.mutate(false, {
            onSuccess: (result) => {
              if ('error' in result) {
                if (result.cascadeResets?.length) {
                  Alert.alert('Це скине рахунок нижче по сітці', result.error, [
                    { text: 'Скасувати', style: 'cancel' },
                    { text: 'Підтвердити', style: 'destructive', onPress: () => deleteMatch.mutate(true) },
                  ]);
                } else {
                  Alert.alert('Помилка', result.error);
                }
                return;
              }
              router.back();
            },
            onError: (error) => Alert.alert('Помилка', error instanceof ApiError ? error.message : 'Не вдалося видалити матч'),
          }),
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          {sideNames(match, 'A')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.title}>
          проти
        </ThemedText>
        <ThemedText type="title" style={styles.title}>
          {sideNames(match, 'B')}
        </ThemedText>

        <ThemedText type="subtitle" style={styles.score}>
          {scoreSummary(match)}
        </ThemedText>
        {match.retired && <ThemedText themeColor="textSecondary">Завершено зняттям гравця</ThemedText>}

        <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
          {match.tournament.name}
          {match.round ? ` · ${match.round}` : ''}
          {match.scheduledDate ? ` · ${match.scheduledDate.slice(0, 10)}` : ''}
        </ThemedText>

        {canManage && (
          <ThemedView style={styles.actionsRow}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundElement }]}
              onPress={() => router.push(`/(tabs)/matches/${id}/score`)}>
              <ThemedText type="small">Рахунок</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundElement }]}
              onPress={() => router.push(`/(tabs)/matches/${id}/edit`)}>
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
  center: { flex: 1 },
  content: { padding: Spacing.four, alignItems: 'center', gap: Spacing.one, paddingBottom: Spacing.six },
  title: { textAlign: 'center' },
  score: { marginTop: Spacing.three },
  meta: { marginTop: Spacing.two },
  actionsRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.four },
  actionButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  destructive: { backgroundColor: '#d33' },
});
