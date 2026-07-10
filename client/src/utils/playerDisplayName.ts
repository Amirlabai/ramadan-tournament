/** Display nickname: empty nickname falls back to last name. */
export function displayNickname(player: {
  nickname?: string | null;
  lastName?: string | null;
}): string {
  const nick = (player.nickname ?? '').trim();
  if (nick) return nick;
  return (player.lastName ?? '').trim();
}

export function fullName(player: {
  firstName?: string | null;
  lastName?: string | null;
}): string {
  return `${(player.firstName ?? '').trim()} ${(player.lastName ?? '').trim()}`.trim();
}
