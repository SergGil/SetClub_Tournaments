import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useMatch, useUpdateMatch } from '@/features/matches/api';
import { MatchForm } from '@/features/matches/match-form';
import { ApiError } from '@/lib/api';

export default function EditMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useMatch(id);
  const { mutate, isPending } = useUpdateMatch(id);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !data) return <ActivityIndicator style={styles.center} />;

  const match = data.match;
  const initialValues = {
    tournamentId: match.tournamentId,
    matchType: match.matchType,
    round: match.round ?? '',
    scheduledDate: match.scheduledDate ?? '',
    sideAPlayerIds: match.players.filter((p) => p.side === 'A').map((p) => p.playerId),
    sideBPlayerIds: match.players.filter((p) => p.side === 'B').map((p) => p.playerId),
  };

  return (
    <ThemedView style={styles.container}>
      <MatchForm
        tournamentId={match.tournamentId}
        initialValues={initialValues}
        submitLabel="Зберегти"
        submitting={isPending}
        error={error}
        onSubmit={(values) => {
          setError(null);
          mutate(values, {
            onSuccess: () => router.back(),
            onError: (err) => setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти зміни'),
          });
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, center: { flex: 1 } });
