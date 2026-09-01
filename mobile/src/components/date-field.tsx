import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** ISO date string ("YYYY-MM-DD..." or full ISO) or "" for unset. */
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  optional?: boolean;
};

/** `selectedDate` from the native picker is a Date set to *local* midnight of the picked day - converting with `toISOString()` shifts it back a day in any positive-UTC-offset timezone (e.g. Ukraine), so build the YYYY-MM-DD string from local Y/M/D components instead. */
function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Native date picker (a dialog on Android, inline on iOS) - stores/emits plain YYYY-MM-DD, same string shape the tournament/match/rubber forms already sent as text. */
export function DateField({ value, onChange, placeholder = 'Обрати дату', optional = false }: Props) {
  const [show, setShow] = useState(false);
  const theme = useTheme();
  const dateValue = value ? new Date(value) : new Date();

  return (
    <>
      <Pressable
        style={[styles.field, { backgroundColor: theme.backgroundElement }]}
        onPress={() => setShow((current) => !current)}>
        <ThemedText type="small" themeColor={value ? 'text' : 'textSecondary'}>
          {value ? value.slice(0, 10) : placeholder}
        </ThemedText>
        {optional && value && (
          <Pressable onPress={() => onChange('')}>
            <ThemedText type="small" themeColor="textSecondary">
              Очистити
            </ThemedText>
          </Pressable>
        )}
      </Pressable>
      {show && (
        <>
          <DateTimePicker
            value={dateValue}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(event, selectedDate) => {
              if (Platform.OS === 'android') setShow(false);
              if (event.type === 'set' && selectedDate) {
                onChange(toLocalIsoDate(selectedDate));
              }
            }}
          />
          {Platform.OS === 'ios' && (
            <Pressable style={[styles.doneButton, { backgroundColor: theme.backgroundElement }]} onPress={() => setShow(false)}>
              <ThemedText type="small">Готово</ThemedText>
            </Pressable>
          )}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  doneButton: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
