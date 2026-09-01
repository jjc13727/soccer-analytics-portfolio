// Shapes mirror the normalized JSON written by data-pipeline/fetch_statsbomb.py

export interface StartingPlayer {
  player_id: number;
  name: string;
  jersey_number: number | null;
  position_id: number;
  position_name: string;
}

export interface FormationInfo {
  formation: number | null; // e.g. 4231
  starting: StartingPlayer[];
}

export interface SquadPlayer {
  player_id: number;
  name: string;
  nickname: string | null;
  jersey_number: number | null;
  started: boolean;
}

export type MatchEvent =
  | {
      type: "goal";
      minute: number;
      second: number;
      team_id: number;
      player_id: number;
      player_name: string;
      assist_player_id: number | null;
      assist_player_name: string | null;
      xg: number | null;
    }
  | {
      type: "own_goal";
      minute: number;
      second: number;
      team_id: number;
      player_id: number;
      player_name: string;
    }
  | {
      type: "card";
      card: "Yellow Card" | "Red Card" | "Second Yellow";
      minute: number;
      second: number;
      team_id: number;
      player_id: number;
      player_name: string;
    }
  | {
      type: "sub";
      minute: number;
      second: number;
      team_id: number;
      player_off_id: number;
      player_off_name: string;
      player_on_id: number | null;
      player_on_name: string | null;
    };

export interface TeamRef {
  id: number;
  name: string;
}

export interface NormalizedMatch {
  match_id: number;
  date: string;
  kick_off: string;
  competition_id: number;
  competition_name: string;
  season_id: number;
  season_name: string;
  match_week: number | null;
  stadium: string | null;
  home_team: TeamRef;
  away_team: TeamRef;
  home_score: number;
  away_score: number;
  home_manager: string | null;
  away_manager: string | null;
  formations: Record<string, FormationInfo>;
  squads: Record<string, SquadPlayer[]>;
  events: MatchEvent[];
}

export interface MatchSummary {
  match_id: number;
  date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
}

export interface SeasonSummary {
  season_id: number;
  season_name: string;
  match_count: number;
  matches: MatchSummary[];
}

export interface CompetitionSummary {
  competition_id: number;
  competition_name: string;
  seasons: SeasonSummary[];
}

export interface DatasetIndex {
  generated_at: string;
  competitions: CompetitionSummary[];
}

// --- Board / tactics-board domain model (independent of match data) ---------------

export type Side = "home" | "away";

export interface BoardToken {
  id: string; // unique within board
  side: Side;
  name: string;
  shortName: string;
  jerseyNumber: number | null;
  positionName: string | null;
  x: number; // 0-100, percent of pitch width
  y: number; // 0-100, percent of pitch height
  playerId: number | null; // real player_id when sourced from match data
  isSub?: boolean;
}

export interface TeamMeta {
  side: Side;
  teamId: number | null;
  name: string;
  color: string;
  formationCode: string | null;
}

// --- Current-season club squads (separate feature from historical match data) -----

export type BroadPosition = "GK" | "DF" | "MF" | "FW";

export interface ClubSquadPlayer {
  number: number | null;
  name: string;
  nickname?: string | null;
  position: BroadPosition;
}

export interface ClubSquad {
  club: string;
  league: string;
  seasonLabel: string; // e.g. "2025-26" -- whatever season the source data reflects
  manager: string | null;
  source: string; // URL or description of where this was pulled from
  fetchedAt: string; // ISO date the data was pulled -- squads change, so age matters
  players: ClubSquadPlayer[];
}

export interface ClubSquadIndexEntry {
  slug: string;
  club: string;
  league: string;
}

export interface ClubSquadIndex {
  generated_at: string;
  clubs: ClubSquadIndexEntry[];
}
