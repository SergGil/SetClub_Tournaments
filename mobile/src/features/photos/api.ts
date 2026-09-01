import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';
import { uploadPhotoToR2 } from '@/lib/photo-upload';
import { useSport } from '@/lib/sport-context';

import type { Photo } from './types';

/** GET /api/v1/tournaments/[id]/photos (and its padel twin). */
export function useTournamentPhotos(tournamentId: string) {
  const { sport } = useSport();
  const base = sport === 'tennis' ? '/api/v1/tournaments' : '/api/v1/padel/tournaments';
  return useQuery({
    queryKey: ['tournaments', sport, tournamentId, 'photos'],
    queryFn: () => apiRequest<{ photos: Photo[] }>(`${base}/${tournamentId}/photos`),
    enabled: Boolean(tournamentId),
  });
}

/**
 * Full presign -> PUT -> confirm flow for a tournament photo (see
 * src/lib/photo-upload.ts). Presigns against the sport's own existing
 * /api/{photos,padel-photos}/presign route (unchanged from the web), then
 * confirms via the already sport-aware /api/v1/.../photos route.
 */
export function useUploadTournamentPhoto(tournamentId: string) {
  const { sport } = useSport();
  const base = sport === 'tennis' ? '/api/v1/tournaments' : '/api/v1/padel/tournaments';
  const presignPath = sport === 'tennis' ? '/api/photos/presign' : '/api/padel-photos/presign';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      caption,
    }: {
      file: { uri: string; mimeType?: string | null; fileName?: string | null };
      caption?: string;
    }) => {
      const { key } = await uploadPhotoToR2(presignPath, { tournamentId }, file);
      return apiRequest<{ success: true } | { error: string }>(`${base}/${tournamentId}/photos`, {
        method: 'POST',
        body: { key, caption },
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournaments', sport, tournamentId, 'photos'] }),
  });
}

/** DELETE /api/v1/tournaments/[id]/photos/[photoId]. */
export function useDeleteTournamentPhoto(tournamentId: string) {
  const { sport } = useSport();
  const base = sport === 'tennis' ? '/api/v1/tournaments' : '/api/v1/padel/tournaments';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) =>
      apiRequest<{ success: true } | { error: string }>(`${base}/${tournamentId}/photos/${photoId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournaments', sport, tournamentId, 'photos'] }),
  });
}
