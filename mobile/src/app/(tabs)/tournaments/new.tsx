import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useCreateTournament } from '@/features/tournaments/api';
import { TournamentForm } from '@/features/tournaments/tournament-form';
import { ApiError } from '@/lib/api';

export default function NewTournamentScreen() {
  const router = useRouter();
  const { mutate, isPending } = useCreateTournament();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>();

  return (
    <ThemedView style={styles.container}>
      <TournamentForm
        submitLabel="Створити турнір"
        submitting={isPending}
        error={error}
        fieldErrors={fieldErrors}
        onSubmit={(values) => {
          setError(null);
          setFieldErrors(undefined);
          mutate(values, {
            onSuccess: (result) => {
              router.replace(`/(tabs)/tournaments/${result.tournament.id}`);
            },
            onError: (err) => {
              if (err instanceof ApiError) {
                setError(err.message);
                setFieldErrors(err.fieldErrors);
              } else {
                setError('Не вдалося створити турнір');
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
});
