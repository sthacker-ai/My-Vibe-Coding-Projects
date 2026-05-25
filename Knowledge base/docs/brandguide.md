# KnowledgeBase Brand Guide

## Identity

**App name:** KnowledgeBase  
**Tagline:** Turn liked posts into lasting knowledge.  
**Voice:** Focused, practical, personal. Not corporate, not academic.

## Logo Mark

Two overlapping rounded squares — one indigo (top-left) and one amber (bottom-right).  
They represent the dual flow of the system: **input** (raw saved content) and **output** (synthesised knowledge).

- Top-left square: `--brand` #5B4CF5 (indigo) — structured knowledge, courseware
- Bottom-right square: `--amber` #F59E0B (amber) — raw imports, sources in flight

Do not use the text name without the mark at sizes above 16px.

## Color Palette

### Primary
| Token | Hex | Use |
|---|---|---|
| `--brand` | `#5B4CF5` | Active nav, primary buttons, links |
| `--brand-light` | `#7B6FF8` | Hover states, accents |
| `--brand-dim` | `rgb(91 76 245 / 10%)` | Active nav background, chips |

### Status Colors
| Token | Hex | Meaning |
|---|---|---|
| `--amber` `#F59E0B` | Amber | Imported / raw / in-flight sources |
| `--green` `#22C55E` | Green | Extracted / classified / complete |
| `--blue` `#3B82F6` | Blue | Extracted, info states |
| `--purple` `#8B5CF6` | Purple | Classified, AI-processed |
| `--red` `#EF4444` | Red | Error, failed processing |

### Source processing status → color mapping
| Status | Color |
|---|---|
| `imported` | Amber |
| `extracted` | Blue |
| `classified` | Purple |
| `course_generated` | Green |
| `error` | Red |

### Backgrounds
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#F4F5FB` | Page background |
| `--surface` | `#FFFFFF` | Cards, sidebar, panels |
| `--surface-alt` | `#F0F2F9` | Hover states, subtle fills |

### Text
| Token | Hex | Use |
|---|---|---|
| `--text` | `#0D1120` | Primary body text |
| `--text-sub` | `#5A6275` | Secondary / labels |
| `--muted` | `#95A0B5` | Metadata, timestamps |

### Borders
| Token | Use |
|---|---|
| `--border` `#E4E7F0` | Default card/divider borders |
| `--border-strong` `#D0D5E8` | Elevated borders |

## Typography

**Font:** Inter (system fallback: ui-sans-serif, system-ui, -apple-system)  
**Mono font:** ui-monospace, SFMono-Regular, Consolas (used for IDs, counts, paths)

| Role | Size | Weight |
|---|---|---|
| Hero headline | clamp(1.45rem, 2.8vw, 2rem) | 800 |
| Section title | 0.97rem | 700 |
| Body | 0.88–0.9rem | 400–600 |
| Labels / caps | 0.67–0.72rem | 700, uppercase |
| Stat values | 2.1rem | 800, monospace |

## Layout

**Shell:** 3-column grid — `240px sidebar | flex-1 workspace | 280px right panel`  
Collapses to 2-col at ≤1300px, single-col at ≤900px.

**Hero banner:** Dark gradient (`#0D0F1C → #1C1860`) at top of workspace with purple and amber glow accents — inspired by Learnify's dark hero approach.

**Stat cards:** White cards with a 3px colored bottom border using the status color — inspired by Eduvi's underline accent pattern.

**Tables:** Clean rows with hover highlight (`--surface-alt`), no heavy borders.

**Badges:** Pill-shaped with dot prefix, colored per status mapping above.

## Component Patterns

### Stat card
```
┌─────────────────────────┐
│ [icon]                  │
│                         │
│ 20       ← big number   │
│ Sources  ← label        │
│ Ready to extract ← sub  │
│▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄ │ ← 3px amber bottom border
└─────────────────────────┘
```

### Status badge
```
● imported     (amber bg, amber text)
● extracted    (blue bg, blue text)
● classified   (purple bg, purple text)
● course_generated  (green bg, green text)
```

### Pipeline step
```
(✓) Step 1    ← green dot = done
(2) Step 2    ← brand dot = next/active
( ) Step 3    ← gray dot = queued
```

## Do / Don't

**Do:**
- Use amber for anything "in the pipeline but not done"
- Use green exclusively for completed/learned states
- Keep the hero banner dark — it anchors the page visually
- Use monospace for all IDs, counts, paths, and technical values

**Don't:**
- Mix the brand (indigo) with amber for the same element
- Use red for anything that isn't an error or failed state
- Add color to the sidebar background — keep it pure white
