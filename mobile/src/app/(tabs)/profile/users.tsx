import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useUpdateUserDomains, useUpdateUserRole, useUsers } from '@/features/users/api';
import type { AdminDomain, Role, UserRow } from '@/features/users/types';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';

const ROLE_LABEL: Record<Role, string> = { SUPERADMIN: 'Суперадмін', ADMIN: 'Адмін', MEMBER: 'Учасник' };
const DOMAINS: AdminDomain[] = ['TENNIS', 'COFFEE', 'PADEL'];
const DOMAIN_LABEL: Record<AdminDomain, string> = { TENNIS: 'Теніс', COFFEE: 'Кава', PADEL: 'Падел' };

function UserRowView({ item }: { item: UserRow }) {
  const theme = useTheme();
  const updateRole = useUpdateUserRole();
  const updateDomains = useUpdateUserDomains();
  const currentDomains = new Set(item.adminDomains.map((d) => d.domain));

  function handleRoleChange(role: Role) {
    updateRole.mutate(
      { id: item.id, role },
      { onError: (error) => Alert.alert('Помилка', error instanceof ApiError ? error.message : 'Не вдалося змінити роль') },
    );
  }

  function toggleDomain(domain: AdminDomain) {
    const next = new Set(currentDomains);
    if (next.has(domain)) next.delete(domain);
    else next.add(domain);
    updateDomains.mutate(
      { id: item.id, domains: [...next] },
      { onError: (error) => Alert.alert('Помилка', error instanceof ApiError ? error.message : 'Не вдалося змінити домени') },
    );
  }

  return (
    <ThemedView style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{item.name ?? item.email}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {item.email}
      </ThemedText>
      <SegmentedControl
        options={['SUPERADMIN', 'ADMIN', 'MEMBER']}
        labels={ROLE_LABEL}
        value={item.role}
        onChange={handleRoleChange}
      />
      {item.role === 'ADMIN' && (
        <ThemedView style={styles.domainRow}>
          {DOMAINS.map((domain) => {
            const active = currentDomains.has(domain);
            return (
              <Pressable
                key={domain}
                onPress={() => toggleDomain(domain)}
                style={[styles.domainChip, { backgroundColor: active ? theme.backgroundSelected : theme.background }]}>
                <ThemedText type="small">{DOMAIN_LABEL[domain]}</ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>
      )}
    </ThemedView>
  );
}

export default function UsersAdminScreen() {
  const { data, isLoading, isError } = useUsers();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {isLoading ? (
          <ActivityIndicator style={styles.center} />
        ) : isError || !data ? (
          <ThemedText style={styles.center}>Не вдалося завантажити користувачів</ThemedText>
        ) : (
          <FlatList
            data={data.users}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <UserRowView item={item} />}
            contentContainerStyle={styles.list}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  list: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  center: { marginTop: Spacing.five, textAlign: 'center' },
  row: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two },
  domainRow: { flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap' },
  domainChip: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Spacing.one },
});
