import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useCreateNewsPost } from '@/features/news/api';
import { NewsForm } from '@/features/news/news-form';
import { ApiError } from '@/lib/api';

export default function NewNewsScreen() {
  const router = useRouter();
  const { mutate, isPending } = useCreateNewsPost();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>();

  return (
    <ThemedView style={styles.container}>
      <NewsForm
        submitLabel="Опублікувати"
        submitting={isPending}
        error={error}
        fieldErrors={fieldErrors}
        onSubmit={(values) => {
          setError(null);
          setFieldErrors(undefined);
          mutate(values, {
            onSuccess: () => router.replace('/(tabs)/news'),
            onError: (err) => {
              if (err instanceof ApiError) {
                setError(err.message);
                setFieldErrors(err.fieldErrors);
              } else {
                setError('Не вдалося опублікувати новину');
              }
            },
          });
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
