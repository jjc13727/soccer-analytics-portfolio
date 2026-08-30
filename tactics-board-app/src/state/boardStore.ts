import { create } from "zustand";
import { FORMATION_TEMPLATES, POSITION_COORDS } from "../data/positions";
import type { BoardToken, MatchEvent, NormalizedMatch, Side, TeamMeta } from "../data/types";

const HOME_COLOR = "#e11d3f";
const AWAY_COLOR = "#2f6fed";

function mirrorX(x: number): number {
  return 100 - x;
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts[parts.length - 1];
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
    return {
      id: `real-${p.player_id}`,
      side,
      name: p.name,
      shortName: shortName(p.name),
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

  loadMatch: (match) => {
    const home = tokensFromFormation(match, "home");
    const away = tokensFromFormation(match, "away");
    set({
      match,
      tokens: [...home.tokens, ...away.tokens],
      homeMeta: home.meta,
      awayMeta: away.meta,
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
      tokens: s.tokens.map((t) => (t.id === id ? { ...t, name, shortName: shortName(name) } : t)),
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

  const ensure = (id: number, name: string, teamId: number) => {
    if (!stats.has(id)) {
      const side: Side = teamId === match.home_team.id ? "home" : "away";
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
      tokens = tokens.map((t) => {
        if (t.playerId === e.player_off_id) {
          return {
            ...t,
            playerId: e.player_on_id,
            name: e.player_on_name ?? "Substitute",
            shortName: e.player_on_name ? shortName(e.player_on_name) : "SUB",
            isSub: true,
          };
        }
        return t;
      });
    }
  }

  return { eventCursor: nextCursor, tokens, playing: nextCursor >= s.match.events.length - 1 ? false : s.playing };
}
