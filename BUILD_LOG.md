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

## Next entries (fill in as you go)

- [ ] Open the project in **WebStorm**. Note what you used: debugger, inspections, run configurations.
- [ ] Use **Junie** (or Air with an agent) for at least one real feature, and note the prompt, what it produced and what you changed. Ideas:
  - an attract-mode demo that plays itself
  - a "beat your last score" ghost
  - daily challenge seeds
- [ ] Record before/after clips for the short social-style video.
- [ ] Final playtest with 5+ real people, and tune difficulty from their scores.
