import { useEffect, useMemo, useState } from "react";
import { loadSquad, loadSquadIndex } from "../data/loadDataset";
import { FORMATION_TEMPLATES } from "../data/positions";
import { useBoardStore } from "../state/boardStore";
import type { ClubSquad, ClubSquadIndex, Side } from "../data/types";

export default function ClubSquadsPanel() {
  const [index, setIndex] = useState<ClubSquadIndex | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSquadIndex()
      .then(setIndex)
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  if (error) return <div className="panel-error">Couldn't load club squads: {error}</div>;
  if (!index) return <div className="panel-muted">Loading club squad list…</div>;

  if (index.clubs.length === 0) {
    return (
      <div className="panel-muted">
        No club squads loaded yet. Run{" "}
        <code>python3 data-pipeline/fetch_current_squads.py</code> (see the app README) to
        pull real current-season squads from Wikipedia — this needs to run on a machine
        with normal internet access, not necessarily this one.
      </div>
    );
  }

  return (
    <div className="club-squads-panel">
      <div className="club-squads-note">
        Loads a club's actual current squad. There's no free source for a confirmed
        starting XI, so the pitch is auto-filled (goalkeeper + squad order) as a
        starting point — drag players and swap in bench players as you see fit.
      </div>
      <ClubPicker side="home" index={index} />
      <ClubPicker side="away" index={index} />
    </div>
  );
}

function ClubPicker({ side, index }: { side: Side; index: ClubSquadIndex }) {
  const leagues = useMemo(() => [...new Set(index.clubs.map((c) => c.league))].sort(), [index]);
  const [league, setLeague] = useState(leagues[0] ?? "");
  const clubsInLeague = useMemo(() => index.clubs.filter((c) => c.league === league), [index, league]);
  const [slug, setSlug] = useState(clubsInLeague[0]?.slug ?? "");
  const [formation, setFormation] = useState("4-3-3");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClubSquad = useBoardStore((s) => s.loadClubSquad);
  const bench = useBoardStore((s) => (side === "home" ? s.homeBench : s.awayBench));
  const bringOnFromBench = useBoardStore((s) => s.bringOnFromBench);

  useEffect(() => {
    if (clubsInLeague.length && !clubsInLeague.some((c) => c.slug === slug)) {
      setSlug(clubsInLeague[0].slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubsInLeague]);

  async function handleLoad() {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const squad: ClubSquad = await loadSquad(slug);
      loadClubSquad(side, squad, formation);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`club-picker ${side}`}>
      <div className="club-picker-title">{side === "home" ? "Home" : "Away"} club</div>
      <label>
        League
        <select value={league} onChange={(e) => setLeague(e.target.value)}>
          {leagues.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      <label>
        Club
        <select value={slug} onChange={(e) => setSlug(e.target.value)}>
          {clubsInLeague.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.club}
            </option>
          ))}
        </select>
      </label>
      <label>
        Formation
        <select value={formation} onChange={(e) => setFormation(e.target.value)}>
          {Object.keys(FORMATION_TEMPLATES).map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <button className="primary-btn" onClick={handleLoad} disabled={loading || !slug}>
        {loading ? "Loading…" : "Load onto board"}
      </button>
      {error && <div className="panel-error">{error}</div>}

      {bench.length > 0 && (
        <div className="bench-list">
          <div className="bench-list-title">
            Bench / reserves — select a pitch player, then click one here to swap them on
          </div>
          <ul className="squad-list">
            {bench.map((p) => (
              <li key={`${p.number}-${p.name}`}>
                <button className="bench-player" onClick={() => bringOnFromBench(side, p)}>
                  <span className="squad-number">{p.number ?? ""}</span>
                  <span className="squad-name">{p.name}</span>
                  <span className="squad-sub-minute">{p.position}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
