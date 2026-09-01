import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { NewsPostFormInput } from './types';

type Props = {
  initialValues?: NewsPostFormInput;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  fieldErrors?: Record<string, string>;
  onSubmit: (values: NewsPostFormInput) => void;
};

/** Mirrors newsPostFormSchema (src/lib/validation/news.ts). No photo upload yet from mobile - see docs/MOBILE_APP.md. */
export function NewsForm({ initialValues, submitLabel, submitting, error, fieldErrors, onSubmit }: Props) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [body, setBody] = useState(initialValues?.body ?? '');
  const theme = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.form}>
      <ThemedText type="smallBold">Заголовок</ThemedText>
      <TextInput
        value={title}
        onChangeText={setTitle}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        placeholderTextColor={theme.textSecondary}
      />
      {fieldErrors?.title && <ThemedText themeColor="textSecondary">{fieldErrors.title}</ThemedText>}

      <ThemedText type="smallBold">Текст</ThemedText>
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        style={[styles.input, styles.multiline, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        placeholderTextColor={theme.textSecondary}
      />
      {fieldErrors?.body && <ThemedText themeColor="textSecondary">{fieldErrors.body}</ThemedText>}

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <Pressable style={styles.submit} disabled={submitting} onPress={() => onSubmit({ title, body })}>
        {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText themeColor="background">{submitLabel}</ThemedText>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.six },
  input: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  multiline: { minHeight: 180, textAlignVertical: 'top' },
  error: { color: '#d33' },
  submit: {
    marginTop: Spacing.three,
    backgroundColor: '#3c87f7',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
