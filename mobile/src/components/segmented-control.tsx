import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Generic labeled-options row - used for enum pickers (tournament format/status/surface) and simple toggles (sport, singles/doubles). */
export function SegmentedControl<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.row}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.segment, { backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement }]}>
            <ThemedText type="small">{labels[option]}</ThemedText>
          </Pressable>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap' },
  segment: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
});
