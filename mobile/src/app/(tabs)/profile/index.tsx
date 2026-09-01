import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { hasAnyAdminAccess, isDomainAdmin, isSuperAdmin } from '@/lib/permissions';

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: 'Суперадмін',
  ADMIN: 'Адмін',
  MEMBER: 'Учасник',
};

const DOMAIN_LABEL: Record<string, string> = {
  TENNIS: 'Теніс',
  COFFEE: 'Кава',
  PADEL: 'Падел',
};

export default function ProfileScreen() {
  const { session, isLoading, isSigningIn, signIn, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const theme = useTheme();
  const canManageAnything = hasAnyAdminAccess(session?.user);
  const canManageMenu = isDomainAdmin(session?.user, 'COFFEE');
  const canManageUsers = isSuperAdmin(session?.user);

  async function handleSignIn() {
    try {
      await signIn();
    } catch (error) {
      Alert.alert('Не вдалося увійти', error instanceof Error ? error.message : 'Спробуйте ще раз');
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.center}>
        {session ? (
          <>
            <ThemedText type="title" style={styles.centerText}>
              {session.user.name ?? session.user.email}
            </ThemedText>
            <ThemedText themeColor="textSecondary">{session.user.email}</ThemedText>
            <ThemedText type="smallBold" style={styles.badge}>
              {ROLE_LABEL[session.user.role] ?? session.user.role}
              {session.user.domains.length > 0
                ? ` · ${session.user.domains.map((d) => DOMAIN_LABEL[d] ?? d).join(', ')}`
                : ''}
            </ThemedText>
            <Pressable style={styles.button} onPress={handleSignOut} disabled={isSigningOut}>
              {isSigningOut ? <ActivityIndicator /> : <ThemedText themeColor="background">Вийти</ThemedText>}
            </Pressable>

            {canManageAnything && (
              <ThemedView style={styles.adminSection}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Керування
                </ThemedText>
                <Link href="/(tabs)/profile/players" asChild>
                  <Pressable style={[styles.adminLink, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="small">Гравці</ThemedText>
                  </Pressable>
                </Link>
                {canManageMenu && (
                  <Link href="/(tabs)/profile/menu" asChild>
                    <Pressable style={[styles.adminLink, { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText type="small">Меню кав&apos;ярні</ThemedText>
                    </Pressable>
                  </Link>
                )}
                {canManageUsers && (
                  <Link href="/(tabs)/profile/users" asChild>
                    <Pressable style={[styles.adminLink, { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText type="small">Користувачі</ThemedText>
                    </Pressable>
                  </Link>
                )}
              </ThemedView>
            )}
          </>
        ) : (
          <>
            <ThemedText type="title" style={styles.centerText}>
              Увійдіть, щоб керувати SET.club
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              Перегляд турнірів і матчів доступний без входу — вхід потрібен лише для адмінських дій.
            </ThemedText>
            <Pressable style={styles.button} onPress={handleSignIn} disabled={isSigningIn}>
              {isSigningIn ? <ActivityIndicator /> : <ThemedText themeColor="background">Увійти через Google</ThemedText>}
            </Pressable>
          </>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  centerText: { textAlign: 'center' },
  badge: { marginTop: Spacing.one },
  adminSection: { marginTop: Spacing.five, alignItems: 'center', gap: Spacing.two, width: '100%' },
  adminLink: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, borderRadius: Spacing.two, minWidth: 220, alignItems: 'center' },
  button: {
    marginTop: Spacing.four,
    backgroundColor: '#3c87f7',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    minWidth: 220,
    alignItems: 'center',
  },
});
