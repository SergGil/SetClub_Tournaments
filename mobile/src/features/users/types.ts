export type Role = 'SUPERADMIN' | 'ADMIN' | 'MEMBER';
export type AdminDomain = 'TENNIS' | 'COFFEE' | 'PADEL';

/** Mirrors getUsers' select (src/lib/queries/users.ts). */
export type UserRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: Role;
  createdAt: string;
  adminDomains: { domain: AdminDomain }[];
};
