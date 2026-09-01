import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  useDeleteTournament,
  useRemoveParticipant,
  useResetTournament,
  useTournament,
  useToggleParticipantSeed,
  useWithdrawParticipant,
} from '@/features/tournaments/api';
import { TOURNAMENT_FORMAT_LABEL, TOURNAMENT_STATUS_LABEL, COURT_SURFACE_LABEL } from '@/features/tournaments/types';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { isDomainAdmin } from '@/lib/permissions';

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError } = useTournament(id);
  const { session } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const canManage = isDomainAdmin(session?.user, 'TENNIS');

  const removeParticipant = useRemoveParticipant(id);
  const toggleSeed = useToggleParticipantSeed(id);
  const withdrawParticipant = useWithdrawParticipant(id);
  const resetTournament = useResetTournament(id);
  const deleteTournament = useDeleteTournament(id);
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);

  if (isLoading) return <ActivityIndicator style={styles.center} />;
  if (isError || !data) return <ThemedText style={styles.center}>Турнір не знайдено</ThemedText>;

  const tournament = data.tournament;

  function confirmWithdraw(playerId: string, name: string) {
    Alert.alert('Зняти з турніру', `Технічна поразка у всіх запланованих матчах гравця «${name}». Продовжити?`, [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Зняти',
        style: 'destructive',
        onPress: () => {
          setBusyPlayerId(playerId);
          withdrawParticipant.mutate(
            { playerId },
            {
              onSettled: () => setBusyPlayerId(null),
              onSuccess: (result) => {
                if ('error' in result) {
                  if (result.cascadeResets?.length) {
                    Alert.alert('Це скине рахунок нижче по сітці', result.error, [
                      { text: 'Скасувати', style: 'cancel' },
                      {
                        text: 'Підтвердити',
                        style: 'destructive',
                        onPress: () =>
                          withdrawParticipant.mutate({ playerId, acknowledgedCascadeReset: true }),
                      },
                    ]);
                  } else {
                    Alert.alert('Помилка', result.error);
                  }
                }
              },
            },
          );
        },
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert('Видалити турнір', `Турнір «${tournament.name}» буде видалено безповоротно.`, [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: () =>
          deleteTournament.mutate(false, {
            onSuccess: () => router.replace('/(tabs)/tournaments'),
            onError: (error) =>
              Alert.alert('Помилка', error instanceof ApiError ? error.message : 'Не вдалося видалити турнір'),
          }),
      },
    ]);
  }

  function confirmReset() {
    Alert.alert('Обнулити турнір', 'Усі матчі й розподіл по групах буде видалено. Ростер лишиться.', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Обнулити',
        style: 'destructive',
        onPress: () =>
          resetTournament.mutate(false, {
            onError: (error) =>
              Alert.alert('Помилка', error instanceof ApiError ? error.message : 'Не вдалося обнулити турнір'),
          }),
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{tournament.name}</ThemedText>
        {tournament.description && <ThemedText themeColor="textSecondary">{tournament.description}</ThemedText>}
        <ThemedText type="small" themeColor="textSecondary">
          {TOURNAMENT_FORMAT_LABEL[tournament.format]} · {TOURNAMENT_STATUS_LABEL[tournament.status]} ·{' '}
          {COURT_SURFACE_LABEL[tournament.surface]}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {tournament.startDate.slice(0, 10)} — {tournament.endDate.slice(0, 10)}
        </ThemedText>

        {canManage && (
          <ThemedView style={styles.actionsRow}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundElement }]}
              onPress={() => router.push(`/(tabs)/tournaments/${id}/edit`)}>
              <ThemedText type="small">Редагувати</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundElement }]}
              onPress={() => router.push(`/(tabs)/tournaments/${id}/add-participants`)}>
              <ThemedText type="small">+ Учасник</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundElement }]}
              onPress={() => router.push({ pathname: '/(tabs)/matches/new', params: { tournamentId: id } })}>
              <ThemedText type="small">+ Матч</ThemedText>
            </Pressable>
            <Pressable style={[styles.actionButton, { backgroundColor: theme.backgroundElement }]} onPress={confirmReset}>
              <ThemedText type="small">Обнулити</ThemedText>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.destructive]} onPress={confirmDelete}>
              <ThemedText type="small" themeColor="background">
                Видалити
              </ThemedText>
            </Pressable>
          </ThemedView>
        )}

        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Учасники ({tournament.participants.length})
        </ThemedText>
        {tournament.participants.map((participant) => {
          const isBusy = busyPlayerId === participant.playerId;
          return (
            <ThemedView key={participant.playerId} style={[styles.participantRow, { backgroundColor: theme.backgroundElement }]}>
              <ThemedView style={styles.participantInfo}>
                <ThemedText type="smallBold">
                  {participant.player.name}
                  {participant.player.nickname ? ` (${participant.player.nickname})` : ''}
                  {participant.seed ? ' ★' : ''}
                  {participant.withdrawnAt ? ' — знято' : ''}
                </ThemedText>
                {participant.group != null && (
                  <ThemedText type="small" themeColor="textSecondary">
                    Група {participant.group}
                  </ThemedText>
                )}
              </ThemedView>
              {canManage && !participant.withdrawnAt && (
                <ThemedView style={styles.participantActions}>
                  {isBusy ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <>
                      <Pressable
                        onPress={() =>
                          toggleSeed.mutate({ playerId: participant.playerId, seeded: !participant.seed })
                        }>
                        <ThemedText type="small">{participant.seed ? 'Зняти сіяність' : 'Сіяний'}</ThemedText>
                      </Pressable>
                      <Pressable onPress={() => confirmWithdraw(participant.playerId, participant.player.name)}>
                        <ThemedText type="small">Зняти</ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setBusyPlayerId(participant.playerId);
                          removeParticipant.mutate(participant.playerId, {
                            onSettled: () => setBusyPlayerId(null),
                            onError: (error) =>
                              Alert.alert('Помилка', error instanceof ApiError ? error.message : 'Не вдалося прибрати'),
                          });
                        }}>
                        <ThemedText type="small">Прибрати</ThemedText>
                      </Pressable>
                    </>
                  )}
                </ThemedView>
              )}
            </ThemedView>
          );
        })}

        {tournament.groups.length > 0 && (
          <>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Групи
            </ThemedText>
            {tournament.groups.map((group) => (
              <ThemedText key={group.id} type="small" themeColor="textSecondary">
                {group.name} — {group.members.length} гравців
              </ThemedText>
            ))}
          </>
        )}

        <Link href={{ pathname: '/(tabs)/matches', params: { tournamentId: id } }} asChild>
          <Pressable style={[styles.actionButton, { backgroundColor: theme.backgroundElement, marginTop: Spacing.four }]}>
            <ThemedText type="small">Переглянути матчі ({tournament._count.matches})</ThemedText>
          </Pressable>
        </Link>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.six },
  center: { marginTop: Spacing.five },
  actionsRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap', marginTop: Spacing.two },
  actionButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  destructive: { backgroundColor: '#d33' },
  sectionTitle: { marginTop: Spacing.four, fontSize: 20 },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
  },
  participantInfo: { flex: 1, gap: Spacing.half },
  participantActions: { flexDirection: 'row', gap: Spacing.three },
});
