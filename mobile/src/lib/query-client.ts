import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A slow/flaky mobile connection retrying 3x by default (react-query's
      // own default) makes every failed screen feel stuck for way too long -
      // one retry is enough before showing an error state.
      retry: 1,
      staleTime: 30_000,
    },
  },
});
