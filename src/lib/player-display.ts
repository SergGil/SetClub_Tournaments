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

type GenderedPlayer = { gender?: "MALE" | "FEMALE" | null };

/**
 * "Знявся"/"Знялась з матчу" for the side that actually conceded a `retired`
 * match - agreeing with the player's recorded gender when the side is a
 * single known player. A doubles pair or an unknown gender falls back to the
 * masculine form, the same generic default used everywhere else gender isn't
 * tracked (e.g. GENDER_LABEL leaves it unset rather than guessing).
 */
export function retiredLabel(retiringSide: GenderedPlayer[]): string {
  if (retiringSide.length === 1 && retiringSide[0].gender === "FEMALE") return "Знялась з матчу";
  return "Знявся з матчу";
}

/** "переміг"/"перемогла" for the winning side, agreeing with gender the same way retiredLabel does - a doubles pair or unknown gender falls back to the masculine/generic form. */
export function wonVerb(winningSide: GenderedPlayer[]): string {
  if (winningSide.length === 1 && winningSide[0].gender === "FEMALE") return "перемогла";
  return "переміг";
}
