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

/** Native date picker (a dialog on Android, inline on iOS) - stores/emits plain YYYY-MM-DD, same string shape the tournament/match/rubber forms already sent as text. */
export function DateField({ value, onChange, placeholder = 'Обрати дату', optional = false }: Props) {
  const [show, setShow] = useState(false);
  const theme = useTheme();
  const dateValue = value ? new Date(value) : new Date();

  return (
    <>
      <Pressable
        style={[styles.field, { backgroundColor: theme.backgroundElement }]}
        onPress={() => setShow(true)}>
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
        <DateTimePicker
          value={dateValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, selectedDate) => {
            if (Platform.OS === 'android') setShow(false);
            if (event.type === 'set' && selectedDate) {
              onChange(selectedDate.toISOString().slice(0, 10));
            }
          }}
        />
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
});
