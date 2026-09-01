import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useTournament, useUpdateTournament } from '@/features/tournaments/api';
import { TournamentForm } from '@/features/tournaments/tournament-form';
import { ApiError } from '@/lib/api';

export default function EditTournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useTournament(id);
  const { mutate, isPending } = useUpdateTournament(id);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>();

  if (isLoading || !data) return <ActivityIndicator style={styles.center} />;

  return (
    <ThemedView style={styles.container}>
      <TournamentForm
        initialValues={{ ...data.tournament, description: data.tournament.description ?? '' }}
        submitLabel="Зберегти"
        submitting={isPending}
        error={error}
        fieldErrors={fieldErrors}
        onSubmit={(values) => {
          setError(null);
          setFieldErrors(undefined);
          mutate(values, {
            onSuccess: () => router.back(),
            onError: (err) => {
              if (err instanceof ApiError) {
                setError(err.message);
                setFieldErrors(err.fieldErrors);
              } else {
                setError('Не вдалося зберегти зміни');
              }
            },
          });
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1 },
});
