# UI Assets (branding/ui)

Purpose: single source of truth for visual assets used by the Reservation UI (capsule, blister empty, aluminum tile) with normalized sizes and retina density pairs.

Assets
- capsule1x.png / capsule2x.png
  - 1x: 166×122 px
  - 2x: 332×244 px (exactly 2×)
- blister_vide1x.png / blister_vide2x.png
  - 1x: 183×99 px
  - 2x: 366×198 px (exactly 2×)
- aluminium1x.png / aluminium2x.png
  - 1x: 64×64 px (tile)
  - 2x: 128×128 px (exactly 2×)

Usage in CSS
- Images are embedded via `image-set()` using base64 HTML fragments at repo root: `Capsule1x_b64.html`, `Capsule2x_b64.html`, `Blister1x_b64.html`, `Blister2x_b64.html`, `Aluminium1x_b64.html`, `Aluminium2x_b64.html`.
- Calendar tile background is applied to `#vue-calendrier.carte` when `body` has classes `els-ui-theming els-aluminium`.

Maintenance
1) Validate asset normalization
   - Windows PowerShell: `./VERIFY-UI-ASSETS.ps1`
   - Confirms that 2x dimensions are exactly double 1x.
2) Rebuild base64 HTML embeds after changing PNGs
   - Windows PowerShell: `./Build-AssetEmbeds.ps1`
   - Writes the HTML fragments at repo root (no BOM, single-line base64).

Notes
- Keep transparent backgrounds and tight cropping (no extra margins).
- Do not change filenames; CSS expects these asset pairs.
- No external dependencies are required for the above scripts.

