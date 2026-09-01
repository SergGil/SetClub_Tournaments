import { Redirect } from 'expo-router';

// Browsing is public (mirrors the web app - /tournaments etc. need no
// sign-in), so this just points "/" at the tabs; the Profile tab is where
// sign-in/out and role-gated admin visibility live (see auth-context.tsx).
export default function Index() {
  return <Redirect href="/(tabs)/tournaments" />;
}
