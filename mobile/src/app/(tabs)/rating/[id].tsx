import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAchievements, usePlayer } from '@/features/players/api';
import type { Achievement } from '@/features/players/types';
import { useTheme } from '@/hooks/use-theme';
import { readAchievementsHidden, writeAchievementsHidden } from '@/lib/achievements-storage';
import { ApiError } from '@/lib/api';
import { formatDateKyiv } from '@/lib/date-format';

export default function PlayerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    data: playerData,
    isLoading: isPlayerLoading,
    isError: isPlayerError,
    error: playerError,
  } = usePlayer(id);
  const { data: achievementsData, isLoading: isAchievementsLoading, isError: isAchievementsError } =
    useAchievements(id);
  const theme = useTheme();
  // Starts visible on first render (AsyncStorage reads are async, unlike the
  // web version's synchronous localStorage) and switches to the remembered
  // preference once it resolves - same reasoning as PlayerAchievements on
  // the web (src/components/player-achievements.tsx).
  const [hidden, setHidden] = useState(false);
  // Guards against the async AsyncStorage read (fired on mount) clobbering a
  // tap that happens before it resolves - without this, tapping "Сховати"
  // right after opening the screen could get silently reverted a moment
  // later when the stale read finally comes back.
  const userToggledRef = useRef(false);
  useEffect(() => {
    readAchievementsHidden().then((stored) => {
      if (!userToggledRef.current) setHidden(stored);
    });
  }, []);

  function toggleHidden() {
    userToggledRef.current = true;
    setHidden((prev) => {
      const next = !prev;
      writeAchievementsHidden(next);
      return next;
    });
  }

  if (isPlayerLoading) return <ActivityIndicator style={styles.center} />;
  if (isPlayerError) {
    const notFound = playerError instanceof ApiError && playerError.status === 404;
    return (
      <ThemedText style={styles.center}>
        {notFound ? 'Гравця не знайдено' : 'Не вдалося завантажити гравця'}
      </ThemedText>
    );
  }
  if (!playerData) return <ThemedText style={styles.center}>Гравця не знайдено</ThemedText>;

  const achievements = achievementsData?.achievements ?? [];
  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.name}>
          {playerData.player.name}
        </ThemedText>

        <ThemedView style={styles.sectionHeader}>
          <ThemedText type="smallBold">
            Досягнення{achievements.length > 0 ? ` (${earnedCount} з ${achievements.length})` : ''}
          </ThemedText>
          {achievements.length > 0 && (
            <Pressable onPress={toggleHidden}>
              <ThemedText type="small" themeColor="textSecondary">
                {hidden ? 'Показати' : 'Сховати'}
              </ThemedText>
            </Pressable>
          )}
        </ThemedView>

        {isAchievementsLoading ? (
          <ActivityIndicator style={styles.center} />
        ) : isAchievementsError ? (
          <ThemedText type="small" themeColor="textSecondary">
            Не вдалося завантажити досягнення
          </ThemedText>
        ) : !hidden ? (
          <ThemedView style={styles.badgeGrid}>
            {achievements.map((achievement) => (
              <AchievementChip key={achievement.id} achievement={achievement} backgroundColor={theme.backgroundElement} />
            ))}
          </ThemedView>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function AchievementChip({ achievement, backgroundColor }: { achievement: Achievement; backgroundColor: string }) {
  // formatDateKyiv, not toLocaleDateString - see its own doc comment
  // (mobile/src/lib/date-format.ts) for why earnedAt's mixed date-only/
  // timestamp nature needs a fixed timezone, not the device's local one.
  const earnedDate = achievement.earnedAt ? formatDateKyiv(new Date(achievement.earnedAt)) : undefined;
  return (
    <ThemedView style={[styles.badge, { backgroundColor }, !achievement.earned && styles.badgeLocked]}>
      <Ionicons
        name={achievement.earned ? 'trophy' : 'lock-closed'}
        size={14}
        color={achievement.earned ? '#d97706' : undefined}
      />
      <ThemedView style={styles.badgeText}>
        <ThemedText type="small" themeColor={achievement.earned ? undefined : 'textSecondary'}>
          {achievement.label}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.badgeDescription}>
          {earnedDate ? `${achievement.description} — ${earnedDate}` : achievement.description}
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  center: { marginTop: Spacing.five, textAlign: 'center' },
  name: { fontSize: 28, lineHeight: 34 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.three },
  badgeGrid: { gap: Spacing.two },
  badge: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.two },
  badgeLocked: { opacity: 0.6 },
  badgeText: { flex: 1, gap: Spacing.half, backgroundColor: 'transparent' },
  badgeDescription: { fontSize: 12, lineHeight: 16 },
});
