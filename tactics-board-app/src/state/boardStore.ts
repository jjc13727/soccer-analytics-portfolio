import { create } from "zustand";
import { FORMATION_TEMPLATES, POSITION_COORDS } from "../data/positions";
import { shortDisplayName, surnameOnly } from "../data/nameFormat";
import type { BoardToken, ClubSquad, ClubSquadPlayer, MatchEvent, NormalizedMatch, Side, TeamMeta } from "../data/types";

const HOME_COLOR = "#e11d3f";
const AWAY_COLOR = "#2f6fed";

function mirrorX(x: number): number {
  return 100 - x;
}

// StatsBomb's "nickname" field is the player's common/known-as name (e.g. "Lionel
// Messi" for "Lionel Andrés Messi Cuccittini"), which is what a stat sheet or
// FotMob-style label should be built from rather than the full legal name. It only
// lives in the squads list, so callers displaying a name elsewhere (formation
// lineup, substitution event) need to look it up by player id.
export function getNickname(match: NormalizedMatch | null, playerId: number | null): string | null {
  if (!match || playerId == null) return null;
  for (const squad of Object.values(match.squads)) {
    const found = squad.find((p) => p.player_id === playerId);
    if (found) return found.nickname;
  }
  return null;
}

function tokensFromFormation(
  match: NormalizedMatch,
  side: Side
): { tokens: BoardToken[]; meta: TeamMeta } {
  const team = side === "home" ? match.home_team : match.away_team;
  const formation = match.formations[String(team.id)];
  const color = side === "home" ? HOME_COLOR : AWAY_COLOR;

  const tokens: BoardToken[] = (formation?.starting ?? []).map((p) => {
    const coord = POSITION_COORDS[p.position_id] ?? { x: 50, y: 50 };
    const nickname = getNickname(match, p.player_id);
    return {
      id: `real-${p.player_id}`,
      side,
      name: p.name,
      shortName: surnameOnly(p.name, nickname),
      jerseyNumber: p.jersey_number,
      positionName: p.position_name,
      x: side === "home" ? coord.x : mirrorX(coord.x),
      y: coord.y,
      playerId: p.player_id,
    };
  });

  return {
    tokens,
    meta: {
      side,
      teamId: team.id,
      name: team.name,
      color,
      formationCode: formation?.formation != null ? String(formation.formation) : null,
    },
  };
}

function blankTokens(side: Side, teamName: string, formationKey: string): BoardToken[] {
  const template = FORMATION_TEMPLATES[formationKey] ?? FORMATION_TEMPLATES["4-4-2"];
  return template.map((positionId, i) => {
    const coord = POSITION_COORDS[positionId] ?? { x: 50, y: 50 };
    return {
      id: `${side}-blank-${i}`,
      side,
      name: `${teamName} #${i + 1}`,
      shortName: `P${i + 1}`,
      jerseyNumber: i + 1,
      positionName: null,
      x: side === "home" ? coord.x : mirrorX(coord.x),
      y: coord.y,
      playerId: null,
    };
  });
}

const POSITION_PRIORITY: Record<ClubSquadPlayer["position"], number> = { GK: 0, DF: 1, MF: 2, FW: 3 };

// Builds a starting XI + bench from a real current squad list. There's no free
// source for an actual "confirmed lineup," so this is a heuristic: goalkeeper(s)
// first, then outfield players in the squad list's own order, filling the chosen
// formation's slots -- a starting point the user is expected to drag into what
// they actually think will play, not a prediction.
function squadTokens(
  side: Side,
  squad: ClubSquad,
  formationKey: string
): { tokens: BoardToken[]; bench: ClubSquadPlayer[] } {
  const template = FORMATION_TEMPLATES[formationKey] ?? FORMATION_TEMPLATES["4-3-3"];
  const sorted = [...squad.players].sort((a, b) => POSITION_PRIORITY[a.position] - POSITION_PRIORITY[b.position]);
  const starters = sorted.slice(0, 11);
  const bench = sorted.slice(11);

  const tokens: BoardToken[] = starters.map((p, i) => {
    const positionId = template[i] ?? template[template.length - 1];
    const coord = POSITION_COORDS[positionId] ?? { x: 50, y: 50 };
    return {
      id: `squad-${side}-${p.number ?? i}-${p.name}`,
      side,
      name: p.name,
      shortName: surnameOnly(p.name, p.nickname),
      jerseyNumber: p.number,
      positionName: null,
      x: side === "home" ? coord.x : mirrorX(coord.x),
      y: coord.y,
      playerId: null,
    };
  });

  return { tokens, bench };
}

