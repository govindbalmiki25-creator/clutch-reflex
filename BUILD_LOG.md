# Build log: how AI accelerated Clutch Reflex

Raw notes for the **Best AI-Powered Workflow Story** bonus prize. Keep adding entries as you work, especially your JetBrains sessions (WebStorm, Junie, Air). Turn this into the final case study or short video before Jan 12.

---

## Day 1: Nov 18, 2026: from rules to a playable build

**Goal:** go from reading the hackathon rules to a complete, testable game loop in one session.

- **Picked the category with AI help.** An AI assistant read the official rules and the category specifics. It compared the categories on required data access, how feasible each was and how it would score on the five judging criteria, then recommended Category 3.
- **Design from the judging rubric.** The judges ask for "a useful gamer skill", "a local live leaderboard... without Wi-Fi" and "resetting cleanly between players". Each of those became a feature:
  - four skill drills
  - an offline leaderboard that syncs across windows
  - idle auto-save and reset
  - an operator panel
- **Generated the first version:** vanilla JS with no build step, so it runs offline at a booth. It has four drills, a results radar, archetypes, initials entry and a second-screen leaderboard.
- **AI-driven playtesting:**
  - The AI wrote an automated "aim bot" that steps the game loop frame by frame and clicks or tracks real target positions.
  - It verified the full loop: start → 4 drills → results → save → auto-reset. It also checked the profanity filter and the operator panel.
  - The bot showed that the precision drill punished players too hard for expired targets, so target life went from 2.0s to 2.3s.
  - Screenshots caught a clipped radar label and a blurry radar on high-DPI screens. Both were fixed.

## Day 2: Nov 19, 2026: attract-mode demo built with Junie in JetBrains Air

**Goal:** booths need something eye-catching when nobody is playing. The feature: after 20 seconds idle, the game plays itself.

**Setup:**
- Installed **WebStorm**, opened the project, and committed the `.idea/` folder.
- Junie now runs inside the **JetBrains Air** plugin. Signed in with a JetBrains account and started a Junie session from Air's **New Session**.

**The loop: prompt → review → fix, 3 rounds with Junie**

1. **Round 1, the feature prompt.** Junie built an attract-mode demo: a bot that cycles the 4 drills behind a "Click to play" overlay, never saves scores and stays muted. It added about 190 lines across `index.html`, `css/style.css` and `js/game.js`.
   - **Code review found 3 bugs:**
     - The bot only *moved* and never *clicked*, so 3 of the 4 drills looked broken.
     - Synthetic pointer events could stop the demo instantly.
     - Bot speed depended on monitor refresh rate.
2. **Round 2, the fix prompt.** Junie added human-like click timing (120–260 ms after arriving, 220–320 ms for Reflex), a 4px jitter threshold, and frame-rate-independent easing.
3. **Round 3, review of a screen recording.** I screen-recorded the demo running and checked it frame by frame.
   - **Found:** two "Click to play" buttons at once, and the attract screen's big logo covering the targets.
   - **Fix prompt:** Junie hid the attract screen during the demo, made the overlay transparent and added a live "DEMO · 02 TRACK" label.

**Final polish (Claude Code), verified with automated headless-Chrome screenshots:**
- The overlay was missing `justify-content: space-between`, so the call-to-action sat at the top. Moved it to the bottom.
- Added the game name and tagline to the bottom of the demo, so passers-by know what they're looking at.
- Gave the demo its own play area, so targets never spawn behind the label or the call-to-action.
- **Automated checks:**
  - tiny mouse jitter does *not* stop the demo, but a real move does
  - the start screen returns, and the next click starts a real game
  - 0 scores are saved by the demo

**Screenshots:** [`docs/screenshots/`](docs/screenshots/), covering the attract screen and each demo drill.

