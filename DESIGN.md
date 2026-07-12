---
name: BTP Mali
description: Outil de gestion de chantiers pour PME maliennes du BTP — dark, dense, professionnel.

colors:
  void: "#080808"
  base: "#1C1C1C"
  raised: "#171717"
  card: "#232323"
  input-bg: "#1C1C1C"
  accent: "#F97316"
  accent-deep: "#EA580C"
  text-primary: "#F5F5F5"
  text-secondary: "#9CA3AF"
  text-tertiary: "#6B7280"
  text-ghost: "#4B5563"
  border-subtle: "rgba(255,255,255,0.06)"
  border-medium: "rgba(255,255,255,0.08)"
  status-success: "#10B981"
  status-warning: "#F59E0B"
  status-error: "#EF4444"
  status-info: "#3B82F6"

typography:
  display:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  subtitle:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  label:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.08em"
  caption:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0"

rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"

spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"

components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.text-primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.accent-deep}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-tertiary}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  stat-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "24px"
  nav-item-active:
    backgroundColor: "rgba(249,115,22,0.08)"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  nav-item-default:
    backgroundColor: "transparent"
    textColor: "{colors.text-tertiary}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  text-input:
    backgroundColor: "{colors.input-bg}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    height: "44px"
---

# Design System: BTP Mali

## 1. Overview

**Creative North Star: "The Field Commander's Control Room"**

BTP Mali is the cockpit of a construction site director — not an office SaaS, not a finance tool, not a startup dashboard. It's a control room used from a dusty Android phone at noon on a construction site in Bamako. The light is harsh, the hands may not be clean, and decisions happen fast. Every design choice serves that moment: high contrast, readable at a glance, responsive to a single thumb.

The atmosphere is dark by necessity and by character. Not dark for aesthetics, but because a director using this tool at midday under Mali sunlight needs maximum contrast. The single orange accent — construction orange, the color of safety vests and warning signs — is the only decoration. Everything else recedes: dark surfaces, muted borders, ghost text that appears only when needed.

What this system refuses: the multi-color dashboard (orange and green and blue and amber all at once, each competing for attention). The gradient button that signals "startup" instead of "tool". The section label that tells users what a menu is. The card grid that treats quick navigation the same as primary data.

