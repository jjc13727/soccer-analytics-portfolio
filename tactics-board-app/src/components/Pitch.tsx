import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useBoardStore } from "../state/boardStore";
import PlayerToken from "./PlayerToken";

// A top-down pitch rendered in a 0-100 x 0-100 coordinate space so token
// x/y percentages map 1:1 onto it regardless of the rendered pixel size.
export default function Pitch() {
  const tokens = useBoardStore((s) => s.tokens);
  const moveToken = useBoardStore((s) => s.moveToken);
  const addTokenSide = useBoardStore((s) => s.addTokenSide);
  const addToken = useBoardStore((s) => s.addToken);
  const setAddTokenSide = useBoardStore((s) => s.setAddTokenSide);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingId = useRef<string | null>(null);
  const didDrag = useRef(false);

  function toPercent(clientX: number, clientY: number) {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x, y };
  }

  function handlePointerDown(id: string) {
    draggingId.current = id;
    didDrag.current = false;
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingId.current) return;
    didDrag.current = true;
    const { x, y } = toPercent(e.clientX, e.clientY);
    moveToken(draggingId.current, x, y);
  }

  function endDrag() {
    draggingId.current = null;
  }

  function handleClick(e: ReactPointerEvent<HTMLDivElement>) {
    if (!addTokenSide || didDrag.current) return;
    const { x, y } = toPercent(e.clientX, e.clientY);
    addToken(addTokenSide, x, y);
    setAddTokenSide(null);
  }

  return (
    <div
      ref={containerRef}
      className={`pitch${addTokenSide ? " pitch-add-mode" : ""}`}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onClick={handleClick}
    >
      <PitchMarkings />
      {tokens.map((t) => (
        <PlayerToken key={t.id} token={t} onPointerDown={() => handlePointerDown(t.id)} />
      ))}
    </div>
  );
}

function PitchMarkings() {
  return (
    <svg className="pitch-markings" viewBox="0 0 100 100" preserveAspectRatio="none">
      <rect x="0.5" y="0.5" width="99" height="99" className="pitch-line" fill="none" />
      <line x1="50" y1="0" x2="50" y2="100" className="pitch-line" />
      <circle cx="50" cy="50" r="9" className="pitch-line" fill="none" />
      <circle cx="50" cy="50" r="0.6" className="pitch-dot" />

      {/* left penalty box */}
      <rect x="0.5" y="21" width="16" height="58" className="pitch-line" fill="none" />
      <rect x="0.5" y="37" width="6" height="26" className="pitch-line" fill="none" />
      <path d="M 16 37 A 9 9 0 0 1 16 63" className="pitch-line" fill="none" />
      <circle cx="11" cy="50" r="0.6" className="pitch-dot" />

      {/* right penalty box */}
      <rect x="83.5" y="21" width="16" height="58" className="pitch-line" fill="none" />
      <rect x="93.5" y="37" width="6" height="26" className="pitch-line" fill="none" />
      <path d="M 84 37 A 9 9 0 0 0 84 63" className="pitch-line" fill="none" />
      <circle cx="89" cy="50" r="0.6" className="pitch-dot" />
    </svg>
  );
}
