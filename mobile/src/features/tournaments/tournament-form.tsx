import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import {
  COURT_SURFACE_LABEL,
  COURT_SURFACES,
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_FORMATS,
  TOURNAMENT_STATUS_LABEL,
  TOURNAMENT_STATUSES,
  type CourtSurface,
  type TournamentFormat,
  type TournamentFormInput,
  type TournamentStatus,
} from './types';

type Props = {
  initialValues?: Partial<TournamentFormInput>;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  fieldErrors?: Record<string, string>;
  onSubmit: (values: TournamentFormInput) => void;
};

/** Mirrors tournamentFormSchema (src/lib/validation/tournament.ts) - shared by new.tsx and [id]/edit.tsx. */
export function TournamentForm({ initialValues, submitLabel, submitting, error, fieldErrors, onSubmit }: Props) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [format, setFormat] = useState<TournamentFormat>(initialValues?.format ?? 'SINGLES');
  const [status, setStatus] = useState<TournamentStatus>(initialValues?.status ?? 'UPCOMING');
  const [surface, setSurface] = useState<CourtSurface>(initialValues?.surface ?? 'HARD');
  const [startDate, setStartDate] = useState(initialValues?.startDate?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(initialValues?.endDate?.slice(0, 10) ?? '');
  const theme = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.form}>
      <ThemedText type="smallBold">Назва</ThemedText>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Наприклад, Зимова ліга"
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        placeholderTextColor={theme.textSecondary}
      />
      {fieldErrors?.name && <ThemedText themeColor="textSecondary">{fieldErrors.name}</ThemedText>}

      <ThemedText type="smallBold">Опис (необов&apos;язково)</ThemedText>
      <TextInput
        value={description}
        onChangeText={setDescription}
        multiline
        style={[styles.input, styles.multiline, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        placeholderTextColor={theme.textSecondary}
      />

      <ThemedText type="smallBold">Формат</ThemedText>
      <SegmentedControl options={TOURNAMENT_FORMATS} labels={TOURNAMENT_FORMAT_LABEL} value={format} onChange={setFormat} />

      <ThemedText type="smallBold">Статус</ThemedText>
      <SegmentedControl options={TOURNAMENT_STATUSES} labels={TOURNAMENT_STATUS_LABEL} value={status} onChange={setStatus} />

      <ThemedText type="smallBold">Покриття</ThemedText>
      <SegmentedControl options={COURT_SURFACES} labels={COURT_SURFACE_LABEL} value={surface} onChange={setSurface} />

      <ThemedText type="smallBold">Дата початку (РРРР-ММ-ДД)</ThemedText>
      <TextInput
        value={startDate}
        onChangeText={setStartDate}
        placeholder="2026-06-01"
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        placeholderTextColor={theme.textSecondary}
      />
      {fieldErrors?.startDate && <ThemedText themeColor="textSecondary">{fieldErrors.startDate}</ThemedText>}

      <ThemedText type="smallBold">Дата завершення (РРРР-ММ-ДД)</ThemedText>
      <TextInput
        value={endDate}
        onChangeText={setEndDate}
        placeholder="2026-06-15"
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        placeholderTextColor={theme.textSecondary}
      />
      {fieldErrors?.endDate && <ThemedText themeColor="textSecondary">{fieldErrors.endDate}</ThemedText>}

      {error && (
        <ThemedText type="smallBold" themeColor="text" style={styles.error}>
          {error}
        </ThemedText>
      )}

      <Pressable
        style={styles.submit}
        disabled={submitting}
        onPress={() =>
          onSubmit({
            name,
            description,
            format,
            status,
            surface,
            startDate,
            endDate,
          })
        }>
        {submitting ? <ActivityIndicator color="#fff" /> : <ThemedText themeColor="background">{submitLabel}</ThemedText>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.six },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
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
