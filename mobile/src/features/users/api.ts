import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api';

import type { AdminDomain, Role, UserRow } from './types';

/** GET /api/v1/users (SUPERADMIN-only, src/app/api/v1/users/route.ts). */
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiRequest<{ users: UserRow[] }>('/api/v1/users'),
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['users'] });
}

/** PATCH /api/v1/users/[id]/role - updateUserRoleAction (throws a plain Error for business-rule violations, mapped to 400 by the route - see docs/MOBILE_API.md). */
export function useUpdateUserRole() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      apiRequest<{ success: true }>(`/api/v1/users/${id}/role`, { method: 'PATCH', body: { role } }),
    onSuccess: () => invalidate(),
  });
}

/** PATCH /api/v1/users/[id]/domains - updateUserDomainsAction. */
export function useUpdateUserDomains() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, domains }: { id: string; domains: AdminDomain[] }) =>
      apiRequest<{ success: true }>(`/api/v1/users/${id}/domains`, { method: 'PATCH', body: { domains } }),
    onSuccess: () => invalidate(),
  });
}
