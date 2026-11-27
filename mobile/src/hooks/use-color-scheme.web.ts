import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

// Nothing to subscribe to: "has hydrated" flips once, from the server snapshot to the client one.
const subscribeNever = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * useSyncExternalStore renders 'light' for the static HTML and during hydration (server snapshot),
 * then the real scheme - without a setState inside an effect.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(subscribeNever, getClientSnapshot, getServerSnapshot);
  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
