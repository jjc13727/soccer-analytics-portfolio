"""
Fetches current first-team squad lists (shirt number, name, broad position, manager)
from Wikipedia for a configurable list of clubs, and writes them into
public/data/squads/ for the app's "Club Squads" tab.

IMPORTANT: this is a separate, much lighter-weight feature than the historical-match
pipeline (fetch_statsbomb.py). There is no free, bulk, structured source for "every
club's current squad" -- Wikipedia's "Current squad" section on each club's article is
free, real, and kept reasonably up to date by editors, but it has to be fetched one
club at a time and its wikitext formatting isn't 100% uniform across every club page.
Treat this script as a starting point: check its output against the source, and adjust
the parsing if a particular club's page uses a different table format.

This script was written (and its regex targets Wikipedia's widely-used
Template:Fs_player convention) but could NOT be tested against a live fetch in the
environment it was authored in -- that sandbox's network policy blocks
en.wikipedia.org entirely. Run it yourself and sanity-check the first club's output
JSON against the Wikipedia page before trusting the rest.

Usage:
    pip install requests
    python3 fetch_current_squads.py                          # fetch CLUBS below
    python3 fetch_current_squads.py --club "Real Madrid CF" --league "La Liga"

Output:
    ../public/data/squads/<slug>.json   (one ClubSquad per club)
    ../public/data/squads/index.json    (list of clubs available to the app)
"""

from __future__ import annotations

import argparse
import json
import re
import time
from dataclasses import dataclass, field
from pathlib import Path

import requests

API = "https://en.wikipedia.org/w/api.php"
HERE = Path(__file__).resolve().parent
OUT_DIR = HERE.parent / "public" / "data" / "squads"

# (Wikipedia page title, display club name, league) -- add to this list to fetch more.
# Kept short deliberately: verify the format works on a couple of clubs before fetching
# dozens in one run.
CLUBS: list[tuple[str, str, str]] = [
    ("Manchester City F.C.", "Manchester City", "Premier League"),
    ("Arsenal F.C.", "Arsenal", "Premier League"),
    ("Real Madrid CF", "Real Madrid", "La Liga"),
    ("FC Barcelona", "Barcelona", "La Liga"),
    ("Juventus FC", "Juventus", "Serie A"),
    ("FC Internazionale Milano", "Inter Milan", "Serie A"),
    ("FC Bayern Munich", "Bayern Munich", "Bundesliga"),
    ("Borussia Dortmund", "Borussia Dortmund", "Bundesliga"),
    ("Paris Saint-Germain F.C.", "Paris Saint-Germain", "Ligue 1"),
    ("Olympique de Marseille", "Marseille", "Ligue 1"),
]

POSITION_MAP = {
    "gk": "GK",
    "df": "DF", "cb": "DF", "rb": "DF", "lb": "DF", "wb": "DF", "rwb": "DF", "lwb": "DF",
    "mf": "MF", "dm": "MF", "cm": "MF", "am": "MF", "rm": "MF", "lm": "MF",
    "fw": "FW", "cf": "FW", "st": "FW", "rw": "FW", "lw": "FW", "ss": "FW",
}

FS_PLAYER_RE = re.compile(r"\{\{fs player\s*\|([^}]*)\}\}", re.IGNORECASE | re.DOTALL)
WIKILINK_RE = re.compile(r"\[\[(?:[^\]|]*\|)?([^\]]+)\]\]")


def strip_wikitext(s: str) -> str:
    s = WIKILINK_RE.sub(r"\1", s)
    s = re.sub(r"'''?", "", s)
    s = re.sub(r"<[^>]+>", "", s)
    return s.strip()


def parse_fs_params(raw: str) -> dict[str, str]:
    params: dict[str, str] = {}
    for part in raw.split("|"):
        if "=" not in part:
            continue
        key, _, value = part.partition("=")
        params[key.strip().lower()] = strip_wikitext(value)
    return params


