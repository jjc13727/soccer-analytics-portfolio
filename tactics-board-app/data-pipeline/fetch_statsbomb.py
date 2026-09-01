"""
Fetches and normalizes StatsBomb open-data (https://github.com/statsbomb/open-data)
into compact per-season JSON files consumed by the tactics board app.

StatsBomb's open data is free and real, but it is NOT a complete historical
record of every top-5-league season -- coverage varies a lot by competition
and season (see data/index.json after running this, or the project README).
This script is written to be re-run any time to pull more competitions/seasons
as StatsBomb publishes them, or to add more seasons to TARGETS below.

Usage:
    python3 fetch_statsbomb.py                 # fetch everything in TARGETS
    python3 fetch_statsbomb.py --list           # just print available competitions/seasons
    python3 fetch_statsbomb.py --competition 11 --season 27   # fetch one season only

Output:
    ../public/data/matches/<competition_id>_<season_id>.json   (one array of normalized matches)
    ../public/data/index.json                                  (browsable competition/season/match index)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data"
HERE = Path(__file__).resolve().parent
OUT_DIR = HERE.parent / "public" / "data"
MATCHES_DIR = OUT_DIR / "matches"
MAX_WORKERS = 24
TIMEOUT = 30

# competition_id -> friendly label, used for --list and for filtering "top 5" leagues
TOP5_LEAGUES = {
    2: "Premier League (England)",
    11: "La Liga (Spain)",
    12: "Serie A (Italy)",
    9: "1. Bundesliga (Germany)",
    7: "Ligue 1 (France)",
}

# Default set of (competition_id, season_id) pairs to fetch for this app's seed dataset.
# Picked to give: (a) one full season across all 5 top leagues for a cross-league
# comparison, and (b) deep multi-season history for one league/club to demonstrate
# "go back in time" browsing, within what StatsBomb's free open data actually covers.
DEFAULT_TARGETS: list[tuple[int, int]] = [
    # 2015/16 season, all 5 top leagues where StatsBomb has released it
    (2, 27),   # Premier League 2015/16 (full season, 380 matches)
    (11, 27),  # La Liga 2015/16 (full season, 380 matches)
    (12, 27),  # Serie A 2015/16 (full season, 380 matches)
    (9, 27),   # 1. Bundesliga 2015/16 (34 matches released)
    (7, 27),   # Ligue 1 2015/16 (377 matches)
    # Extra recent seasons where available
    (9, 281),  # 1. Bundesliga 2023/24
    (7, 108),  # Ligue 1 2021/22
    (7, 235),  # Ligue 1 2022/23
    (2, 44),   # Premier League 2003/04
    # Deep single-club history: La Liga has many seasons of Barcelona matches
    (11, 37), (11, 38), (11, 39), (11, 40), (11, 41),
    (11, 21), (11, 22), (11, 23), (11, 24), (11, 25), (11, 26),
    (11, 2), (11, 1), (11, 4), (11, 42), (11, 90),
]

# --- StatsBomb position_id (1-25) -> readable name -----------------------------------
POSITION_NAMES = {
    1: "Goalkeeper", 2: "Right Back", 3: "Right Center Back", 4: "Center Back",
    5: "Left Center Back", 6: "Left Back", 7: "Right Wing Back", 8: "Left Wing Back",
    9: "Right Defensive Midfield", 10: "Center Defensive Midfield", 11: "Left Defensive Midfield",
    12: "Right Midfield", 13: "Right Center Midfield", 14: "Center Midfield",
    15: "Left Center Midfield", 16: "Left Midfield", 17: "Right Wing",
    18: "Right Attacking Midfield", 19: "Center Attacking Midfield", 20: "Left Attacking Midfield",
    21: "Left Wing", 22: "Right Center Forward", 23: "Center Forward",
    24: "Left Center Forward", 25: "Secondary Striker",
}

session = requests.Session()


def get_json(path: str):
    url = f"{BASE}/{path}"
    resp = session.get(url, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def list_competitions():
    return get_json("competitions.json")


def list_matches(competition_id: int, season_id: int):
    try:
        return get_json(f"matches/{competition_id}/{season_id}.json")
    except requests.HTTPError:
        return []


def extract_events(events: list[dict], team_ids: dict[int, str]) -> tuple[dict, list[dict]]:
    """Returns (formations_by_team_id, notable_events)."""
    formations: dict[int, dict] = {}
    notable: list[dict] = []

    # index passes by id, for goal-assist lookups
    events_by_id = {e["id"]: e for e in events}

    for e in events:
        etype = e["type"]["name"]
        minute = e.get("minute", 0)
        second = e.get("second", 0)
        team = e.get("team") or {}
        team_id = team.get("id")

        if etype == "Starting XI":
            tactics = e.get("tactics") or {}
            lineup = []
            for slot in tactics.get("lineup", []):
                lineup.append({
                    "player_id": slot["player"]["id"],
                    "name": slot["player"]["name"],
                    "jersey_number": slot.get("jersey_number"),
                    "position_id": slot["position"]["id"],
                    "position_name": slot["position"]["name"],
                })
            formations[team_id] = {
                "formation": tactics.get("formation"),
                "starting": lineup,
            }

        elif etype == "Substitution":
            sub = e.get("substitution") or {}
            replacement = sub.get("replacement") or {}
            notable.append({
                "type": "sub",
                "minute": minute, "second": second, "team_id": team_id,
                "player_off_id": e["player"]["id"], "player_off_name": e["player"]["name"],
                "player_on_id": replacement.get("id"), "player_on_name": replacement.get("name"),
            })

        elif etype == "Shot":
            shot = e.get("shot") or {}
            if (shot.get("outcome") or {}).get("name") == "Goal":
                assist_player = None
                key_pass_id = shot.get("key_pass_id")
                if key_pass_id and key_pass_id in events_by_id:
                    kp = events_by_id[key_pass_id]
                    if (kp.get("pass") or {}).get("goal_assist"):
                        assist_player = {"id": kp["player"]["id"], "name": kp["player"]["name"]}
                notable.append({
                    "type": "goal",
                    "minute": minute, "second": second, "team_id": team_id,
                    "player_id": e["player"]["id"], "player_name": e["player"]["name"],
                    "assist_player_id": assist_player["id"] if assist_player else None,
                    "assist_player_name": assist_player["name"] if assist_player else None,
                    "xg": shot.get("statsbomb_xg"),
                })

        elif etype == "Own Goal Against":
            # this team's player put it in their own net -> goal credited to the other team
            other_team_id = next((tid for tid in team_ids if tid != team_id), None)
            notable.append({
                "type": "own_goal",
                "minute": minute, "second": second, "team_id": other_team_id,
                "player_id": e["player"]["id"], "player_name": e["player"]["name"],
            })

        elif etype == "Bad Behaviour":
            card = (e.get("bad_behaviour") or {}).get("card") or {}
            if card:
                notable.append({
                    "type": "card", "card": card.get("name"),
                    "minute": minute, "second": second, "team_id": team_id,
                    "player_id": e["player"]["id"], "player_name": e["player"]["name"],
                })

        elif etype == "Foul Committed":
            card = (e.get("foul_committed") or {}).get("card") or {}
            if card:
                notable.append({
                    "type": "card", "card": card.get("name"),
                    "minute": minute, "second": second, "team_id": team_id,
                    "player_id": e["player"]["id"], "player_name": e["player"]["name"],
                })

    notable.sort(key=lambda x: (x["minute"], x["second"]))
    return formations, notable


def normalize_match(match_summary: dict) -> dict | None:
    match_id = match_summary["match_id"]
    home = match_summary["home_team"]
    away = match_summary["away_team"]
    team_ids = {home["home_team_id"]: home["home_team_name"], away["away_team_id"]: away["away_team_name"]}

    try:
        lineups_raw = get_json(f"lineups/{match_id}.json")
    except requests.HTTPError:
        lineups_raw = []
    try:
        events_raw = get_json(f"events/{match_id}.json")
    except requests.HTTPError:
        events_raw = []

    if not events_raw:
        return None

    formations, notable = extract_events(events_raw, team_ids)

    # bench (full squad from lineups.json minus those who started)
    started_ids = {p["player_id"] for f in formations.values() for p in f["starting"]}
    squads = {}
    for team_lineup in lineups_raw:
        tid = team_lineup["team_id"]
        squads[tid] = [
            {
                "player_id": p["player_id"],
                "name": p["player_name"],
                "nickname": p.get("player_nickname"),
                "jersey_number": p.get("jersey_number"),
                "started": p["player_id"] in started_ids,
            }
            for p in team_lineup["lineup"]
        ]

    return {
        "match_id": match_id,
        "date": match_summary.get("match_date"),
        "kick_off": match_summary.get("kick_off"),
        "competition_id": match_summary["competition"]["competition_id"],
        "competition_name": match_summary["competition"]["competition_name"],
        "season_id": match_summary["season"]["season_id"],
        "season_name": match_summary["season"]["season_name"],
        "match_week": match_summary.get("match_week"),
        "stadium": (match_summary.get("stadium") or {}).get("name"),
        "home_team": {"id": home["home_team_id"], "name": home["home_team_name"]},
        "away_team": {"id": away["away_team_id"], "name": away["away_team_name"]},
        "home_score": match_summary.get("home_score"),
        "away_score": match_summary.get("away_score"),
        "home_manager": (home.get("managers") or [{}])[0].get("name"),
        "away_manager": (away.get("managers") or [{}])[0].get("name"),
        "formations": {str(tid): f for tid, f in formations.items()},
        "squads": {str(tid): squad for tid, squad in squads.items()},
        "events": notable,
    }


def fetch_season(competition_id: int, season_id: int) -> dict:
    out_path = MATCHES_DIR / f"{competition_id}_{season_id}.json"
    matches = list_matches(competition_id, season_id)
    if not matches:
        return {"competition_id": competition_id, "season_id": season_id, "count": 0}

    if out_path.exists():
        try:
            existing = json.loads(out_path.read_text())
            if len(existing) >= len(matches):
                print(f"  [skip] {competition_id}/{season_id} already has {len(existing)} matches")
                return _season_meta(existing, matches)
        except Exception:
            pass

    print(f"  [fetch] competition {competition_id} season {season_id}: {len(matches)} matches")
    normalized = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(normalize_match, m): m for m in matches}
        done = 0
        for fut in as_completed(futures):
            done += 1
            try:
                result = fut.result()
                if result:
                    normalized.append(result)
            except Exception as exc:
                print(f"    ! failed match {futures[fut]['match_id']}: {exc}")
            if done % 50 == 0:
                print(f"    ...{done}/{len(matches)}")

    normalized.sort(key=lambda m: (m["date"] or "", m["match_id"]))
    MATCHES_DIR.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(normalized, ensure_ascii=False))
    print(f"  [done] wrote {len(normalized)} matches -> {out_path.relative_to(OUT_DIR.parent)}")
    return _season_meta(normalized, matches)


def _season_meta(normalized: list[dict], matches_raw: list[dict]) -> dict:
    if not normalized:
        return {}
    any_match = normalized[0]
    return {
        "competition_id": any_match["competition_id"],
        "competition_name": any_match["competition_name"],
        "season_id": any_match["season_id"],
        "season_name": any_match["season_name"],
        "match_count": len(normalized),
        "matches": [
            {
                "match_id": m["match_id"], "date": m["date"],
                "home_team": m["home_team"]["name"], "away_team": m["away_team"]["name"],
                "home_score": m["home_score"], "away_score": m["away_score"],
            }
            for m in normalized
        ],
    }


def build_index(all_meta: list[dict]):
    competitions: dict[int, dict] = {}
    for meta in all_meta:
        if not meta:
            continue
        cid = meta["competition_id"]
        comp = competitions.setdefault(cid, {
            "competition_id": cid,
            "competition_name": meta["competition_name"],
            "seasons": [],
        })
        comp["seasons"].append({
            "season_id": meta["season_id"],
            "season_name": meta["season_name"],
            "match_count": meta["match_count"],
            "matches": meta["matches"],
        })

    index = {"generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
             "competitions": sorted(competitions.values(), key=lambda c: c["competition_name"])}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=None))
    print(f"\nWrote index with {sum(len(c['seasons']) for c in index['competitions'])} seasons "
          f"across {len(index['competitions'])} competitions -> {OUT_DIR / 'index.json'}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--list", action="store_true", help="list available competitions/seasons and exit")
    parser.add_argument("--competition", type=int, help="fetch only this competition_id")
    parser.add_argument("--season", type=int, help="fetch only this season_id (requires --competition)")
    args = parser.parse_args()

    if args.list:
        comps = list_competitions()
        for c in sorted(comps, key=lambda c: (c["competition_name"], c["season_name"])):
            print(f"{c['competition_id']:>5}  {c['season_id']:>4}  {c['competition_name']:<28} {c['season_name']}")
        return

    if args.competition and args.season:
        targets = [(args.competition, args.season)]
    elif args.competition:
        comps = list_competitions()
        targets = [(c["competition_id"], c["season_id"]) for c in comps if c["competition_id"] == args.competition]
    else:
        targets = DEFAULT_TARGETS

    print(f"Fetching {len(targets)} competition/season target(s) from StatsBomb open data...\n")
    all_meta = []
    for competition_id, season_id in targets:
        all_meta.append(fetch_season(competition_id, season_id))

    build_index(all_meta)


if __name__ == "__main__":
    main()
