import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { usePlayer, useUpdatePlayer } from '@/features/players/api';
import { PlayerForm } from '@/features/players/player-form';
import { ApiError } from '@/lib/api';

export default function EditPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = usePlayer(id);
  const { mutate, isPending } = useUpdatePlayer(id);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>();

  if (isLoading || !data) return <ActivityIndicator style={styles.center} />;

  const player = data.player;

  return (
    <ThemedView style={styles.container}>
      <PlayerForm
        initialValues={{
          name: player.name,
          email: player.email ?? '',
          gender: player.gender ?? '',
          nickname: player.nickname ?? '',
        }}
        submitLabel="Зберегти"
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
            onError: (err) => setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти зміни'),
          });
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, center: { flex: 1 } });
