ELS Brand Theme (Phase 1)
=========================

**Note:** The legacy theme CSS file has been removed from the repository.


Scope
- Weekly calendar UI and the “réserver votre livraison” modals.
- CSS-only brand layer: no markup or JS changes.

Files
- `branding/assets/` (place your logos here):
  - `logo-complet.svg`
  - `logo-complet-blanc.svg`
  - `logo-els.svg`
  - `els-icone.svg`
  - `els-icone.png`
  - `pilulier-reference.png` (visual reference for blister/pill pattern)

How to include
- The theme file has been removed; no additional CSS inclusion is required.
- Manually test critical flows (calendar selection → modal → panier → finalisation).

Design intent (B2B santé/logistique)
- Palette: medical blue (trust), teal (competence), green (success), red (urgent), high-contrast neutrals.
- Weekly calendar: selected day uses a subtle “blister” dot pattern to echo pill boxes.
- Urgent slots: red with faint safety stripes for color-blind friendliness; no aggressive motion.
- Focus states: thick, accessible focus rings tuned for keyboard users.

Pilulier reference
- The image `branding/assets/pilulier-reference.png` is a design reference only in Phase 1.
- The theme encodes the blister look via CSS gradients (`--pattern-pill`); no direct image usage to avoid HtmlService asset routing.

Notes
- The theme overrides only CSS variables and visual rules; ARIA roles and DOM structure remain unchanged.
- If you need the theme outside the reservation screen, it is safe to include in other templates after their base CSS.
