import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { apiRequest } from '@/lib/api';
import { clearSession, loadSession, saveSession, type StoredSession } from '@/lib/session-storage';

// Completes the in-flight auth session when the app is re-opened via the
// redirect URI (setclub://) after the system browser hands control back -
// required once per app, at module scope, per expo-auth-session's own setup.
WebBrowser.maybeCompleteAuthSession();

// Standard Google OAuth/OIDC endpoints (not the deprecated
// expo-auth-session/providers/google wrapper - that, and the Expo auth
// proxy, are gone; this is the generic AuthRequest + PKCE "native app" flow
// Google's own docs recommend for installed apps: no client secret, code
// exchanged directly against Google's token endpoint from the device).
const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

// An "iOS" or "Android" OAuth client in the same Google Cloud project as the
// web app's AUTH_GOOGLE_ID (see docs/MOBILE_APP.md) - those client types are
// public/PKCE-capable with no secret, unlike "Web application" clients.
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

type AuthContextValue = {
  session: StoredSession | null;
  isLoading: boolean;
  isSigningIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    loadSession().then((stored) => {
      setSession(stored);
      setIsLoading(false);
    });
  }, []);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'setclub' });

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID ?? '',
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    GOOGLE_DISCOVERY,
  );

  const signIn = useCallback(async function signIn() {
    if (!GOOGLE_CLIENT_ID) {
      throw new Error('EXPO_PUBLIC_GOOGLE_CLIENT_ID не налаштовано — див. docs/MOBILE_APP.md');
    }
    setIsSigningIn(true);
    try {
      const result = await promptAsync();
      if (result.type === 'error') {
        throw new Error(result.error?.message ?? 'Не вдалося увійти через Google');
      }
      if (result.type !== 'success' || !result.params.code) {
        return; // user cancelled the browser sheet
      }
      if (!request?.codeVerifier) {
        throw new Error('Не вдалося сформувати запит автентифікації — спробуйте ще раз');
      }

      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: GOOGLE_CLIENT_ID,
          code: result.params.code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier },
        },
        GOOGLE_DISCOVERY,
      );
      if (!tokenResponse.idToken) {
        throw new Error('Google не повернув ID-токен');
      }

      // POST /api/v1/auth/google (src/app/api/v1/auth/google/route.ts) -
      // verifies the ID token server-side, finds/creates User+Account, mints
      // a Session row, returns it as JSON (no cookie) - see docs/MOBILE_API.md.
      const newSession = await apiRequest<StoredSession>('/api/v1/auth/google', {
        method: 'POST',
        body: { idToken: tokenResponse.idToken },
        skipAuth: true,
      });
      await saveSession(newSession);
      setSession(newSession);
    } finally {
      setIsSigningIn(false);
    }
  }, [promptAsync, request, redirectUri]);

  const signOut = useCallback(async function signOut() {
    try {
      await apiRequest('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Best-effort, same as the web's signOutAction isn't - but here a
      // failed server-side session delete shouldn't block the local sign-out
      // the user is looking at right now.
    }
    await clearSession();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, isLoading, isSigningIn, signIn, signOut }),
    [session, isLoading, isSigningIn, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
