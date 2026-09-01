export type NamedPlayer = { playerId: string; name: string };
export type NamedTeam = { playerIds: [string, string]; names: [string, string] };
export type NamedMatchup = { sideA: NamedTeam; sideB: NamedTeam };
export type NamedGroup = { group: number; players: NamedPlayer[] };
export type NamedSinglesMatchup = { sideA: NamedPlayer; sideB: NamedPlayer; round: string };
export type NamedGroupedTeam = { playerIds: [string, string]; names: [string, string]; group: number };
export type NamedGroupedMatchup = { sideA: NamedGroupedTeam; sideB: NamedGroupedTeam; group: number };

/** Mirrors CommitState (src/lib/actions/match-randomize-shared.ts). */
export type CommitResult = { error?: string; success?: boolean; matchCount?: number };

/** Mirrors DrawState (src/lib/actions/randomize-doubles.ts) - plain doubles team draw preview. */
export type DoublesDrawState =
  | { ok: false; error: string }
  | {
      ok: true;
      fixedTeams: NamedTeam[];
      seededBasket: NamedPlayer[];
      unseededBasket: NamedPlayer[];
      randomTeams: NamedTeam[];
      matchups: NamedMatchup[];
      unpairedNames: string[];
    };

/** Mirrors SinglesGroupDrawState (src/lib/actions/randomize-singles.ts) - CUSTOM_GROUPS draw preview. */
export type SinglesGroupDrawState =
  | { ok: false; error: string }
  | {
      ok: true;
      existingGroups: NamedGroup[];
      revealOrder: NamedPlayer[];
      groupAssignment: Record<string, number>;
      matchups: NamedSinglesMatchup[];
    };

/** Mirrors Groups12PlayoffDrawState (src/lib/actions/randomize-singles-groups12.ts) - GROUPS_12_PLAYOFF draw preview. */
export type Groups12PlayoffDrawState =
  | { ok: false; error: string }
  | {
      ok: true;
      existingGroups: NamedGroup[];
      groupAssignment: Record<string, number>;
      revealOrder: NamedPlayer[];
      matchups: NamedSinglesMatchup[];
    };

/** Mirrors DoublesGroupDrawState (src/lib/actions/randomize-doubles.ts) - doubles "За групами" draw preview. */
export type DoublesGroupDrawState =
  | { ok: false; error: string }
  | {
      ok: true;
      groups: number[];
      fixedTeams: NamedGroupedTeam[];
      randomTeams: NamedGroupedTeam[];
      groupAssignment: Record<string, number>;
      matchups: NamedGroupedMatchup[];
      unpairedNames: string[];
    };
