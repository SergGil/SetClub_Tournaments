import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';

import type { MenuItemFormInput, MenuSection, MenuSectionFormInput } from './types';

/** GET /api/v1/menu?all=true (COFFEE admin, all sections/items incl. inactive - see docs/MOBILE_API.md). */
export function useMenuSections() {
  return useQuery({
    queryKey: ['menu'],
    queryFn: () => apiRequest<{ sections: MenuSection[] }>('/api/v1/menu?all=true'),
  });
}

function useInvalidateMenu() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['menu'] });
}

type Result = { success: true } | { error: string };

export function useCreateMenuSection() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: (data: MenuSectionFormInput) =>
      apiRequest<Result>('/api/v1/menu/sections', { method: 'POST', body: data }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateMenuSection(id: string) {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: (data: MenuSectionFormInput) =>
      apiRequest<Result>(`/api/v1/menu/sections/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () => invalidate(),
  });
}

export function useToggleMenuSectionActive() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest<Result>(`/api/v1/menu/sections/${id}/active`, { method: 'PATCH', body: { active } }),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteMenuSection() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: (id: string) => apiRequest<Result>(`/api/v1/menu/sections/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
  });
}

export function useCreateMenuItem() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: (data: MenuItemFormInput) => apiRequest<Result>('/api/v1/menu/items', { method: 'POST', body: data }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateMenuItem(id: string) {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: (data: MenuItemFormInput) =>
      apiRequest<Result>(`/api/v1/menu/items/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () => invalidate(),
  });
}

export function useToggleMenuItemActive() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiRequest<Result>(`/api/v1/menu/items/${id}/active`, { method: 'PATCH', body: { active } }),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteMenuItem() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: (id: string) => apiRequest<Result>(`/api/v1/menu/items/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
  });
}
