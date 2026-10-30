# DESIGN_SYSTEM

One base token set for the whole hub. Each game overrides only its accent colour. Design for 360px portrait first, then scale up.

## Tokens (`src/shared/tokens.css`)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#FAF7F2` | Page background |
| `--surface` | `#FFFFFF` | Cards, dialogs |
| `--text` | `#1F1A17` | Body text (contrast on `--bg` is well above 4.5:1) |
| `--text-muted` | `#5C524B` | Secondary text (4.5:1 or better on `--bg`) |
| `--accent` | per game | Buttons, highlights. Chaturanga: `#8C3B1E` |
| `--accent-text` | `#FFFFFF` | Text on accent (check 4.5:1 for each game) |
| `--ok` | `#1B6E3A` | Success |
| `--warn` | `#8A5A00` | Warning, check |
| `--focus` | `#1D4ED8` | Focus ring (3px) |
| `--radius` | `12px` | Cards and buttons |
| `--space` | `4 / 8 / 12 / 16 / 24 / 32px` | Spacing scale |

Dark mode is out of scope for now. Revisit after the first three games.

## Type
- System font stack only, no web fonts (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`).
- Body 16px minimum, line height 1.5, left aligned, 60-70 characters per line at most.

## Targets and layout
- Tap targets 44px minimum (64px for ages 4-6 games). Extend hit areas to the screen edge.
- 16px side gutter. No horizontal scroll at 360px.
- Every drag has a tap alternative.

## Never colour alone
Pair every colour cue with a shape, icon, ring or label. Pieces and states must read in greyscale.

## Motion and sound
- Short, simple animations (under 250 ms). With `prefers-reduced-motion`, switch to fades or stills.
- Sound is synthesised with Web Audio, starts only after a tap, and has a mute toggle.

## Components (shared, to be built as needed)
`button`, `dialog`, `toast`, `rules-card`, `result-card`, `settings-sheet`, `game-card` (for the picker).
