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
