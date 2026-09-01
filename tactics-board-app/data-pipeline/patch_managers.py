"""
One-off patch: backfill home_manager/away_manager into already-normalized
season JSON files by re-reading the (small, cheap) matches.json list -- no
need to re-fetch lineups/events for every match. Safe to re-run.
"""
import json
from pathlib import Path

from fetch_statsbomb import MATCHES_DIR, list_matches

for path in sorted(MATCHES_DIR.glob("*.json")):
    competition_id, season_id = (int(x) for x in path.stem.split("_"))
    matches_summary = {m["match_id"]: m for m in list_matches(competition_id, season_id)}

    data = json.loads(path.read_text())
    changed = 0
    for m in data:
        summary = matches_summary.get(m["match_id"])
        if not summary:
            continue
        home_managers = summary["home_team"].get("managers") or [{}]
        away_managers = summary["away_team"].get("managers") or [{}]
        m["home_manager"] = home_managers[0].get("name")
        m["away_manager"] = away_managers[0].get("name")
        changed += 1

    path.write_text(json.dumps(data, ensure_ascii=False))
    print(f"{path.name}: patched {changed}/{len(data)} matches")