export interface PlayerStatLine {
  playerId: number;
  name: string;
  side: Side;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
}

interface BoardState {
  match: NormalizedMatch | null;
  tokens: BoardToken[];
  homeMeta: TeamMeta;
  awayMeta: TeamMeta;

  // replay
  eventCursor: number; // -1 = kickoff, before any event
  playing: boolean;

  // custom-board editing UI state
  addTokenSide: Side | null;
  setAddTokenSide: (side: Side | null) => void;
  selectedTokenId: string | null;
  selectToken: (id: string | null) => void;

  // club squads (separate from historical matches / blank custom boards)
  homeBench: ClubSquadPlayer[];
  awayBench: ClubSquadPlayer[];
  loadClubSquad: (side: Side, squad: ClubSquad, formationKey: string) => void;
  // Puts a bench player onto the pitch: replaces the currently-selected token on
  // that side if there is one (keeping its position), otherwise adds them as a new
  // token near the touchline for the user to drag into place.
  bringOnFromBench: (side: Side, player: ClubSquadPlayer) => void;

  // actions: match loading
  loadMatch: (match: NormalizedMatch) => void;
  newBlankBoard: (homeFormation: string, awayFormation: string, homeName: string, awayName: string) => void;

  // actions: board editing
  moveToken: (id: string, x: number, y: number) => void;
  renameToken: (id: string, name: string) => void;
  setJersey: (id: string, jerseyNumber: number | null) => void;
  removeToken: (id: string) => void;
  addToken: (side: Side, x: number, y: number) => void;
  applyFormationTemplate: (side: Side, formationKey: string) => void;
  resetToKickoff: () => void;

  // actions: replay
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBack: () => void;
  seek: (index: number) => void;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  match: null,
  tokens: [],
  homeMeta: { side: "home", teamId: null, name: "Home", color: HOME_COLOR, formationCode: null },
  awayMeta: { side: "away", teamId: null, name: "Away", color: AWAY_COLOR, formationCode: null },
  eventCursor: -1,
  playing: false,

  addTokenSide: null,
  setAddTokenSide: (side) => set({ addTokenSide: side }),
  selectedTokenId: null,
  selectToken: (id) => set({ selectedTokenId: id }),

  homeBench: [],
  awayBench: [],

  loadClubSquad: (side, squad, formationKey) =>
    set((s) => {
      const { tokens: newTokens, bench } = squadTokens(side, squad, formationKey);
      const meta: TeamMeta = {
        side,
        teamId: null,
        name: squad.club,
        color: side === "home" ? HOME_COLOR : AWAY_COLOR,
        formationCode: formationKey,
      };
      return {
        match: null,
        tokens: [...s.tokens.filter((t) => t.side !== side), ...newTokens],
        homeMeta: side === "home" ? meta : s.homeMeta,
        awayMeta: side === "away" ? meta : s.awayMeta,
        homeBench: side === "home" ? bench : s.homeBench,
        awayBench: side === "away" ? bench : s.awayBench,
        eventCursor: -1,
        playing: false,
        selectedTokenId: null,
      };
    }),

