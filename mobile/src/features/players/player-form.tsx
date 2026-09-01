import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { PlayerFormInput } from './types';

const GENDER_LABEL: Record<'' | 'MALE' | 'FEMALE', string> = { '': 'Не вказано', MALE: 'Чоловіча', FEMALE: 'Жіноча' };

type Props = {
  initialValues?: PlayerFormInput;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  fieldErrors?: Record<string, string>;
  onSubmit: (values: PlayerFormInput) => void;
};

/** Mirrors playerFormSchema (src/lib/validation/player.ts). */
export function PlayerForm({ initialValues, submitLabel, submitting, error, fieldErrors, onSubmit }: Props) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [email, setEmail] = useState(initialValues?.email ?? '');
  const [nickname, setNickname] = useState(initialValues?.nickname ?? '');
  const [gender, setGender] = useState<'' | 'MALE' | 'FEMALE'>(initialValues?.gender ?? '');
  const theme = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.form}>
      <ThemedText type="smallBold">Ім&apos;я</ThemedText>
      <TextInput
        value={name}
        onChangeText={setName}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
      />
      {fieldErrors?.name && <ThemedText themeColor="textSecondary">{fieldErrors.name}</ThemedText>}

      <ThemedText type="smallBold">Псевдонім (необов&apos;язково)</ThemedText>
      <TextInput
        value={nickname}
        onChangeText={setNickname}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
      />

      <ThemedText type="smallBold">Email (необов&apos;язково)</ThemedText>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
      />
      {fieldErrors?.email && <ThemedText themeColor="textSecondary">{fieldErrors.email}</ThemedText>}

      <ThemedText type="smallBold">Стать</ThemedText>
      <SegmentedControl options={['', 'MALE', 'FEMALE']} labels={GENDER_LABEL} value={gender} onChange={setGender} />

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <Pressable style={styles.submit} disabled={submitting} onPress={() => onSubmit({ name, email, gender, nickname })}>
        {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText themeColor="background">{submitLabel}</ThemedText>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
