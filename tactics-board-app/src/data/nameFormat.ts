// StatsBomb full names are legal names (e.g. "Lionel Andrés Messi Cuccittini"),
// which is not how any stat sheet, broadcast graphic, or site like FotMob displays
// a player. This turns a full name (+ optional common "nickname" StatsBomb also
// provides, e.g. "Lionel Messi") into the short form those sites use:
//   - a nickname that's already a single word ("Neymar") is used as-is
//   - otherwise: first initial + last word ("L. Messi", "V. Junior")
export function shortDisplayName(fullName: string, nickname?: string | null): string {
  const source = (nickname && nickname.trim()) || fullName;
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fullName;
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first[0]}. ${last}`;
}

// Same idea but returns just the surname/mononym, for tight spaces (jersey token label).
export function surnameOnly(fullName: string, nickname?: string | null): string {
  const source = (nickname && nickname.trim()) || fullName;
  const parts = source.trim().split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? fullName;
}

// 1-2 letter initials for a team badge, e.g. "Manchester City" -> "MC", "Barcelona" -> "BA".
export function teamInitials(teamName: string): string {
  const words = teamName.trim().split(/\s+/).filter((w) => w.length > 1 || /[A-Za-z]/.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return teamName.slice(0, 2).toUpperCase();
}
