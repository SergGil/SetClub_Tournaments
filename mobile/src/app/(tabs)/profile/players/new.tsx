import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useCreatePlayer } from '@/features/players/api';
import { PlayerForm } from '@/features/players/player-form';
import { ApiError } from '@/lib/api';

export default function NewPlayerScreen() {
  const router = useRouter();
  const { mutate, isPending } = useCreatePlayer();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>();

  return (
    <ThemedView style={styles.container}>
      <PlayerForm
        submitLabel="Створити гравця"
        submitting={isPending}
        error={error}
        fieldErrors={fieldErrors}
        onSubmit={(values) => {
          setError(null);
          setFieldErrors(undefined);
          mutate(values, {
            onSuccess: (result) => {
              if ('error' in result) {
                setError(result.error);
                setFieldErrors(result.fieldErrors);
                return;
              }
              router.back();
            },
            onError: (err) => setError(err instanceof ApiError ? err.message : 'Не вдалося створити гравця'),
          });
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