**Key Characteristics:**
- Deep dark surface stack: `{colors.void}` / `{colors.base}` / `{colors.raised}` / `{colors.card}` — four tonal steps, each with a role.
- Single accent: `{colors.accent}` (#F97316, construction orange). Used on active nav, primary CTAs, and critical status. Not on decorative icon backgrounds.
- Plus Jakarta Sans throughout — geometric humanist, reads well at 13–14px on low-DPI screens.
- Muted borders via RGBA alpha (`rgba(255,255,255,0.06)`) rather than discrete gray values — they stay tonal on any dark surface.
- Status colors (`{colors.status-success}`, `{colors.status-warning}`, `{colors.status-error}`, `{colors.status-info}`) reserved for semantic meaning only: statut badges on chantiers, error messages, success toasts. Never for decoration.

## 2. Colors

Four dark surfaces plus one accent. That's the entire palette for UI chrome.

### Primary
- **Construction Orange** (`{colors.accent}` — #F97316): The signature accent. Active nav item backgrounds, primary CTA buttons, hover states, critical indicators. Used at 8% opacity as a tinted background for active states. Full saturation only on text and button fills.
- **Orange Deep** (`{colors.accent-deep}` — #EA580C): The press/hover-darker variant of Construction Orange. Appears on `:active` button states.

### Neutral — Surfaces
- **Void** (`{colors.void}` — #080808): The body background. Near-black, not pure black. The floor everything else sits on.
- **Base** (`{colors.base}` — #1C1C1C): Dashboard layout shell, login page background. One tonal step above Void.
- **Raised** (`{colors.raised}` — #171717): Sidebar, mobile header. Slightly darker than Base to read as a distinct layer without requiring a visible border.
- **Card** (`{colors.card}` — #232323): Content cards, stat panels. The topmost dark surface.
- **Input Background** (`{colors.input-bg}` — #1C1C1C): Form inputs — same as Base to create a recessed-into-surface feel.

### Neutral — Text
- **Primary Text** (`{colors.text-primary}` — #F5F5F5): Headings, active labels, key data values.
- **Secondary Text** (`{colors.text-secondary}` — #9CA3AF): Body descriptions, card subtitles.
- **Tertiary Text** (`{colors.text-tertiary}` — #6B7280): Nav items at rest, label annotations.
- **Ghost Text** (`{colors.text-ghost}` — #4B5563): Section dividers, placeholder text, timestamp prefixes.

### Neutral — Borders
- **Subtle Border** (`{colors.border-subtle}` — rgba(255,255,255,0.06)): Default card borders, sidebar border, input borders at rest.
- **Medium Border** (`{colors.border-medium}` — rgba(255,255,255,0.08)): Hover state borders, input focus before accent ring.

### Semantic (status only)
- **Success** (`{colors.status-success}` — #10B981): Chantier "en cours" badge, success toast, trial active indicator.
- **Warning** (`{colors.status-warning}` — #F59E0B): Chantier "en pause" badge, subscription expiry warning.
- **Error** (`{colors.status-error}` — #EF4444): Chantier "annulé" badge, form validation errors.
- **Info** (`{colors.status-info}` — #3B82F6): Chantier "preparation" badge.

**The One Voice Rule.** Construction Orange is the only accent color in the UI chrome. Status colors (green, amber, red, blue) appear only on semantic badges and system toasts. They never color icon containers, card borders, or step indicators.

## 3. Typography

**Font:** Plus Jakarta Sans (with `-apple-system, BlinkMacSystemFont, sans-serif` fallback)

**Character:** A geometric humanist sans that holds legibility at 13–14px on mid-range Android screens. Its slightly rounded geometry reads as modern-professional without crossing into startup-friendly territory.

### Hierarchy

- **Display** (700, 28px, lh 1.15, ls -0.03em): Page titles and major section headings.
- **Title** (700, 20px, lh 1.2, ls -0.025em): Section headings within pages, modal titles.
- **Subtitle** (600, 15px, lh 1.3, ls -0.01em): Card titles, form section headers.
- **Body** (400, 14px, lh 1.55): Card descriptions, form helper text, table cells.
- **Label** (600, 11px, lh 1.4, ls 0.08em, UPPERCASE): Form field labels, status badge text, date prefixes.
- **Caption** (500, 13px, lh 1.4): Nav items, button text, metadata annotations.

**The Negative Tracking Rule.** Display and Title sizes carry negative letter-spacing (-0.025em to -0.03em). At weight 700, Plus Jakarta Sans reads as too wide without it.

**The 44px Floor Rule.** Every interactive touch target must be at least 44px tall. This is a field-use product on mobile.

## 4. Elevation

Flat by default. Depth comes from the surface stack, not from shadows.

The four surface tones create visual layering through tonal contrast alone. Shadows are used in two cases only:

- **Accent glow** (`box-shadow: 0 8px 20px rgba(249,115,22,0.15)`): Under primary CTA buttons and the logo mark.
- **Dialog lift** (`box-shadow: 0 24px 48px rgba(0,0,0,0.5)`): For modals and drawers only.

**The Flat-By-Default Rule.** Cards and stat panels have no box-shadow. If something needs to feel elevated, change its background tint. Reserve shadow for state changes (hover on CTA) and floating elements (dialogs, toasts).

## 5. Components

### Buttons

- **Shape:** 12px radius (`{rounded.md}`).
- **Primary:** Solid `{colors.accent}` fill, `{colors.text-primary}` text, 44px minimum height. No gradients. Hover: `{colors.accent-deep}`. Active: `scale(0.97)` transform. Shadow: `0 8px 20px rgba(249,115,22,0.15)`.
- **Ghost / Inline:** Transparent background, `{colors.text-tertiary}` at rest, `{colors.text-primary}` on hover, 8px radius. For nav actions and quick links.
- **Destructive:** `rgba(239,68,68,0.07)` background, `text-red-400` text. No solid red fill.

### Stat Cards

- **Structure:** `{colors.card}`, `{rounded.md}`, 24px internal padding, `{colors.border-subtle}` border.
- **Icon treatment:** Icon in `{colors.text-ghost}` with no colored container. The number is the visual hero.
- **Number:** ~2rem, weight 700, `{colors.text-primary}`.
- **Hover:** Border steps to `{colors.border-medium}`.

### Cards / Containers

- **Corner Style:** 12px (`{rounded.md}`).
- **Shadow:** None. Elevation through tonal contrast.
- **Border:** 1px `{colors.border-subtle}`.
- **Internal Padding:** 24px standard.

### Inputs / Fields

- **Style:** `{colors.input-bg}` background, 1px `{colors.border-medium}` border, 8px radius (`{rounded.sm}`).
- **Focus:** Border shifts to `{colors.accent}`, `box-shadow: 0 0 0 3px rgba(249,115,22,0.12)`.
- **Labels:** 11px uppercase, 0.08em tracking, `{colors.text-tertiary}`.
- **Height:** 44px minimum.

### Navigation (Sidebar)

- **Container:** `{colors.raised}`, 260px wide, full-height.
- **Item at rest:** Transparent, `{colors.text-tertiary}`, 10px vertical / 12px horizontal padding, 8px radius.
- **Item active:** `rgba(249,115,22,0.08)` background, `{colors.accent}` text and icon, small 6px orange dot at right.
- **Logo mark:** Solid `{colors.accent}` fill, 36px, 12px radius. No gradient.

### Status Badges

Pill shape, 11px uppercase text. Colors listed in Semantic above. These colors exist ONLY on status badges.

## 6. Do's and Don'ts

### Do

- **Do** use solid `{colors.accent}` (#F97316) for primary buttons. One fill color, no gradient.
- **Do** keep the 4-level surface stack consistent. Each level has one purpose.
- **Do** size all touch targets to minimum 44px height.
- **Do** use status colors (green, amber, red, blue) exclusively for chantier status badges, form errors, and system toasts.
- **Do** make the number the visual hero on stat cards. The icon is secondary — ghost-colored, small, no decorative background.
- **Do** separate primary data (stat cards) from secondary navigation (quick links) through spacing and visual weight, not card structure.
- **Do** vary spacing between sections: tight groupings within sections (8–12px), generous separation between sections (32–48px).

### Don't

- **Don't** use gradient fills on buttons or logos (`bg-gradient-to-r from-orange-500 to-orange-600`). Solid orange is the rule.
- **Don't** apply status colors to icon containers, card backgrounds, or step indicators as decorative differentiation.
- **Don't** give every UI element the same card treatment. Quick navigation links are not the same category as stat data.
- **Don't** add section labels that describe what the section obviously is ("Menu principal" over a navigation menu).
- **Don't** use identical colors to differentiate sequential steps (orange step 1, blue step 2, green step 3). Steps are ordered by number, not hue.
- **Don't** look like: Malian government software (forms à rallonge, aucune hiérarchie). Excel with a dark theme (tables everywhere). Generic startup SaaS (gradient text, glassmorphism, identical card grids).
