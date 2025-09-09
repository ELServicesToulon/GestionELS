# UI Assets (branding/ui)

Purpose: single source of truth for visual assets used by the Reservation UI (capsule, blister empty, aluminum tile) with normalized sizes and retina density pairs.

Assets
- capsule1x.png / capsule2x.png
  - 1x: 166×122 px
  - 2x: 332×244 px (exactly 2×)
- blister_vide1x.png / blister_vide2x.png
  - 1x: 183×99 px
  - 2x: 366×198 px (exactly 2×)
- alu/aluminium1x.png / alu/aluminium2x.png
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

HtmlService workflow (Apps Script)
- Generate or update normalized assets
  - `npm run normalize:ui` (generic pass for capsule|pill|blister)
  - `npm run assets:normalize:pills` (produces pill-full/empty and blister-empty WebP+PNG at 1x/2x)
- Build base64 fragments consumed by Reservation_CSS.html
  - `npm run assets:build:b64` → writes `PillFull*_webp_b64.html`, `PillEmpty*_webp_b64.html`, `BlisterEmpty*_webp_b64.html`, `Aluminium*_b64.html` at repo root
- Update the aluminium tile CSS variables
  - `npm run embed:alu` → updates `branding/ui/alu/alu-embed.css` with `--alu-tile-1x/2x` and `--alu-size` (default 96px)
- Push to Apps Script (no JS logic changes required)
  - `npm run clasp:push`

Notes
- HtmlService uses inline base64 fragments (data URIs) to avoid network fetches. Ensure `*_webp_b64.html` are regenerated after asset changes.
- If existing filenames are referenced by CSS/HTML, prefer replacing the binary content while preserving the path; otherwise adjust CSS variables only.
- Keep colorimetry: gradient #8e44ad → #3498db for colored half; white half in #f4f6f8.

Notes
- Keep transparent backgrounds and tight cropping (no extra margins).
- Do not change filenames; CSS expects these asset pairs.
- No external dependencies are required for the above scripts.
