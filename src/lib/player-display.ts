type NamedPlayer = { name: string; nickname?: string | null };

/** Nickname if set, else the real name - the default everywhere in public UI. */
export function displayName(player: NamedPlayer): string {
  return player.nickname?.trim() ? player.nickname : player.name;
}

/**
 * "Name (Nickname)" if a nickname is set, else just the name - the player's
 * own profile header and admin "pickers" (score entry, match creation,
 * roster, randomizer previews) where mixing up two players matters more
 * than the nickname-only look everywhere else.
 */
export function fullDisplayName(player: NamedPlayer): string {
  return player.nickname?.trim() ? `${player.name} (${player.nickname})` : player.name;
}

/**
 * "Прізвище І." from a "Прізвище Ім'я"-shaped name - a compact per-player
 * label for a roster list where full names would crowd the layout (e.g. a
 * team's member list next to its name in the team-tie standings table).
 * Falls back to the display name unchanged when it's a single word (a
 * nickname, or a name entered with no separate first name - e.g.
 * "Пляшечник"/"Соколов" show up in the roster this way).
 */
export function abbreviatedName(player: NamedPlayer): string {
  const name = displayName(player);
  const [lastName, firstName] = name.trim().split(/\s+/);
  return firstName ? `${lastName} ${firstName[0]}.` : name;
}

/**
 * A doubles pair's players with the seeded one first, so a pair always reads
 * "сіяний / несіяний". Stable: a pair with no seed (or two seeds) keeps its
 * incoming order, so this is safe to apply to any list of players.
 */
export function seededFirst<T extends { playerId: string }>(players: T[], seededIds: ReadonlySet<string>): T[] {
  return [...players].sort((a, b) => Number(seededIds.has(b.playerId)) - Number(seededIds.has(a.playerId)));
}

/**
 * `seededFirst` for a match's flat `players` list (both sides together): each
 * side's players are reordered seeded-first among the slots that side already
 * occupied, so nobody changes side and the A/B blocks keep their positions -
 * code that reads `players[0]`/`players[1]` of a singles match sees no change.
 */
export function seededFirstPerSide<T extends { side: string; playerId: string }>(
  players: T[],
  seededIds: ReadonlySet<string>,
): T[] {
  const result = [...players];
  for (const side of new Set(players.map((p) => p.side))) {
    const slots = players.flatMap((p, i) => (p.side === side ? [i] : []));
    const ordered = seededFirst(
      slots.map((i) => players[i]),
      seededIds,
    );
    slots.forEach((slot, k) => {
      result[slot] = ordered[k];
    });
  }
  return result;
}

type GenderedPlayer = { gender?: "MALE" | "FEMALE" | null };

/**
 * "Знявся"/"Знялась з матчу" for the side that actually conceded a `retired`
 * match - agreeing with the player's recorded gender when the side is a
 * single player, with an unknown gender falling back to the masculine form
 * (the same generic default used everywhere else gender isn't tracked, e.g.
 * GENDER_LABEL leaves it unset rather than guessing). A doubles pair retires
 * together, so it gets the plural "Знялися з матчу" - same rule as wonVerb.
 */
export function retiredLabel(retiringSide: GenderedPlayer[]): string {
  if (retiringSide.length > 1) return "Знялися з матчу";
  if (retiringSide[0]?.gender === "FEMALE") return "Знялась з матчу";
  return "Знявся з матчу";
}

/** "переміг"/"перемогла" for a single winner, agreeing with their recorded gender (unknown -> masculine), and plural "перемогли" for a doubles pair ("Іван / Петро перемогли ..." - the subject is two people, whatever their genders). */
export function wonVerb(winningSide: GenderedPlayer[]): string {
  if (winningSide.length > 1) return "перемогли";
  if (winningSide[0]?.gender === "FEMALE") return "перемогла";
  return "переміг";
}
