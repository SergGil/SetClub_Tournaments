import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCreateMatch } from '@/features/matches/api';
import { MatchForm } from '@/features/matches/match-form';
import { ApiError } from '@/lib/api';

export default function NewMatchScreen() {
  const { tournamentId } = useLocalSearchParams<{ tournamentId?: string }>();
  const router = useRouter();
  const { mutate, isPending } = useCreateMatch();
  const [error, setError] = useState<string | null>(null);

  if (!tournamentId) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.error}>Матч можна створити лише з екрана турніру.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <MatchForm
        tournamentId={tournamentId}
        submitLabel="Створити матч"
        submitting={isPending}
        error={error}
        onSubmit={(values) => {
          setError(null);
          mutate(values, {
            onSuccess: () => router.replace({ pathname: '/(tabs)/matches', params: { tournamentId } }),
            onError: (err) => setError(err instanceof ApiError ? err.message : 'Не вдалося створити матч'),
          });
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  error: { color: '#d33', padding: Spacing.four },
});
