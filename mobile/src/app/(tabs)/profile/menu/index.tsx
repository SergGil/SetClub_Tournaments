import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  useDeleteMenuItem,
  useDeleteMenuSection,
  useMenuSections,
  useToggleMenuItemActive,
  useToggleMenuSectionActive,
} from '@/features/menu/api';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';

export default function MenuAdminScreen() {
  const { data, isLoading, isError } = useMenuSections();
  const router = useRouter();
  const theme = useTheme();
  const toggleSection = useToggleMenuSectionActive();
  const deleteSection = useDeleteMenuSection();
  const toggleItem = useToggleMenuItemActive();
  const deleteItem = useDeleteMenuItem();

  if (isLoading) return <ActivityIndicator style={styles.center} />;
  if (isError || !data) return <ThemedText style={styles.center}>Не вдалося завантажити меню</ThemedText>;

  function confirmDeleteSection(id: string, name: string) {
    Alert.alert('Видалити секцію', `«${name}» разом з усіма напоями буде видалено.`, [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: () =>
          deleteSection.mutate(id, {
            onSuccess: (result) => 'error' in result && Alert.alert('Помилка', result.error),
            onError: (error) => Alert.alert('Помилка', error instanceof ApiError ? error.message : 'Не вдалося видалити'),
          }),
      },
    ]);
  }

  function confirmDeleteItem(id: string, name: string) {
    Alert.alert('Видалити напій', `«${name}» буде видалено.`, [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: () =>
          deleteItem.mutate(id, {
            onError: (error) => Alert.alert('Помилка', error instanceof ApiError ? error.message : 'Не вдалося видалити'),
          }),
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable style={styles.addSection} onPress={() => router.push('/(tabs)/profile/menu/section-form')}>
            <ThemedText themeColor="background" type="smallBold">
              + Секція
            </ThemedText>
          </Pressable>

          {data.sections.map((section) => (
            <ThemedView key={section.id} style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
              <ThemedView style={styles.sectionHeader}>
                <ThemedText type="smallBold">
                  {section.name}
                  {!section.active ? ' (приховано)' : ''}
                </ThemedText>
                <ThemedView style={styles.sectionActions}>
                  <Pressable onPress={() => toggleSection.mutate({ id: section.id, active: !section.active })}>
                    <ThemedText type="small">{section.active ? 'Приховати' : 'Показати'}</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => router.push({ pathname: '/(tabs)/profile/menu/section-form', params: { id: section.id } })}>
                    <ThemedText type="small">Редагувати</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => confirmDeleteSection(section.id, section.name)}>
                    <ThemedText type="small">Видалити</ThemedText>
                  </Pressable>
                </ThemedView>
              </ThemedView>

              {section.items.map((item) => (
                <ThemedView key={item.id} style={styles.itemRow}>
                  <ThemedText type="small" style={styles.itemInfo}>
                    {item.name} — {item.price} грн{!item.active ? ' (приховано)' : ''}
                  </ThemedText>
                  <Pressable onPress={() => toggleItem.mutate({ id: item.id, active: !item.active })}>
                    <ThemedText type="small">{item.active ? '👁' : '🚫'}</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => router.push({ pathname: '/(tabs)/profile/menu/item-form', params: { id: item.id } })}>
                    <ThemedText type="small">✎</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => confirmDeleteItem(item.id, item.name)}>
                    <ThemedText type="small">✕</ThemedText>
                  </Pressable>
                </ThemedView>
              ))}

              <Pressable onPress={() => router.push({ pathname: '/(tabs)/profile/menu/item-form', params: { sectionId: section.id } })}>
                <ThemedText type="small" themeColor="textSecondary">
                  + Напій
                </ThemedText>
              </Pressable>
            </ThemedView>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  center: { marginTop: Spacing.five, textAlign: 'center' },
  addSection: { backgroundColor: '#3c87f7', padding: Spacing.three, borderRadius: Spacing.two, alignItems: 'center' },
  section: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two },
  sectionHeader: { gap: Spacing.one },
  sectionActions: { flexDirection: 'row', gap: Spacing.three },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  itemInfo: { flex: 1 },
});
