import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCreateMenuSection, useMenuSections, useUpdateMenuSection } from '@/features/menu/api';
import { MENU_LAYOUT_LABEL, MENU_LAYOUTS, type MenuLayout } from '@/features/menu/types';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';

/** Create (no `id` param) or edit (`id` present) a menu section - one screen for both, mirroring the web dialog's shared form. */
export default function MenuSectionFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { data } = useMenuSections();
  const existing = id ? data?.sections.find((s) => s.id === id) : undefined;

  const create = useCreateMenuSection();
  const update = useUpdateMenuSection(id ?? '');
  const theme = useTheme();

  const [name, setName] = useState(existing?.name ?? '');
  const [tagline, setTagline] = useState(existing?.tagline ?? '');
  const [layout, setLayout] = useState<MenuLayout>((existing?.layout as MenuLayout) ?? 'LIST');
  const [error, setError] = useState<string | null>(null);

  const submitting = create.isPending || update.isPending;

  function submit() {
    setError(null);
    const values = { name, tagline, layout, sortOrder: existing?.sortOrder ?? 0 };
    if (id) update.mutate(values, { onSuccess: onDone, onError });
    else create.mutate(values, { onSuccess: onDone, onError });
  }

  function onDone(result: { success: true } | { error: string }) {
    if ('error' in result) {
      setError(result.error);
      return;
    }
    router.back();
  }

  function onError(err: unknown) {
    setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти секцію');
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

        <ThemedText type="smallBold">Підзаголовок (необов&apos;язково)</ThemedText>
        <TextInput
          value={tagline}
          onChangeText={setTagline}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />

        <ThemedText type="smallBold">Відображення</ThemedText>
        <SegmentedControl options={MENU_LAYOUTS} labels={MENU_LAYOUT_LABEL} value={layout} onChange={setLayout} />

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <Pressable style={styles.submit} disabled={submitting} onPress={submit}>
          {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText themeColor="background">{id ? 'Зберегти' : 'Створити секцію'}</ThemedText>}
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.six },
  input: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  error: { color: '#d33' },
  submit: {
    marginTop: Spacing.three,
    backgroundColor: '#3c87f7',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
