import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useMatch, useUpdateMatch } from '@/features/matches/api';
import { MatchForm } from '@/features/matches/match-form';
import type { MatchFormInput } from '@/features/matches/types';
import { ApiError } from '@/lib/api';

export default function EditMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useMatch(id);
  const { mutate, isPending } = useUpdateMatch(id);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !data) return <ActivityIndicator style={styles.center} />;

  const match = data.match;

  // A lineup change in a bracket tournament can come back asking to confirm
  // resetting already-played matches further down - same Alert as the score
  // screen, then the same request again with acknowledgedCascadeReset.
  function submit(values: MatchFormInput, acknowledgedCascadeReset = false) {
    setError(null);
    mutate(
      { ...values, acknowledgedCascadeReset },
      {
        onSuccess: (result) => {
          if ('error' in result) {
            Alert.alert('Це скине рахунок нижче по сітці', result.error, [
              { text: 'Скасувати', style: 'cancel' },
              { text: 'Підтвердити', style: 'destructive', onPress: () => submit(values, true) },
            ]);
            return;
          }
          router.back();
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти зміни'),
      },
    );
  }

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
        onSubmit={(values) => submit(values)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, center: { flex: 1 } });
