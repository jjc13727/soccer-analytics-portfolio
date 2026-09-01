import { useMemo } from "react";
import { computePlayerStats, computeScoreline, useBoardStore } from "../state/boardStore";
import { formationCodeToLabel } from "../data/positions";
import TeamBadge from "./TeamBadge";

export default function StatsSidebar() {
  const match = useBoardStore((s) => s.match);
  const eventCursor = useBoardStore((s) => s.eventCursor);
  const homeMeta = useBoardStore((s) => s.homeMeta);
  const awayMeta = useBoardStore((s) => s.awayMeta);
  const scoreline = useMemo(() => computeScoreline(match, eventCursor), [match, eventCursor]);
  const stats = useMemo(() => computePlayerStats(match, eventCursor), [match, eventCursor]);

  return (
    <div className="stats-sidebar">
      <div className="scoreline">
        <TeamHeader name={homeMeta.name} color={homeMeta.color} formation={homeMeta.formationCode} />
        <div className="score">
          {match ? `${scoreline.home} - ${scoreline.away}` : "— : —"}
        </div>
        <TeamHeader name={awayMeta.name} color={awayMeta.color} formation={awayMeta.formationCode} align="right" />
      </div>

      {match && (
        <div className="match-meta">
          {match.date} · {match.competition_name} {match.season_name}
          {match.stadium ? ` · ${match.stadium}` : ""}
        </div>
      )}

      <h3>Player stats</h3>
      {stats.length === 0 ? (
        <div className="panel-muted">Goals, assists and cards appear here as you replay the match.</div>
      ) : (
        <table className="stats-table">
          <thead>
            <tr>
              <th>Player</th>
              <th title="Goals">G</th>
              <th title="Assists">A</th>
              <th title="Yellow cards">🟨</th>
              <th title="Red cards">🟥</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.playerId} className={s.side}>
                <td>{s.name}</td>
                <td>{s.goals || ""}</td>
                <td>{s.assists || ""}</td>
                <td>{s.yellow || ""}</td>
                <td>{s.red || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TeamHeader({
  name,
  color,
  formation,
  align = "left",
}: {
  name: string;
  color: string;
  formation: string | null;
  align?: "left" | "right";
}) {
  return (
    <div className={`team-header ${align}`}>
      <TeamBadge name={name} color={color} />
      <div>
        <div className="team-name">{name}</div>
        {formation && <div className="team-formation">{formationCodeToLabel(formation)}</div>}
      </div>
    </div>
  );
}
