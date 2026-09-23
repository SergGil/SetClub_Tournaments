import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-viewer UI preference (not sensitive), so plain AsyncStorage rather
 * than expo-secure-store (reserved for the session token - see
 * session-storage.ts). Global, not per-player: hiding your own achievements
 * once hides them everywhere in the app, same as the web version's
 * localStorage-backed toggle (setclub:achievements-hidden in
 * player-achievements.tsx).
 */
const HIDE_STORAGE_KEY = 'setclub.achievements-hidden';

export async function readAchievementsHidden(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(HIDE_STORAGE_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function writeAchievementsHidden(hidden: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(HIDE_STORAGE_KEY, hidden ? '1' : '0');
  } catch {
    // Best-effort - the toggle still works for this screen visit, it just
    // won't be remembered next time.
  }
}
