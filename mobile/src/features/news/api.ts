import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';

import type { NewsPost, NewsPostSubmitInput } from './types';

/** Mirrors GET /api/v1/news. */
export function useNewsPosts(query?: string) {
  return useQuery({
    queryKey: ['news', { query }],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '30' });
      if (query) params.set('q', query);
      return apiRequest<{ posts: NewsPost[]; total: number }>(`/api/v1/news?${params.toString()}`);
    },
  });
}

/** Mirrors GET /api/v1/news/[id]. */
export function useNewsPost(id: string) {
  return useQuery({
    queryKey: ['news', id],
    queryFn: () => apiRequest<{ post: NewsPost }>(`/api/v1/news/${id}`),
    enabled: Boolean(id),
  });
}

function useInvalidateNews() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['news'] });
    if (id) queryClient.invalidateQueries({ queryKey: ['news', id] });
  };
}

/** POST /api/v1/news - createNewsPostCore. `photoKey` (already uploaded via uploadPhotoToR2 against /api/news/photo-presign) must start with "news/", checked server-side. */
export function useCreateNewsPost() {
  const invalidate = useInvalidateNews();
  return useMutation({
    mutationFn: (data: NewsPostSubmitInput) =>
      apiRequest<{ success: true }>('/api/v1/news', { method: 'POST', body: data }),
    onSuccess: () => invalidate(),
  });
}

/** PATCH /api/v1/news/[id] - updateNewsPostCore. */
export function useUpdateNewsPost(id: string) {
  const invalidate = useInvalidateNews();
  return useMutation({
    mutationFn: (data: NewsPostSubmitInput) =>
      apiRequest<{ success: true }>(`/api/v1/news/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () => invalidate(id),
  });
}

/** DELETE /api/v1/news/[id] - deleteNewsPostCore. */
export function useDeleteNewsPost(id: string) {
  const invalidate = useInvalidateNews();
  return useMutation({
    mutationFn: () => apiRequest<{ success: true }>(`/api/v1/news/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
  });
}
