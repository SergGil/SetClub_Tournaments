export type NamedPlayer = { playerId: string; name: string };
export type NamedTeam = { playerIds: [string, string]; names: [string, string] };
export type NamedMatchup = { sideA: NamedTeam; sideB: NamedTeam };

/** Mirrors CommitState (src/lib/actions/match-randomize-shared.ts). */
export type CommitResult = { error?: string; success?: boolean; matchCount?: number };

/** Mirrors DrawState (src/lib/actions/randomize-doubles.ts) - doubles team draw preview. */
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