  bringOnFromBench: (side, player) =>
    set((s) => {
      const bench = side === "home" ? s.homeBench : s.awayBench;
      const nextBench = bench.filter((p) => p !== player);
      const benchKey = side === "home" ? "homeBench" : "awayBench";

      const selected = s.tokens.find((t) => t.id === s.selectedTokenId && t.side === side);
      const newToken: BoardToken = {
        id: selected?.id ?? `squad-${side}-bench-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        side,
        name: player.name,
        shortName: surnameOnly(player.name, player.nickname),
        jerseyNumber: player.number,
        positionName: null,
        x: selected?.x ?? (side === "home" ? 50 : 50),
        y: selected?.y ?? 95,
        playerId: null,
      };

      const tokens = selected
        ? s.tokens.map((t) => (t.id === selected.id ? newToken : t))
        : [...s.tokens, newToken];

      return { tokens, [benchKey]: nextBench, selectedTokenId: null };
    }),

  loadMatch: (match) => {
    const home = tokensFromFormation(match, "home");
    const away = tokensFromFormation(match, "away");
    set({
      match,
      tokens: [...home.tokens, ...away.tokens],
      homeMeta: home.meta,
      awayMeta: away.meta,
      homeBench: [],
      awayBench: [],
      eventCursor: -1,
      playing: false,
    });
  },

  newBlankBoard: (homeFormation, awayFormation, homeName, awayName) => {
    const homeTokens = blankTokens("home", homeName, homeFormation);
    const awayTokens = blankTokens("away", awayName, awayFormation);
    set({
      match: null,
      tokens: [...homeTokens, ...awayTokens],
      homeMeta: { side: "home", teamId: null, name: homeName, color: HOME_COLOR, formationCode: homeFormation },
      awayMeta: { side: "away", teamId: null, name: awayName, color: AWAY_COLOR, formationCode: awayFormation },
      homeBench: [],
      awayBench: [],
      eventCursor: -1,
      playing: false,
    });
  },

  moveToken: (id, x, y) =>
    set((s) => ({
      tokens: s.tokens.map((t) =>
        t.id === id ? { ...t, x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) } : t
      ),
    })),

  renameToken: (id, name) =>
    set((s) => ({
      tokens: s.tokens.map((t) => (t.id === id ? { ...t, name, shortName: surnameOnly(name) } : t)),
    })),

  setJersey: (id, jerseyNumber) =>
    set((s) => ({ tokens: s.tokens.map((t) => (t.id === id ? { ...t, jerseyNumber } : t)) })),

  removeToken: (id) => set((s) => ({ tokens: s.tokens.filter((t) => t.id !== id) })),

  addToken: (side, x, y) =>
    set((s) => {
      const meta = side === "home" ? s.homeMeta : s.awayMeta;
      const n = s.tokens.filter((t) => t.side === side).length + 1;
      const token: BoardToken = {
        id: `${side}-extra-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        side,
        name: `${meta.name} #${n}`,
        shortName: `P${n}`,
        jerseyNumber: null,
        positionName: null,
        x,
        y,
        playerId: null,
      };
      return { tokens: [...s.tokens, token] };
    }),

  applyFormationTemplate: (side, formationKey) =>
    set((s) => {
      const meta = side === "home" ? s.homeMeta : s.awayMeta;
      const template = FORMATION_TEMPLATES[formationKey] ?? FORMATION_TEMPLATES["4-4-2"];
      const existing = s.tokens.filter((t) => t.side === side);
      const rest = s.tokens.filter((t) => t.side !== side);
      const remapped = existing.slice(0, 11).map((t, i) => {
        const coord = POSITION_COORDS[template[i] ?? template[template.length - 1]] ?? { x: 50, y: 50 };
        return { ...t, x: side === "home" ? coord.x : mirrorX(coord.x), y: coord.y };
      });
      const updatedMeta =
        side === "home" ? { homeMeta: { ...meta, formationCode: formationKey } } : { awayMeta: { ...meta, formationCode: formationKey } };
      return { tokens: [...rest, ...remapped], ...updatedMeta };
    }),

  resetToKickoff: () => {
    const { match } = get();
    if (match) get().loadMatch(match);
  },

  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),

  stepForward: () =>
    set((s) => {
      const max = (s.match?.events.length ?? 0) - 1;
      const next = Math.min(max, s.eventCursor + 1);
      return applyEventCursor(s, next);
    }),

  stepBack: () =>
    set((s) => {
      const next = Math.max(-1, s.eventCursor - 1);
      return applyEventCursor(s, next);
    }),

  seek: (index) =>
    set((s) => {
      const max = (s.match?.events.length ?? 0) - 1;
      const next = Math.min(max, Math.max(-1, index));
      return applyEventCursor(s, next);
    }),

}));

// --- Pure derived-data helpers -----------------------------------------------------
// Deliberately NOT store methods: a zustand selector must return a referentially
// stable value across renders unless the underlying state changed, and a selector
// like `s => s.scoreline()` that builds a fresh object every call breaks that
// contract and causes an infinite render loop. Components should compute these
// with `useMemo(() => computeX(match, eventCursor), [match, eventCursor])` instead.

export function currentEvents(match: NormalizedMatch | null, eventCursor: number): MatchEvent[] {
  if (!match) return [];
  return match.events.slice(0, eventCursor + 1);
}

export function computeScoreline(
  match: NormalizedMatch | null,
  eventCursor: number
): { home: number; away: number } {
  if (!match) return { home: 0, away: 0 };
  let home = 0;
  let away = 0;
  for (const e of currentEvents(match, eventCursor)) {
    if (e.type === "goal" || e.type === "own_goal") {
      if (e.team_id === match.home_team.id) home++;
      else if (e.team_id === match.away_team.id) away++;
    }
  }
  return { home, away };
}

