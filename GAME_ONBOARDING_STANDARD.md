# Game Onboarding Standard

Applies to every game built for the Game Hub. A game is not "done" until it passes the checklist in section 12.

Version 1.0, 30 Oct 2026. Decisions marked **(default, confirm)** were assumed and can be changed in `DECISIONS.md`.

## 1. Purpose
A new player should know what to do within 30 seconds of opening a game, without reading a manual.

Two principles:
1. **Learn by doing.** Show, then let the player try. Text is the last resort.
2. **One new idea per screen.** Teach the goal first, then the move, then the special rule.

## 2. Required screens and parts
| # | Part | What it is |
|---|---|---|
| 1 | Title screen | Mascot, game name, goal in one sentence, **Play**, **How to play**, sound toggle |
| 2 | Tutorial | 3-5 guided steps led by the mascot, in the game's menu |
| 3 | "?" button | On the play screen; opens a one-screen rules reminder |
| 4 | Result screen | Win/lose/finish screen that says **why** |
| 5 | Settings | Sound on/off, difficulty (if any), reduced motion |
| 6 | Home button | Returns to the hub (or the title screen while standalone) |
| 7 | `game.json` | Hub-ready metadata, including the onboarding fields in section 6 |

## 3. Title screen
- Mascot, game name, tagline.
- **Goal in one sentence.**
- Big **Play** button. On a very first visit, Play starts the tutorial first.
- **How to play** button (opens the tutorial any time).
- Continue/New marker if saved progress exists.
- Sound toggle. No external links.

## 4. Tutorial
- 3 to 5 steps. Never more than 5.
- Reachable from the menu at any time and offered automatically on first play.
- Skippable at every step, with no penalty. Replayable from the menu.
- Each step: the player does one action, gets clear feedback, then moves on.
- Step order: (1) the goal, (2) the basic move, (3) one special rule or twist, (4) a short practice round, (5) optional: how to win/earn a badge.
- Every drag action has a tap alternative.
- A step cannot dead-end. A wrong action gets a friendly nudge.

## 5. Mascot
- One shared family style (default, confirm): same eye shape, outline weight and proportions, different animal/character, colour and costume per game.
- Original only. SVG drawn for this project.
- Tone by category:
  - Little Ones (4-6): silent, animation and sound only.
  - Explorers (7-10): short friendly sentences, max about 12 words per bubble.
  - Challengers (11-16): brief, respectful, not babyish.
  - Adults (17+) (default, confirm): a restrained emblem or small guide mark instead of a cartoon character.
- The mascot never blocks the board and can be dismissed.
- Speech bubbles use 16px+ text and 4.5:1 contrast.

## 6. `game.json` additions
```json
{
  "goal": "Fill the ten-frame so both parts make 10.",
  "howToWin": "Complete 5 frames without a wrong answer.",
  "controls": "tap",
  "difficulty": ["easy", "medium", "hard"],
  "ruleVariant": null,
  "about": "Optional one-line origin or culture note.",
  "tutorialSteps": 4,
  "mascot": "name-of-mascot"
}
```
`ruleVariant` is required for traditional games whose rules differ by region. `controls` is `tap`, `drag`, `tap+drag`, `keys`, etc.

## 7. During play
- Visible goal reminder on the play screen.
- Whose turn it is, clear at all times in multi-player or vs-computer games.
- Feedback on every move (visual plus synthesised sound), never colour alone.
- Friendly failure ("Try again!", never "Wrong!"). No timers by default in children's games.
- Hint button where it makes sense. Undo where the rules allow it.
- "?" opens a one-screen rules card: the goal, how a turn works, how to win, and 1-2 tips.

## 8. Result screens and traditional-game rules
- The result screen says **why** the player won, lost or finished, shows progress or badges, and offers **Play again**, **How to play** and **Home**.
- Traditional and folk games must state the rule set used on the "?" card and in `ruleVariant`, and record the choice in `DECISIONS.md`.

## 9. Onboarding by category
| Category | Style |
|---|---|
| Little Ones (4-6) | No reading. Silent mascot, animated demo, then the child tries it. 64px targets. |
| Explorers (7-10) | Short sentences, mascot-led, 3-4 tutorial steps, simple "?" card. |
| Challengers (11-16) | Quick tutorial, compact rules card, difficulty picker. Not babyish. |
| Adults (17+) | Skippable tutorial, compact rules card, restrained emblem. |
| Family | Clear "who goes first" and a pass-the-phone prompt, plus the shared rules card. |

## 10. Grown-up corner (children's categories)
For Little Ones and Explorers games, a small section behind the grown-up gate: what the game teaches, that it works offline, that nothing is collected. Any external link lives only here.

## 11. Accessibility for onboarding
- Keyboard and tap both work through the tutorial.
- Tutorial text is 16px or larger, 4.5:1 contrast, left-aligned.
- Nothing is taught by colour alone or sound alone.
- Reduced motion: mascot animations switch to fades or stills.
- Tutorial and "?" content work at 360px wide.

## 12. Done checklist (every game must pass)
- [ ] Title screen has mascot, name, one-sentence goal, Play, How to play, sound toggle
- [ ] First visit offers the tutorial; it is skippable and replayable from the menu
- [ ] Tutorial is 3-5 steps, learn-by-doing, no dead ends
- [ ] "?" button on the play screen opens a one-screen rules card
- [ ] Result screen explains why, with Play again / How to play / Home
- [ ] Visible goal reminder and clear turn indicator during play
- [ ] Friendly failure messages; no timer by default in children's games
- [ ] Every drag has a tap alternative
- [ ] Mascot is original SVG, matches the shared style, and follows the tone for its category
- [ ] `game.json` includes all section 6 fields
- [ ] Traditional games state their rule set and record it in `DECISIONS.md`
- [ ] Grown-up corner present (children's categories)
- [ ] Tested at 360px; a first-time player can start playing within 30 seconds
- [ ] Watched at least one new player (or a parent) try it, and noted where they got stuck in `DECISIONS.md`
