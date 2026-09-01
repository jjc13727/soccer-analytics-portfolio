import { useState } from "react";
import Pitch from "./components/Pitch";
import Toolbar from "./components/Toolbar";
import MatchBrowser from "./components/MatchBrowser";
import ReplayControls from "./components/ReplayControls";
import StatsSidebar from "./components/StatsSidebar";
import SquadPanel from "./components/SquadPanel";
import ClubSquadsPanel from "./components/ClubSquadsPanel";

type LeftTab = "matches" | "squads" | "build";

export default function App() {
  const [leftTab, setLeftTab] = useState<LeftTab>("matches");

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Tactics Board</h1>
        <span className="app-subtitle">Historical formations · current squads · custom boards · match replay</span>
      </header>

      <div className="app-body">
        <aside className="left-panel">
          <div className="tab-row">
            <button className={leftTab === "matches" ? "tab active" : "tab"} onClick={() => setLeftTab("matches")}>
              Historical matches
            </button>
            <button className={leftTab === "squads" ? "tab active" : "tab"} onClick={() => setLeftTab("squads")}>
              Club squads
            </button>
            <button className={leftTab === "build" ? "tab active" : "tab"} onClick={() => setLeftTab("build")}>
              Build board
            </button>
          </div>
          {leftTab === "matches" && <MatchBrowser />}
          {leftTab === "squads" && <ClubSquadsPanel />}
          {leftTab === "build" && <Toolbar />}
          {leftTab === "matches" && (
            <>
              <div className="panel-divider" />
              <ReplayControls />
            </>
          )}
        </aside>

        <main className="pitch-area">
          <Pitch />
        </main>

        <aside className="right-panel">
          <StatsSidebar />
          <SquadPanel />
        </aside>
      </div>
    </div>
  );
}
