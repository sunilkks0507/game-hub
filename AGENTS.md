# AGENTS.md: rules for anyone (human or AI) working in this repo

Game Hub is a free, offline-first PWA holding small thinking games for children and adults. One static site, no backend, deployed to GitHub Pages.

## Read first
1. This file.
2. `DECISIONS.md` (settled choices, 3 lines each).
3. The spec of the game you are working on: `src/games/<id>/MASTER_SPEC.md`.

## Non-negotiable rules
1. Offline first. After the first load, no network is needed.
2. Free only. No paid libraries, services or assets. Ask before adding anything that could cost money.
3. No ads, accounts, analytics, push notifications, in-app purchases, or external links a child can tap without a grown-up gate.
4. Collect no personal data. Only local settings, stats and badges stay on the device.
5. Tap targets 44px minimum (64px for ages 4-6). Text 16px or larger. 4.5:1 contrast. Never rely on colour alone. Respect reduced motion. Keyboard play works.
6. Works at 360px wide on a mid-range Android phone. Design portrait first.
7. Original art and sound only: SVG and synthesised Web Audio. No copyrighted characters, images or fonts.
8. Pure rules logic lives in `engine.js` with no DOM, and has unit tests (`node --test`).
9. Plain JavaScript, ES modules, zero dependencies, no build step unless truly needed.
10. `localStorage` only, wrapped in try/catch, keys named `hub:<gameId>:<name>:v1`.
11. Never commit secrets. `.env.example` lists names only.
12. Small steps. Commit after every working step using `feat:`, `fix:`, `docs:`, `chore:`, `style:`. Prove it works before saying "done".

## Working style
- Write a short plan (max 10 bullets) and wait for "go" before a big build step.
- Explain each major action in one or two plain sentences. The owner is a beginner on the front end.
- Ask before big decisions: stack, new dependency, hub integration option.
- Never delete files or run destructive commands without asking.
- Before saying "done", run the app and the tests and list what was checked.

## Layout
```
/src
  index.html  sw.js  manifest.webmanifest   hub shell, ONE service worker
  /hub        picker UI
  /shared     sound.js  storage.js  dialog.js  tokens.css
  /games/<id> index.html  js/  css/  game.json  MASTER_SPEC.md  tests/
/tests        hub and shared tests
/scripts      build-game-list, icon generator
```

## Onboarding standard
Every game follows `GAME_ONBOARDING_STANDARD.md` (title screen, 3-5 step tutorial, "?" rules card, result screen that says why, `game.json` fields, mascot or emblem).
