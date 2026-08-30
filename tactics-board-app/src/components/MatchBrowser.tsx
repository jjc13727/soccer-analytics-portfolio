import { useEffect, useMemo, useState } from "react";
import { loadIndex, loadMatch } from "../data/loadDataset";
import { useBoardStore } from "../state/boardStore";
import type { DatasetIndex } from "../data/types";

export default function MatchBrowser() {
  const [index, setIndex] = useState<DatasetIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [competitionId, setCompetitionId] = useState<number | null>(null);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [matchId, setMatchId] = useState<number | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const loadMatchIntoBoard = useBoardStore((s) => s.loadMatch);

  useEffect(() => {
    loadIndex()
      .then((idx) => {
        setIndex(idx);
        if (idx.competitions.length) setCompetitionId(idx.competitions[0].competition_id);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const competition = useMemo(
    () => index?.competitions.find((c) => c.competition_id === competitionId) ?? null,
    [index, competitionId]
  );

  // seasons newest-first so "go back in time" is a natural scroll
  const seasons = useMemo(
    () => (competition ? [...competition.seasons].sort((a, b) => b.season_name.localeCompare(a.season_name)) : []),
    [competition]
  );

  useEffect(() => {
    if (seasons.length) setSeasonId(seasons[0].season_id);
  }, [seasons]);

  const season = useMemo(() => seasons.find((s) => s.season_id === seasonId) ?? null, [seasons, seasonId]);

  const matches = useMemo(
    () => (season ? [...season.matches].sort((a, b) => a.date.localeCompare(b.date)) : []),
    [season]
  );

  useEffect(() => {
    if (matches.length) setMatchId(matches[0].match_id);
  }, [matches]);

  async function handleLoad() {
    if (!competitionId || !seasonId || !matchId) return;
    setLoadingMatch(true);
    try {
      const match = await loadMatch(competitionId, seasonId, matchId);
      if (match) loadMatchIntoBoard(match);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setLoadingMatch(false);
    }
  }

  if (error) {
    return <div className="panel-error">Couldn't load match data: {error}</div>;
  }
  if (!index) {
    return <div className="panel-muted">Loading historical match data…</div>;
  }

  return (
    <div className="match-browser">
      <label>
        Competition
        <select value={competitionId ?? ""} onChange={(e) => setCompetitionId(Number(e.target.value))}>
          {index.competitions.map((c) => (
            <option key={c.competition_id} value={c.competition_id}>
              {c.competition_name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Season
        <select value={seasonId ?? ""} onChange={(e) => setSeasonId(Number(e.target.value))}>
          {seasons.map((s) => (
            <option key={s.season_id} value={s.season_id}>
              {s.season_name} ({s.match_count} matches)
            </option>
          ))}
        </select>
      </label>

      <label>
        Match
        <select value={matchId ?? ""} onChange={(e) => setMatchId(Number(e.target.value))}>
          {matches.map((m) => (
            <option key={m.match_id} value={m.match_id}>
              {m.date} — {m.home_team} {m.home_score}-{m.away_score} {m.away_team}
            </option>
          ))}
        </select>
      </label>

      <button className="primary-btn" onClick={handleLoad} disabled={loadingMatch || !matchId}>
        {loadingMatch ? "Loading…" : "Load onto board"}
      </button>
    </div>
  );
}
