import { useMemo, useState } from "react";
import { computeSquadInfo, useBoardStore } from "../state/boardStore";
import type { TeamSquadInfo } from "../state/boardStore";

export default function SquadPanel() {
  const match = useBoardStore((s) => s.match);
  const squads = useMemo(() => computeSquadInfo(match), [match]);
  const [open, setOpen] = useState(true);

  if (!match || squads.length === 0) return null;

  return (
    <details className="squad-panel" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Full squads &amp; managers</summary>
      <div className="squad-columns">
        {squads.map((s) => (
          <TeamSquad key={s.side} info={s} />
        ))}
      </div>
    </details>
  );
}

function TeamSquad({ info }: { info: TeamSquadInfo }) {
  return (
    <div className={`team-squad ${info.side}`}>
      <div className="team-squad-header">
        <span className="team-name">{info.teamName}</span>
        {info.manager && <span className="team-manager">Manager: {info.manager}</span>}
      </div>

      <h4>Starting XI</h4>
      <ul className="squad-list">
        {info.startingXI.map((p) => (
          <li key={p.playerId} title={p.positionName ?? undefined}>
            <span className="squad-number">{p.jerseyNumber ?? ""}</span>
            <span className="squad-name">{p.name}</span>
          </li>
        ))}
      </ul>

      {info.subsUsed.length > 0 && (
        <>
          <h4>Substitutes used</h4>
          <ul className="squad-list">
            {info.subsUsed.map((p) => (
              <li key={p.playerId} title={`on ${p.onMinute}' for ${p.replacedName}`}>
                <span className="squad-number">{p.jerseyNumber ?? ""}</span>
                <span className="squad-name">{p.name}</span>
                <span className="squad-sub-minute">{p.onMinute}'</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {info.unusedBench.length > 0 && (
        <>
          <h4>Unused substitutes</h4>
          <ul className="squad-list squad-list-muted">
            {info.unusedBench.map((p) => (
              <li key={p.playerId}>
                <span className="squad-number">{p.jerseyNumber ?? ""}</span>
                <span className="squad-name">{p.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