export function computePlayerStats(match: NormalizedMatch | null, eventCursor: number): PlayerStatLine[] {
  if (!match) return [];
  const stats = new Map<number, PlayerStatLine>();

  const ensure = (id: number, fullName: string, teamId: number) => {
    if (!stats.has(id)) {
      const side: Side = teamId === match.home_team.id ? "home" : "away";
      const name = shortDisplayName(fullName, getNickname(match, id));
      stats.set(id, { playerId: id, name, side, goals: 0, assists: 0, yellow: 0, red: 0 });
    }
    return stats.get(id)!;
  };

  for (const e of currentEvents(match, eventCursor)) {
    if (e.type === "goal") {
      ensure(e.player_id, e.player_name, e.team_id).goals++;
      if (e.assist_player_id && e.assist_player_name) {
        ensure(e.assist_player_id, e.assist_player_name, e.team_id).assists++;
      }
    } else if (e.type === "card") {
      const line = ensure(e.player_id, e.player_name, e.team_id);
      if (e.card === "Red Card") line.red++;
      else if (e.card === "Second Yellow") {
        line.yellow++;
        line.red++;
      } else line.yellow++;
    }
  }

  return [...stats.values()].sort((a, b) => b.goals - a.goals || b.assists - a.assists);
}

export interface SquadEntry {
  playerId: number;
  name: string;
  jerseyNumber: number | null;
  positionName: string | null;
}

export interface SubEntry extends SquadEntry {
  onMinute: number;
  replacedName: string;
}

export interface TeamSquadInfo {
  side: Side;
  teamName: string;
  manager: string | null;
  startingXI: SquadEntry[];
  subsUsed: SubEntry[];
  unusedBench: SquadEntry[];
}

export function computeSquadInfo(match: NormalizedMatch | null): TeamSquadInfo[] {
  if (!match) return [];

  return (["home", "away"] as const).map((side) => {
    const team = side === "home" ? match.home_team : match.away_team;
    const manager = side === "home" ? match.home_manager : match.away_manager;
    const formation = match.formations[String(team.id)];
    const squad = match.squads[String(team.id)] ?? [];

    const startingXI: SquadEntry[] = (formation?.starting ?? []).map((p) => ({
      playerId: p.player_id,
      name: shortDisplayName(p.name, getNickname(match, p.player_id)),
      jerseyNumber: p.jersey_number,
      positionName: p.position_name,
    }));

    const subEvents = match.events.filter(
      (e): e is Extract<MatchEvent, { type: "sub" }> => e.type === "sub" && e.team_id === team.id
    );
    const subsUsed: SubEntry[] = subEvents
      .filter((e) => e.player_on_id != null && e.player_on_name)
      .map((e) => ({
        playerId: e.player_on_id!,
        name: shortDisplayName(e.player_on_name!, getNickname(match, e.player_on_id)),
        jerseyNumber: squad.find((p) => p.player_id === e.player_on_id)?.jersey_number ?? null,
        positionName: null,
        onMinute: e.minute,
        replacedName: shortDisplayName(e.player_off_name, getNickname(match, e.player_off_id)),
      }));

    const usedIds = new Set([...startingXI.map((p) => p.playerId), ...subsUsed.map((p) => p.playerId)]);
    const unusedBench: SquadEntry[] = squad
      .filter((p) => !usedIds.has(p.player_id))
      .map((p) => ({
        playerId: p.player_id,
        name: shortDisplayName(p.name, p.nickname),
        jerseyNumber: p.jersey_number,
        positionName: null,
      }));

    return { side, teamName: team.name, manager, startingXI, subsUsed, unusedBench };
  });
}

function applyEventCursor(
  s: BoardState,
  nextCursor: number
): Partial<BoardState> {
  if (!s.match) return { eventCursor: nextCursor };

  // Re-derive starting tokens, then apply every substitution up to nextCursor so
  // positions on the board always reflect "who is on the pitch right now."
  const home = tokensFromFormation(s.match, "home");
  const away = tokensFromFormation(s.match, "away");
  let tokens = [...home.tokens, ...away.tokens];

  const eventsUpToCursor = s.match.events.slice(0, nextCursor + 1);
  for (const e of eventsUpToCursor) {
    if (e.type === "sub") {
      const nickname = getNickname(s.match, e.player_on_id);
      tokens = tokens.map((t) => {
        if (t.playerId === e.player_off_id) {
          return {
            ...t,
            playerId: e.player_on_id,
            name: e.player_on_name ?? "Substitute",
            shortName: e.player_on_name ? surnameOnly(e.player_on_name, nickname) : "SUB",
            isSub: true,
          };
        }
        return t;
      });
    }
  }

  return { eventCursor: nextCursor, tokens, playing: nextCursor >= s.match.events.length - 1 ? false : s.playing };
}
