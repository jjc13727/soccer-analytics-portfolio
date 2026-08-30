import { useState } from "react";
import { useBoardStore } from "../state/boardStore";
import { FORMATION_TEMPLATES } from "../data/positions";
import type { BoardToken, TeamMeta } from "../data/types";

const STORAGE_KEY = "tactics-board:saved-boards:v1";

interface SavedBoard {
  name: string;
  savedAt: string;
  tokens: BoardToken[];
  homeMeta: TeamMeta;
  awayMeta: TeamMeta;
}

function readSaved(): SavedBoard[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeSaved(boards: SavedBoard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
}

export default function Toolbar() {
  const newBlankBoard = useBoardStore((s) => s.newBlankBoard);
  const applyFormationTemplate = useBoardStore((s) => s.applyFormationTemplate);
  const addTokenSide = useBoardStore((s) => s.addTokenSide);
  const setAddTokenSide = useBoardStore((s) => s.setAddTokenSide);
  const homeMeta = useBoardStore((s) => s.homeMeta);
  const awayMeta = useBoardStore((s) => s.awayMeta);

  const [homeName, setHomeName] = useState("Home");
  const [awayName, setAwayName] = useState("Away");
  const [homeFormation, setHomeFormation] = useState("4-3-3");
  const [awayFormation, setAwayFormation] = useState("4-4-2");

  const [savedBoards, setSavedBoards] = useState<SavedBoard[]>(readSaved());
  const [boardName, setBoardName] = useState("");

  function handleNewBoard() {
    newBlankBoard(homeFormation, awayFormation, homeName, awayName);
  }

  function handleSave() {
    if (!boardName.trim()) return;
    const { tokens, homeMeta, awayMeta } = useBoardStore.getState();
    const next = [
      ...savedBoards.filter((b) => b.name !== boardName.trim()),
      { name: boardName.trim(), savedAt: new Date().toISOString(), tokens, homeMeta, awayMeta },
    ];
    writeSaved(next);
    setSavedBoards(next);
    setBoardName("");
  }

  function handleLoad(board: SavedBoard) {
    useBoardStore.setState({
      match: null,
      tokens: board.tokens,
      homeMeta: board.homeMeta,
      awayMeta: board.awayMeta,
      eventCursor: -1,
      playing: false,
    });
  }

  function handleDelete(name: string) {
    const next = savedBoards.filter((b) => b.name !== name);
    writeSaved(next);
    setSavedBoards(next);
  }

  return (
    <div className="toolbar">
      <details open>
        <summary>Build a custom board</summary>
        <div className="toolbar-section">
          <label>
            Home team
            <input value={homeName} onChange={(e) => setHomeName(e.target.value)} />
          </label>
          <label>
            Home formation
            <select value={homeFormation} onChange={(e) => setHomeFormation(e.target.value)}>
              {Object.keys(FORMATION_TEMPLATES).map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            Away team
            <input value={awayName} onChange={(e) => setAwayName(e.target.value)} />
          </label>
          <label>
            Away formation
            <select value={awayFormation} onChange={(e) => setAwayFormation(e.target.value)}>
              {Object.keys(FORMATION_TEMPLATES).map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <button className="primary-btn" onClick={handleNewBoard}>
            New blank board
          </button>
        </div>
      </details>

      <details>
        <summary>Edit current board</summary>
        <div className="toolbar-section">
          <label>
            Re-apply formation ({homeMeta.name})
            <select
              value={homeMeta.formationCode ?? ""}
              onChange={(e) => applyFormationTemplate("home", e.target.value)}
            >
              <option value="" disabled>
                choose…
              </option>
              {Object.keys(FORMATION_TEMPLATES).map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            Re-apply formation ({awayMeta.name})
            <select
              value={awayMeta.formationCode ?? ""}
              onChange={(e) => applyFormationTemplate("away", e.target.value)}
            >
              <option value="" disabled>
                choose…
              </option>
              {Object.keys(FORMATION_TEMPLATES).map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <button
            className={addTokenSide === "home" ? "primary-btn" : ""}
            onClick={() => setAddTokenSide(addTokenSide === "home" ? null : "home")}
          >
            {addTokenSide === "home" ? "Click pitch to place…" : `+ Add ${homeMeta.name} player`}
          </button>
          <button
            className={addTokenSide === "away" ? "primary-btn" : ""}
            onClick={() => setAddTokenSide(addTokenSide === "away" ? null : "away")}
          >
            {addTokenSide === "away" ? "Click pitch to place…" : `+ Add ${awayMeta.name} player`}
          </button>
          <div className="hint">Drag to move · double-click to rename · right-click to remove a player.</div>
        </div>
      </details>

      <details>
        <summary>Save / load boards</summary>
        <div className="toolbar-section">
          <label>
            Board name
            <input value={boardName} onChange={(e) => setBoardName(e.target.value)} placeholder="e.g. Sunday 4-3-3" />
          </label>
          <button className="primary-btn" onClick={handleSave} disabled={!boardName.trim()}>
            Save current board
          </button>
          {savedBoards.length > 0 && (
            <ul className="saved-boards">
              {savedBoards.map((b) => (
                <li key={b.name}>
                  <button onClick={() => handleLoad(b)}>{b.name}</button>
                  <button className="icon-btn" onClick={() => handleDelete(b.name)} title="Delete">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}
