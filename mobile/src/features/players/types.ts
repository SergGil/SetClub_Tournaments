/** Which sport(s) a member plays - Player.sports (prisma/schema.prisma), shown/filtered by the web roster pickers and lists. */
export type PlayerSport = 'TENNIS' | 'PADEL' | 'BOTH';

export type Player = {
  id: string;
  name: string;
  nickname: string | null;
  email: string | null;
  gender: 'MALE' | 'FEMALE' | null;
  sports: PlayerSport;
};

/** playerFormSchema's shape (src/lib/validation/player.ts). */
export type PlayerFormInput = {
  name: string;
  email: string;
  gender: 'MALE' | 'FEMALE' | '';
  sports: PlayerSport;
  nickname: string;
};

/** Mirrors Achievement in src/lib/achievements.ts - see docs/ACHIEVEMENTS.md. `id` is a plain string: the finalist/champion ids are generated per sport/format/women's scope (16 of them), and the app only uses it as a list key. */
export type Achievement = {
  id: string;
  label: string;
  description: string;
  earned: boolean;
  /** Custom earned-state icon; absent = the default trophy. */
  icon?: 'moon-ball';
  earnedAt?: string;
};
