# Clutch Reflex

**A 60-second, booth-ready aim gauntlet for esports events.**
Four quick drills test the skills competitive players actually use (flicks, tracking, reaction time and precision). Your results become a skill radar and a player archetype, and a live local leaderboard on a second screen keeps the line competitive all day.

Built for the **Cloud9 x JetBrains: Sky's The Limit Hackathon 2026**, Category 3: Event Mini Game.

---

## How it plays

| # | Drill | What you do | Skill it trains |
|---|-------|-------------|-----------------|
| 01 | **Flick** | Snap to targets that appear far from the last one | Flick aim |
| 02 | **Track** | Keep the crosshair on a target that keeps speeding up. No clicking. | Tracking |
| 03 | **Reflex** | Wait for gold, then click. Clicking early costs points. | Reaction time |
| 04 | **Precision** | Hit three shrinking targets before they vanish | Micro-adjustment |

- Each drill lasts 15 seconds, so a run is about 70 seconds including the intro cards.
- Mouse only. Anyone gets it without a tutorial.
- Each drill scores 0–100, and your **final score** is the sum × 15 (6,000 max).
- Your strongest skill gives your **archetype**: Spearhead, Hunter, Sentry, Marksman, or Flex if you're balanced.
- You enter your initials with on-screen arrows (or the keyboard), lock in, and see your rank for the day.

## Booth-ready by design

- **Fully offline.** Plain HTML/CSS/JS with no build step, no network, no external assets. Sounds are synthesized in the browser.
- **Live leaderboard on a second monitor.** Open `leaderboard.html` in another window. It updates instantly via `BroadcastChannel`, with `storage` events and polling as fallbacks.
- **Scores persist locally** in `localStorage`, grouped by day ("today's top 10" plus all-time best).
- **Resets itself.**
  - If a player walks away on the results screen, their score auto-saves after 30 seconds and the game returns to the start screen.
  - After saving, it goes back to the start screen after 7 seconds.
  - Stray clicks are ignored for a moment after a reset.
- **Abort safety.** Esc, or switching away from the tab, mid-run returns cleanly to the start screen.
- **Family-friendly names.** A small blocklist stops offensive three-letter initials.
- **Hidden operator panel.** Press `Ctrl+Shift+O`, or click the top-left corner 5 times. From it you can:
  - set the event name and toggle sound
  - open the leaderboard window or go fullscreen
  - export all scores to CSV
  - clear today's scores or all scores

## Run it

Serve the folder with any static server (recommended, so both windows share storage):

```bash
python3 -m http.server 8765
```

Then open:
- Game: <http://localhost:8765/>. Press **F** for fullscreen.
- Leaderboard (second monitor): <http://localhost:8765/leaderboard.html>

Double-clicking `index.html` also works. The leaderboard window then refreshes every 2 seconds by polling.

**Testing tip:** `?drill=5` shortens every drill to 5 seconds.

## Project structure

```
index.html          game shell + screens
leaderboard.html    second-monitor leaderboard
css/style.css       all styling (design tokens at the top)
js/store.js         offline score + settings storage, cross-window sync
js/audio.js         synthesized sound effects (Web Audio)
js/drills.js        the four drills, scoring, archetypes
js/game.js          game flow, HUD, results, initials, operator panel
```

## JetBrains tools used

> Fill in exactly what you did. Judges score how thoroughly JetBrains tools were used.

- **WebStorm**: <!-- e.g. main IDE for JS/CSS, debugger for the game loop, built-in HTTP server for testing -->
- **Junie / JetBrains Air**: <!-- e.g. used Junie to generate/refactor X, reviewed agent diffs in Air -->
- The `.idea/` (and `.junie/` / `.air/`, if present) folders are committed as evidence.

## Methodology

Booth games have three constraints: players are new, the line is long, and the hardware is unattended. We designed for those first.

1. **No tutorial needed.** Each drill uses one input (point, hold or click) and a one-line instruction card.
2. **Under 90 seconds.** Four 15-second drills give a full skill profile without slowing the line.
3. **A real gamer skill.** Each drill isolates one aiming fundamental. The radar shows players where they're strong.
4. **Replay drive.** The archetype reveal and a public daily leaderboard give players a reason to come back.
5. **Operability.** Offline storage, automatic resets, abort handling and an operator panel let staff run it all day.

## License

MIT. See [LICENSE](LICENSE). All art is drawn in code, and all names are original. No Riot Games assets or names are used.
