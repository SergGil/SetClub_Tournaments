import * as SecureStore from 'expo-secure-store';

export type StoredUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: 'SUPERADMIN' | 'ADMIN' | 'MEMBER';
  domains: ('TENNIS' | 'COFFEE' | 'PADEL')[];
};

export type StoredSession = {
  sessionToken: string;
  expires: string;
  user: StoredUser;
};

const KEY = 'setclub.session';

/**
 * expo-secure-store backs onto Keychain (iOS) / Keystore-encrypted SharedPreferences
 * (Android) - the same role a browser's httpOnly cookie plays for the web app's
 * database session (src/lib/auth.ts), just readable by JS since a native app has
 * no cross-origin script-injection surface to guard against the way a cookie does.
 */
export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
