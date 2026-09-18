import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  players: { id: string; name: string }[];
  /** Can't compare a player against themselves - excluded from the list instead of shown disabled. */
  excludeId?: string;
  /** Selected player id, "" for none. */
  value: string;
  onChange: (id: string) => void;
};

/**
 * Single-select player field with an inline search+list, same
 * tap-to-expand pattern as DateField (components/date-field.tsx) rather
 * than a Modal - mirrors web's PlayerSelect (player-compare-form.tsx) for
 * the rating-compare screen, and is generic enough to reuse anywhere else a
 * single-player picker is needed.
 */
export function PlayerPicker({ label, players, excludeId, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const theme = useTheme();

  const options = players.filter((p) => p.id !== excludeId);
  const selectedName = options.find((p) => p.id === value)?.name;
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch ? options.filter((p) => p.name.toLowerCase().includes(normalizedSearch)) : options;

  return (
    <ThemedView style={styles.wrap}>
      <Pressable
        style={[styles.field, { backgroundColor: theme.backgroundElement }]}
        onPress={() => {
          setOpen((current) => !current);
          setSearch('');
        }}>
        <ThemedText type="small" themeColor={selectedName ? 'text' : 'textSecondary'}>
          {selectedName ?? label}
        </ThemedText>
      </Pressable>
      {open && (
        <ThemedView style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
          <TextInput
            autoFocus
            value={search}
            onChangeText={setSearch}
            placeholder="Пошук…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.search, { color: theme.text, borderBottomColor: theme.backgroundSelected }]}
          />
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {filtered.map((player) => (
              <Pressable
                key={player.id}
                style={[styles.option, player.id === value && { backgroundColor: theme.backgroundSelected }]}
                onPress={() => {
                  onChange(player.id);
                  setOpen(false);
                }}>
                <ThemedText type="small">{player.name}</ThemedText>
              </Pressable>
            ))}
            {filtered.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                Нічого не знайдено
              </ThemedText>
            )}
          </ScrollView>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  field: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  panel: { borderRadius: Spacing.two, overflow: 'hidden' },
  search: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth, fontSize: 14 },
  list: { maxHeight: 240 },
  option: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  empty: { padding: Spacing.three },
});
