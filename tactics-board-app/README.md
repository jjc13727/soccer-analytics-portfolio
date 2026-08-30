# Tactics Board

An interactive soccer tactics board (in the spirit of JLA Tactics Board):
drag players around a pitch, build custom formations and lineups, browse
real historical matches from the top 5 European leagues and load their
actual formation/lineup onto the board, then replay the match event-by-event
(goals, cards, subs) with a live scoreline and per-player G/A/card stats.

Runs as a desktop app (Windows/Mac/Linux via Electron) or in any browser —
same codebase, and it's structured so a Capacitor-based mobile build can
reuse the same React UI later (see **Path to mobile** below).

## Quick start

```bash
npm install
npm run dev              # browser, http://localhost:5173
npm run electron:dev     # desktop app, hot-reloading
```

## What's here

- `src/` — the React/TypeScript app (pitch, drag-and-drop tokens, formation
  builder, match browser, replay controls, stats sidebar).
- `electron/` — the thin Electron shell (`main.cjs` opens a window pointing
  at the Vite dev server in development, or the built `dist/` in production).
- `data-pipeline/fetch_statsbomb.py` — fetches and normalizes real match data.
- `public/data/` — the normalized dataset the app reads at runtime
  (`index.json` + one JSON file per competition/season).

## The historical data — and its real limits

Free, real, per-match formation/lineup/event data for "every top-5-league
season back as far as it goes" does not exist as a single free source. The
data in this repo comes from [StatsBomb's open data](https://github.com/statsbomb/open-data),
which is genuinely free and genuinely accurate (it's the same taxonomy
StatsBomb sells commercially) but only covers the competitions/seasons
StatsBomb has chosen to release. Concretely, what's seeded in `public/data/`
right now:

| Competition | Seasons |
|---|---|
| La Liga | 2004/05 – 2020/21 (17 seasons; only FC Barcelona's matches are released for every season except 2015/16, which is the full 380-match season) |
| Premier League | 2003/04, 2015/16 (full seasons) |
| Serie A | 2015/16 (full season) |
| Bundesliga | 2015/16, 2023/24 |
| Ligue 1 | 2015/16, 2021/22, 2022/23 |

That's ~2,160 real matches with correct formations, starting lineups,
substitutions, goals+assists, and cards. There is **no current-season
(2026/27) data** here — StatsBomb's open data is historical and released
with a delay, and no free provider publishes live top-5-league lineups in
bulk. For this season, use **Build board** to enter lineups by hand as they
happen, or plug in a paid live-data API (see below).

### Pulling more data

Re-run the pipeline any time — it's resumable (skips seasons already on
disk) and safe to re-run:

```bash
cd data-pipeline
python3 fetch_statsbomb.py --list                       # see everything StatsBomb has released
python3 fetch_statsbomb.py --competition 16              # e.g. fetch every Champions League season
python3 fetch_statsbomb.py --competition 11 --season 27  # one specific season
python3 fetch_statsbomb.py                                # re-run the app's default target list
```

Edit `DEFAULT_TARGETS` in `fetch_statsbomb.py` to change what a plain
`fetch_statsbomb.py` run pulls. Requires `pip install requests`.

### Filling the gaps with a paid provider

For complete season-by-season coverage (every top-5-league match, every
year) or live current-season lineups, a paid provider such as API-Football
or Opta is the realistic path. The app's data layer (`src/data/loadDataset.ts`,
`src/data/types.ts`) is deliberately provider-agnostic — a new fetcher script
that writes the same `NormalizedMatch` JSON shape into `public/data/` plugs
straight into the existing UI with no frontend changes.

## Formation positions

Real matches place players using StatsBomb's standard position taxonomy
(`src/data/positions.ts`, `POSITION_COORDS`) — 25 named slots (Goalkeeper,
Right Back, Center Attacking Midfield, etc.) mapped to fixed coordinates on
the pitch, the same "template slot" approach JLA-style boards use. It is
not literal player-tracking data (which isn't available for free at this
scale) — positions are accurate to the player's *role*, not their exact
on-pitch location at that instant.

## Match replay

Replay steps through a match's goals, cards, and substitutions in order.
Substitutions actually swap the token on the pitch (the outgoing player's
position is taken over by the substitute); goals/cards update the scoreline
and the stats sidebar live as you step or press Play. It does not animate
continuous player movement between events (no free data source provides
that) — it's an event-based replay, closer to a "match highlights on the
whiteboard" experience than optical tracking playback.

## Packaging as a desktop app

```bash
npm run electron:build       # installer for the current OS (dmg/nsis/AppImage)
npm run electron:build:dir   # unpacked build, for a quick local smoke test
```

electron-builder config lives in `package.json`'s `"build"` key. Building a
Windows installer from macOS/Linux (or vice versa) generally needs that
target OS or CI — see the [electron-builder docs](https://www.electron.build/multi-platform-build).

## Path to mobile

The app is a normal React app wrapped by Electron for desktop — no
Electron-only APIs are used in `src/` (the `electron/preload.cjs` bridge is
currently empty). That means [Capacitor](https://capacitorjs.com/) can wrap
the same `dist/` build for iOS/Android with `npx cap init` + `npx cap add ios
android` pointed at this project, reusing the entire UI. The one thing to
revisit for mobile is `PlayerToken`'s pointer-drag interaction — it already
uses Pointer Events (not mouse-only), which Capacitor's WebView supports,
but touch target sizing should be re-checked on a real device.

## Testing changes

```bash
npm run build   # typecheck + production build
```

For UI changes, `npx playwright ...` (already a devDependency) against
`npm run dev` is the fastest way to confirm a change actually renders —
there's no test suite yet.
