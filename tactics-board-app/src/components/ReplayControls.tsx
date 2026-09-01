import { useEffect } from "react";
import { getNickname, useBoardStore } from "../state/boardStore";
import { shortDisplayName } from "../data/nameFormat";

export default function ReplayControls() {
  const match = useBoardStore((s) => s.match);
  const eventCursor = useBoardStore((s) => s.eventCursor);
  const playing = useBoardStore((s) => s.playing);
  const play = useBoardStore((s) => s.play);
  const pause = useBoardStore((s) => s.pause);
  const stepForward = useBoardStore((s) => s.stepForward);
  const stepBack = useBoardStore((s) => s.stepBack);
  const seek = useBoardStore((s) => s.seek);
  const resetToKickoff = useBoardStore((s) => s.resetToKickoff);

  useEffect(() => {
    if (!playing || !match) return;
    const id = setInterval(() => stepForward(), 1200);
    return () => clearInterval(id);
  }, [playing, match, stepForward]);

  if (!match) {
    return <div className="panel-muted">Load a historical match to replay its goals, cards and substitutions.</div>;
  }

  const events = match.events;
  const current = eventCursor >= 0 ? events[eventCursor] : null;
  const atEnd = eventCursor >= events.length - 1;

  return (
    <div className="replay-controls">
      <div className="replay-buttons">
        <button onClick={resetToKickoff} title="Back to kickoff">
          ⏮
        </button>
        <button onClick={stepBack} disabled={eventCursor < 0}>
          ◀ Prev
        </button>
        {playing ? (
          <button onClick={pause} className="primary-btn">
            ⏸ Pause
          </button>
        ) : (
          <button onClick={play} className="primary-btn" disabled={atEnd}>
            ▶ Play
          </button>
        )}
        <button onClick={stepForward} disabled={atEnd}>
          Next ▶
        </button>
      </div>

      <input
        type="range"
        min={-1}
        max={events.length - 1}
        value={eventCursor}
        onChange={(e) => seek(Number(e.target.value))}
        className="replay-slider"
      />

      <div className="replay-current">
        {current ? describeEvent(current, match) : "Kickoff"}
      </div>

      <ol className="event-log" reversed>
        {events
          .slice(0, eventCursor + 1)
          .map((e, i) => (
            <li key={i} className={i === eventCursor ? "event-current" : ""} onClick={() => seek(i)}>
              <span className="event-minute">{e.minute}'</span> {describeEvent(e, match)}
            </li>
          ))
          .reverse()}
      </ol>
    </div>
  );
}

function describeEvent(e: import("../data/types").MatchEvent, match: import("../data/types").NormalizedMatch): string {
  const teamName = e.team_id === match.home_team.id ? match.home_team.name : match.away_team.name;
  const name = (id: number, fullName: string) => shortDisplayName(fullName, getNickname(match, id));
  switch (e.type) {
    case "goal":
      return `⚽ Goal — ${name(e.player_id, e.player_name)} (${teamName})${
        e.assist_player_id && e.assist_player_name ? ` assist: ${name(e.assist_player_id, e.assist_player_name)}` : ""
      }`;
    case "own_goal":
      return `⚽ Own goal — ${name(e.player_id, e.player_name)} (credited to ${teamName})`;
    case "card":
      return `${e.card === "Red Card" ? "🟥" : "🟨"} ${e.card} — ${name(e.player_id, e.player_name)} (${teamName})`;
    case "sub": {
      const onName = e.player_on_id && e.player_on_name ? name(e.player_on_id, e.player_on_name) : (e.player_on_name ?? "?");
      return `🔄 Substitution — ${onName} on for ${name(e.player_off_id, e.player_off_name)} (${teamName})`;
    }
  }
}
