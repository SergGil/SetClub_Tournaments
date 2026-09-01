export type Player = {
  id: string;
  name: string;
  nickname: string | null;
  email: string | null;
  gender: 'MALE' | 'FEMALE' | null;
};

/** playerFormSchema's shape (src/lib/validation/player.ts). */
export type PlayerFormInput = {
  name: string;
  email: string;
  gender: 'MALE' | 'FEMALE' | '';
  nickname: string;
};
