# MASTER_SPEC: Pallanguzhi

Status: spec written 30 Oct 2026. Rule set is a **default, confirm** (see DECISIONS.md).

## 1. Goal
Collect more seeds than your rival. Sow seeds round a 2x7 pit board and capture by the rules.

## 2. Success test
A 7-year-old can start playing within 30 seconds (tutorial: 4 guided steps, skippable), finish a game in 8-15 minutes, and explain why they won or lost from the result screen.

## 3. Users
- Explorers 7-10 (primary), Challengers 11-14, Family (two players on one phone).
- Mascot: **Bija**, an original friendly seed. Short speech (max about 12 words).

## 4. Scope
**MVP:** engine and tests, play vs computer (Easy/Medium/Hard), two players on one phone, sowing animation with a running count, tutorial, "?" card, result screen with why, sound, stats and badges, save and continue.
**Production:** settings (sound, reduce motion, level), accessibility pass, grown-up corner, privacy note, `game.json`, hub integration, offline check.
**Not included:** online play, accounts, leaderboards, multi-round play with refilled pits, regional rule variants.

## 5. Board and numbering
14 pits. Pits 0-6 are the bottom row (player 0, shown left to right). Pits 7-13 are the top row (player 1, shown right to left). Sowing goes counter-clockwise: 0, 1, ... 6, 7, ... 13, then back to 0. Each player also has a **pile** (store) for captured seeds. In vs-computer mode the child is player 0 (bottom).

## 6. Exact rules (rule set "Simple classic: 7 pits, 5 seeds")
1. Start: 5 seeds in every pit (70 seeds). Piles empty.
2. Your turn: choose one of your pits that has seeds. Take **all** its seeds in hand.
3. Sow: drop one seed in each following pit, going counter-clockwise (your row, then theirs). The emptied pit is not skipped.
4. After the last seed, look at the **next pit**.
   - If it has seeds: pick them all up and keep sowing from the pit after it (a relay).
   - If it is empty: you **capture** all seeds in the pit after the empty one (if it has any) into your pile. Your turn ends.
5. Safety: a relay chain stops after 300 relays with no capture (never seen in normal play).
6. The turn passes to the other player (no extra turns).
7. The game ends when the player to move has **no seeds in their row**. The seeds still in the other row go to that row's owner. Also ends after 60 turns in a row with no capture; each row's seeds then go to its owner.
8. Most seeds in the pile wins. Equal piles is a draw.

## 7. Bot levels
- Easy: often plays a random pit, otherwise the pit that captures most right now. Beatable by a child.
- Medium: looks 3 moves ahead.
- Hard: looks up to 7 moves ahead within 1.5 seconds.
Bot runs in a Web Worker; falls back to inline if Workers are unavailable.

## 8. Screen flow
Title (mascot, name, goal, Play, How to play, sound, Settings, Home) -> first Play runs the tutorial -> Setup (opponent, level, who starts) -> Play -> Result dialog (why, stats, badges, Play again / How to play / Home).
Play screen: goal line, status line (whose turn, seeds in hand), opponent pile, top row, bottom row, your pile, Undo, Hint, "?" and Menu.

## 9. Tutorial (4 steps + optional practice)
1. Goal: collect more seeds in your pile. Next.
2. Sow: tap the glowing pit; watch one seed drop in each pit with a count.
3. Relay: tap the glowing pit; the last seed lands before a full pit, so pick that up and keep going.
4. Capture: tap the glowing pit; the last seed lands before an empty pit, so you capture the pit after it.
5. Optional practice game vs Easy.
Every step is skippable; a wrong tap shows a friendly nudge and never dead-ends.

## 10. Stored data (localStorage, `hub:pallanguzhi:<name>:v1`)
`settings` (sound, reduceMotion, level), `stats` (played/won per level, best capture), `progress` (shared hub shape with badges), `saved` (mode, level, first, moves as pit numbers), `tutorialDone`.

## 11. Badges
First win, Beat the Hard bot, First capture, Won by 20 seeds or more, Big haul (10+ seeds in one capture).

## 12. Done means
- [ ] Engine rules match section 6, tests pass (`node --test`)
- [ ] Seeds are conserved (70) in every random playout; every playout ends
- [ ] Tutorial scenarios really produce sow, relay and capture
- [ ] Title, tutorial, "?" card, result-with-why, settings, Home, grown-up corner present
- [ ] Every pit is a labelled button; keyboard play works; 4.5:1 contrast; count shown as a number, not only dots
- [ ] Works at 360px with no horizontal scroll; tap targets 44px or more
- [ ] Offline reload works on the live URL
- [ ] Rule set shown on the "?" card and in `ruleVariant`
