import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { scoreSummary, sideNames } from '@/features/matches/format';
import { useDeleteTeam, useDeleteTie, useTeams, useTies } from '@/features/teams/api';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { isDomainAdmin } from '@/lib/permissions';
import { sportDomain, useSport } from '@/lib/sport-context';

export default function TeamsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const { sport } = useSport();
  const canManage = isDomainAdmin(session?.user, sportDomain(sport));

  const { data: teamsData, isLoading: teamsLoading } = useTeams(id);
  const { data: tiesData, isLoading: tiesLoading } = useTies(id);
  const deleteTeam = useDeleteTeam(id);
  const deleteTie = useDeleteTie(id);

  if (teamsLoading || tiesLoading) return <ActivityIndicator style={styles.center} />;

  const teams = teamsData?.teams ?? [];
  const ties = tiesData?.ties ?? [];
  const standings = tiesData?.rows ?? [];

  function confirmDeleteTeam(teamId: string, name: string) {
    Alert.alert('Видалити команду', `«${name}» буде видалено.`, [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: () =>
          deleteTeam.mutate(teamId, {
            onSuccess: (result) => 'error' in result && Alert.alert('Помилка', result.error),
            onError: (error) => Alert.alert('Помилка', error instanceof ApiError ? error.message : 'Не вдалося видалити'),
          }),
      },
    ]);
  }

  function confirmDeleteTie(tieId: string, label: string) {
    Alert.alert('Видалити зустріч', `«${label}» буде видалено. Раббери лишаться окремими матчами.`, [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: () =>
          deleteTie.mutate(tieId, {
            onError: (error) => Alert.alert('Помилка', error instanceof ApiError ? error.message : 'Не вдалося видалити'),
          }),
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          {standings.length > 0 && (
            <ThemedView style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Турнірна таблиця команд</ThemedText>
              {standings.map((row, index) => (
                <ThemedText key={row.key} type="small">
                  {index + 1}. {row.label} — {row.wins}П/{row.losses}Пор ({row.points} очок)
                </ThemedText>
              ))}
            </ThemedView>
          )}

          <ThemedView style={styles.sectionHeader}>
            <ThemedText type="subtitle">Команди</ThemedText>
            {canManage && (
              <Pressable style={styles.addButton} onPress={() => router.push({ pathname: '/(tabs)/tournaments/[id]/team-form', params: { id } })}>
                <ThemedText themeColor="background" type="small">
                  + Команда
                </ThemedText>
              </Pressable>
            )}
          </ThemedView>
          {teams.map((team) => (
            <ThemedView key={team.id} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
              <ThemedView style={styles.rowInfo}>
                <ThemedText type="smallBold">{team.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {team.members.map((m) => m.name).join(', ')}
                </ThemedText>
              </ThemedView>
              {canManage && (
                <ThemedView style={styles.rowActions}>
                  <Pressable onPress={() => router.push({ pathname: '/(tabs)/tournaments/[id]/team-form', params: { id, teamId: team.id } })}>
                    <ThemedText type="small">✎</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => confirmDeleteTeam(team.id, team.name)}>
                    <ThemedText type="small">✕</ThemedText>
                  </Pressable>
                </ThemedView>
              )}
            </ThemedView>
          ))}
          {teams.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Команд ще немає
            </ThemedText>
          )}

          <ThemedView style={styles.sectionHeader}>
            <ThemedText type="subtitle">Зустрічі</ThemedText>
            {canManage && teams.length >= 2 && (
              <Pressable style={styles.addButton} onPress={() => router.push({ pathname: '/(tabs)/tournaments/[id]/tie-form', params: { id } })}>
                <ThemedText themeColor="background" type="small">
                  + Зустріч
                </ThemedText>
              </Pressable>
            )}
          </ThemedView>
          {ties.map((tie) => (
            <ThemedView key={tie.id} style={[styles.tieBlock, { backgroundColor: theme.backgroundElement }]}>
              <ThemedView style={styles.sectionHeader}>
                <ThemedText type="smallBold">
                  {tie.teamA.name} — {tie.teamB.name}
                  {tie.label ? ` (${tie.label})` : ''}
                </ThemedText>
                {canManage && (
                  <Pressable onPress={() => confirmDeleteTie(tie.id, tie.label ?? `${tie.teamA.name} — ${tie.teamB.name}`)}>
                    <ThemedText type="small">✕</ThemedText>
                  </Pressable>
                )}
              </ThemedView>
              {tie.rubbers.map((rubber) => (
                <ThemedText key={rubber.id} type="small" themeColor="textSecondary">
                  {sideNames(rubber, 'A')} — {sideNames(rubber, 'B')}: {scoreSummary(rubber)}
                </ThemedText>
              ))}
              {canManage && (
                <Pressable
                  onPress={() => router.push({ pathname: '/(tabs)/tournaments/[id]/rubber-form', params: { id, tieId: tie.id } })}>
                  <ThemedText type="small" themeColor="textSecondary">
                    + Раббер
                  </ThemedText>
                </Pressable>
              )}
            </ThemedView>
          ))}
          {ties.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Зустрічей ще немає
            </ThemedText>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.six },
  center: { marginTop: Spacing.five },
  section: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.three },
  addButton: { backgroundColor: '#3c87f7', paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two },
  rowInfo: { flex: 1, gap: Spacing.half },
  rowActions: { flexDirection: 'row', gap: Spacing.two },
  tieBlock: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.half },
});
