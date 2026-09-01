import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useNewsPost, useUpdateNewsPost } from '@/features/news/api';
import { NewsForm } from '@/features/news/news-form';
import { ApiError } from '@/lib/api';

export default function EditNewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useNewsPost(id);
  const { mutate, isPending } = useUpdateNewsPost(id);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>();

  if (isLoading || !data) return <ActivityIndicator style={styles.center} />;

  return (
    <ThemedView style={styles.container}>
      <NewsForm
        initialValues={data.post}
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

const styles = StyleSheet.create({ container: { flex: 1 }, center: { flex: 1 } });
