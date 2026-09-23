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

/** Mirrors Achievement in src/lib/achievements.ts - see docs/ACHIEVEMENTS.md. */
export type Achievement = {
  id: 'debut' | 'first-win' | 'streak-3' | 'streak-5' | 'finalist' | 'champion' | 'resident' | 'giant-killer';
  label: string;
  description: string;
  earned: boolean;
  earnedAt?: string;
};