| Flick | Track |
|---|---|
| ![Demo: Flick](docs/screenshots/demo-flick.png) | ![Demo: Track](docs/screenshots/demo-track.png) |
| **Reflex** | **Precision** |
| ![Demo: Reflex](docs/screenshots/demo-reflex.png) | ![Demo: Precision](docs/screenshots/demo-precision.png) |

**What I learned:** an agent gets you most of the way fast, but reviewing its output, especially by *watching it run*, is what catches the bugs that matter at a real booth.

**Junie in JetBrains Air, step by step** (WebStorm screenshots, cropped to the IDE window):

| Round | Prompt | Junie's result |
|---|---|---|
| 1. Feature | ![Feature prompt](docs/screenshots/junie-01-feature-prompt.png) | ![Feature result](docs/screenshots/junie-02-feature-result.png) |
| 1. Review | ![Junie's notes and the 3 changed files](docs/screenshots/junie-03-review-notes.png) | |
| 2. Bug fixes | ![Fix prompt](docs/screenshots/junie-04-fix-prompt.png) | ![Fix result](docs/screenshots/junie-05-fix-result.png) |
| 3. Layout | ![Layout prompt](docs/screenshots/junie-06-layout-prompt.png) | ![Layout result](docs/screenshots/junie-07-layout-result.png) |
| Final | ![Final summary with changed files](docs/screenshots/junie-08-final-summary.png) | |

All three rounds ran on the **Junie Lite** model, signed in through JetBrains AI.

## Day 2, continued: Round 4, the "rival" callout (Junie in JetBrains Air)

**Goal:** give every player a concrete target on the results screen, like "270 points behind ZED (#2 today)", to keep the booth line competitive.

**Prompt → result:** a fresh Junie session (Junie Lite) added a `#rivalLine` and a sub-line under the score, styles using the existing design tokens, and a `showRivalLine()` function that ranks the player against today's scores. It shows one of three messages: first score of the day, new #1, or points behind the next person up. That's about 47 lines across 3 files in 1m 13s.

| Junie's summary | Details | Files changed |
|---|---|---|
| ![Rival result](docs/screenshots/junie-09-rival-result.png) | ![Rival details](docs/screenshots/junie-10-rival-details.png) | ![Rival files changed](docs/screenshots/junie-11-rival-files-changed.png) |

**Review found 2 bugs.** Junie had noted "No runtime tests were executed; this is a static frontend change validated by code review."
1. **The feature was invisible.** Both new elements started with the `hidden` class (`display: none !important`), and nothing removed it, so the line could never appear. *Fix:* un-hide them at opacity 0 when the results screen opens, so the fade-in animates.
2. **Ties read badly.** A tie showed "0 points behind ACE" and "You'd place #2". *Fix:* it now says "Tied with ACE for #1 today!" and "You'd share #1".

**Runtime testing (Claude Code, headless Chrome):**
- A bot played real runs.
- The leaderboard was seeded around each score to hit every case.
- A virtual clock kept reaction times realistic.
- A name containing HTML (`<b>X`) was confirmed to display as plain text.

| First of the day | New #1 |
|---|---|
| ![First score](docs/screenshots/results-rival-a-first.png) | ![New #1](docs/screenshots/results-rival-b-new-number-one.png) |
| **Behind a rival** | **Tie** |
| ![Behind ZED](docs/screenshots/results-rival-c-behind.png) | ![Tie](docs/screenshots/results-rival-d-tie.png) |

**Lesson:** "validated by code review" isn't the same as tested. Running the feature in every state caught a bug that reading the diff missed.

## Next entries (fill in as you go)

- [x] Open the project in **WebStorm**.
- [x] Use **Junie** in Air for a real feature: the attract-mode demo.
- [ ] Note any WebStorm features you use: debugger, inspections, the Git tool window.
- [ ] Next Junie feature ideas:
  - a "beat your last score" ghost
  - daily challenge seeds
- [ ] Record before/after clips for the short social-style video.
- [ ] Final playtest with 5+ real people, and tune difficulty from their scores.
