ELS Theme Micro‑Guidelines
==========================

Do / Don’t
- Do: use brand gradient `#8e44ad → #3498db` for primary CTAs and key selections.
- Do: keep specificity low using `:where(...)`; avoid `!important` unless overriding inline styles.
- Do: maintain AA contrast (≥ 4.5:1 for text, ≥ 3:1 for UI elements).
- Do: use system fonts (optional local "Montserrat"), no external assets.
- Don’t: introduce green or orange hues; use blue/violet spectrum and red only for errors/urgent.
- Don’t: remove native focus outlines; add a second halo layer instead.

Contrast Minimums
- Body text on surfaces: AA ≥ 4.5:1 (light: `#1e2430` on `#ffffff`/`#f7f8fb`; dark: `#e9edf5` on `#151c2c`).
- Buttons/links: ensure text over gradient meets AA; otherwise add inner text-shadow or darker overlay.
- Tabs (weekday headers): `--els-tab-text` on `--els-tab-bg` must meet AA.

Margins & Spacing
- Use `--els-space-1..6` (4,8,12,16,24,32px). Typical blocks: 16–24px; inline gaps: 8–12px.
- Calendar cells spacing mirrors pilulier compartments; prefer consistent grid gaps.

Logo Usage
- Current source: inline SVG in `Logo.html`; `branding/assets/logo-complet.svg` and `logo-complet-blanc.svg` are not tracked yet.
- When provided, prefer `branding/assets/logo-complet.svg` on light and `logo-complet-blanc.svg` on imagery or gradients.
- Clear space: ≥ `--els-space-6` around the logo; avoid placing over busy textures.
- Do not recolor the ELS gradient; reserve red strictly for error/urgent.

Pilulier Iconography via CSS Mask
- Use CSS masks for discrete pictos on weekday tabs and slot glyphs (no extra DOM):
  - Example mask (data‑URI) for a pill oval:
    `mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 12'><rect rx='6' width='24' height='12' fill='black'/></svg>");`
  - Apply a brand color as background behind the mask.
- Keep masks subtle; ensure AA for any masked foreground on backgrounds.

Focus Rings (Two Layers)
- Inner ring: solid `--els-focus-inner` (violet) 2px; outer halo: `--els-focus-outer` 4px.
- Use `:focus-visible` where possible; never remove native outline without replacement.

Skeleton Loading
- Use `.skeleton` class on surfaces that load dynamic content (e.g., calendar, slot grid) — shimmer is disabled under `prefers-reduced-motion: reduce`.

