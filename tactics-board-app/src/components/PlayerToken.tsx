import { useState } from "react";
import { useBoardStore } from "../state/boardStore";
import type { BoardToken } from "../data/types";

interface Props {
  token: BoardToken;
  onPointerDown: () => void;
}

export default function PlayerToken({ token, onPointerDown }: Props) {
  const meta = useBoardStore((s) => (token.side === "home" ? s.homeMeta : s.awayMeta));
  const removeToken = useBoardStore((s) => s.removeToken);
  const renameToken = useBoardStore((s) => s.renameToken);
  const selectedTokenId = useBoardStore((s) => s.selectedTokenId);
  const selectToken = useBoardStore((s) => s.selectToken);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(token.name);
  const isSelected = selectedTokenId === token.id;

  function commitRename() {
    setEditing(false);
    if (draft.trim() && draft !== token.name) renameToken(token.id, draft.trim());
  }

  return (
    <div
      className={`player-token ${token.side}${token.isSub ? " is-sub" : ""}${isSelected ? " is-selected" : ""}`}
      style={{ left: `${token.x}%`, top: `${token.y}%`, ["--team-color" as string]: meta.color }}
      onPointerDown={(e) => {
        e.preventDefault();
        onPointerDown();
      }}
      onClick={() => selectToken(isSelected ? null : token.id)}
      onDoubleClick={() => setEditing(true)}
      onContextMenu={(e) => {
        e.preventDefault();
        removeToken(token.id);
      }}
      title={`${token.name}${token.positionName ? ` — ${token.positionName}` : ""} (click to select, right-click to remove, double-click to rename)`}
    >
      <div className="token-circle">{token.jerseyNumber ?? "?"}</div>
      {editing ? (
        <input
          className="token-name-input"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setEditing(false);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="token-name">{token.shortName}</div>
      )}
    </div>
  );
}