def get_wikitext(page_title: str) -> str:
    resp = requests.get(
        API,
        params={
            "action": "parse",
            "page": page_title,
            "prop": "wikitext",
            "format": "json",
            "formatversion": 2,
        },
        headers={"User-Agent": "tactics-board-app/0.1 (local data-pipeline script)"},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"Wikipedia API error for '{page_title}': {data['error']}")
    return data["parse"]["wikitext"]


def extract_current_squad_section(wikitext: str) -> str:
    # "Current squad" (sometimes "First-team squad") runs until the next "=="
    # heading. Excludes "Out on loan" / "Youth" sections that follow it.
    match = re.search(
        r"==\s*(Current squad|First[- ]team squad|Squad)\s*==(.*?)(?=\n==[^=])",
        wikitext,
        re.IGNORECASE | re.DOTALL,
    )
    if not match:
        raise RuntimeError("Could not find a 'Current squad' section")
    section = match.group(2)
    # stop at "out on loan" if it's inside the same section without its own heading
    loan_split = re.split(r"out on loan", section, flags=re.IGNORECASE)
    return loan_split[0]


def extract_manager(wikitext: str) -> str | None:
    for field_name in ("manager", "current manager", "coach", "head coach"):
        match = re.search(rf"\|\s*{field_name}\s*=\s*(.+)", wikitext, re.IGNORECASE)
        if match:
            name = strip_wikitext(match.group(1).split("\n")[0])
            if name:
                return name
    return None


def fetch_club(page_title: str, club_name: str, league: str) -> dict:
    wikitext = get_wikitext(page_title)
    manager = extract_manager(wikitext)
    section = extract_current_squad_section(wikitext)

    players = []
    for raw_params in FS_PLAYER_RE.findall(section):
        p = parse_fs_params(raw_params)
        name = p.get("name")
        if not name:
            continue
        pos_code = (p.get("pos") or "").lower()
        broad_position = POSITION_MAP.get(pos_code, "MF")
        number = None
        if p.get("no", "").strip().isdigit():
            number = int(p["no"].strip())
        players.append({"number": number, "name": name, "position": broad_position})

    if not players:
        raise RuntimeError(f"Parsed 0 players for '{club_name}' -- page format may differ from Template:Fs player")

    return {
        "club": club_name,
        "league": league,
        "seasonLabel": "current (as fetched)",
        "manager": manager,
        "source": f"https://en.wikipedia.org/wiki/{page_title.replace(' ', '_')}",
        "fetchedAt": time.strftime("%Y-%m-%d"),
        "players": players,
    }


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--club", help="Wikipedia page title of a single club to fetch")
    parser.add_argument("--display-name", help="Display name (defaults to --club)")
    parser.add_argument("--league", help="League label for a single-club fetch")
    args = parser.parse_args()

    targets = [(args.club, args.display_name or args.club, args.league)] if args.club else CLUBS

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    index_entries = []

    # keep whatever's already there for clubs we're not re-fetching this run
    index_path = OUT_DIR / "index.json"
    if index_path.exists():
        try:
            index_entries = json.loads(index_path.read_text())["clubs"]
        except Exception:
            index_entries = []

    for page_title, club_name, league in targets:
        slug = slugify(club_name)
        try:
            squad = fetch_club(page_title, club_name, league)
        except Exception as exc:
            print(f"  ! {club_name}: {exc}")
            continue

        (OUT_DIR / f"{slug}.json").write_text(json.dumps(squad, ensure_ascii=False, indent=2))
        print(f"  {club_name}: {len(squad['players'])} players, manager={squad['manager']}")

        index_entries = [e for e in index_entries if e["slug"] != slug]
        index_entries.append({"slug": slug, "club": club_name, "league": league})

    index_entries.sort(key=lambda e: (e["league"], e["club"]))
    index_path.write_text(json.dumps({
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "clubs": index_entries,
    }, ensure_ascii=False, indent=2))
    print(f"\nWrote index with {len(index_entries)} clubs -> {index_path}")


if __name__ == "__main__":
    main()
