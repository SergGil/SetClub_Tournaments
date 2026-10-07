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

/** Mirrors Achievement in src/lib/achievements.ts - see docs/ACHIEVEMENTS.md. `id` is a plain string: the finalist/champion ids are generated per sport/format/women's scope (12 of them), and the app only uses it as a list key. */
export type Achievement = {
  id: string;
  label: string;
  description: string;
  earned: boolean;
  /** Custom earned-state icon; absent = the default trophy. */
  icon?: 'moon-ball';
  earnedAt?: string;
};
