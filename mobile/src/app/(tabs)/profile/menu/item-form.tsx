import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCreateMenuItem, useMenuSections, useUpdateMenuItem } from '@/features/menu/api';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';

/** Create (`sectionId` param) or edit (`id` param) a menu item - mirrors section-form.tsx's shared create/edit shape. */
export default function MenuItemFormScreen() {
  const { id, sectionId } = useLocalSearchParams<{ id?: string; sectionId?: string }>();
  const router = useRouter();
  const { data } = useMenuSections();
  const existingSection = data?.sections.find((s) => s.items.some((item) => item.id === id));
  const existing = existingSection?.items.find((item) => item.id === id);
  const effectiveSectionId = existing?.sectionId ?? sectionId ?? '';

  const create = useCreateMenuItem();
  const update = useUpdateMenuItem(id ?? '');
  const theme = useTheme();

  const [name, setName] = useState(existing?.name ?? '');
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  const submitting = create.isPending || update.isPending;

  function onDone(result: { success: true } | { error: string }) {
    if ('error' in result) {
      setError(result.error);
      return;
    }
    router.back();
  }

  function onError(err: unknown) {
    setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти напій');
  }

  function submit() {
    setError(null);
    const values = {
      sectionId: effectiveSectionId,
      name,
      price: Number(price) || 0,
      description,
      sortOrder: existing?.sortOrder ?? 0,
    };
    if (id) update.mutate(values, { onSuccess: onDone, onError });
    else create.mutate(values, { onSuccess: onDone, onError });
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.form}>
        <ThemedText type="smallBold">Назва</ThemedText>
        <TextInput
          value={name}
          onChangeText={setName}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />

        <ThemedText type="smallBold">Ціна (грн)</ThemedText>
        <TextInput
          value={price}
          onChangeText={setPrice}
          keyboardType="number-pad"
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />

        <ThemedText type="smallBold">Опис (необов&apos;язково)</ThemedText>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          style={[styles.input, styles.multiline, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <Pressable style={styles.submit} disabled={submitting} onPress={submit}>
          {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText themeColor="background">{id ? 'Зберегти' : 'Додати напій'}</ThemedText>}
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.six },
  input: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: '#d33' },
  submit: {
    marginTop: Spacing.three,
    backgroundColor: '#3c87f7',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
