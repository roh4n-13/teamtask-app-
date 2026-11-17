// Placeholder images for Phase 1 (no real photos yet).
// These are small inline SVG data URIs in the Figma theme (charcoal + gold),
// used as "before photo" and seeded submitted-photo stand-ins.
// Real photos come from the camera/gallery in Phase 2 (Supabase Storage).

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** A gallery-wall style placeholder (used for "before photo"). */
export const PLACEHOLDER_BEFORE = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <rect width="600" height="400" fill="#1A1A1A"/>
  <rect x="40" y="60" width="200" height="150" fill="none" stroke="#D4A024" stroke-width="6"/>
  <rect x="60" y="80" width="160" height="110" fill="#2A2A2A"/>
  <circle cx="140" cy="125" r="28" fill="#D4A024" opacity="0.85"/>
  <rect x="280" y="60" width="140" height="110" fill="none" stroke="#D4A024" stroke-width="4"/>
  <rect x="292" y="72" width="116" height="86" fill="#232323"/>
  <rect x="460" y="60" width="100" height="150" fill="none" stroke="#C82828" stroke-width="4"/>
  <rect x="40" y="250" width="520" height="10" fill="#D4A024" opacity="0.35"/>
  <text x="300" y="320" font-family="sans-serif" font-size="22" fill="#F5EBD0" text-anchor="middle">Gallery wall — before photo</text>
</svg>`);

/** An artwork-label style placeholder (used for seeded submitted photos). */
export const PLACEHOLDER_SUBMITTED = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <rect width="600" height="400" fill="#232323"/>
  <rect x="90" y="50" width="420" height="240" fill="#1A1A1A" stroke="#D4A024" stroke-width="6"/>
  <rect x="120" y="80" width="360" height="130" fill="#2E2A1A"/>
  <circle cx="300" cy="145" r="42" fill="#D4A024"/>
  <rect x="140" y="235" width="320" height="8" fill="#D4A024" opacity="0.5"/>
  <text x="300" y="340" font-family="sans-serif" font-size="22" fill="#F5EBD0" text-anchor="middle">Work completed — photo proof</text>
</svg>`);

/** Small avatar placeholder (initials on charcoal). */
export function avatarPlaceholder(initials: string): string {
  return svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="48" fill="#1A1A1A"/>
  <circle cx="48" cy="48" r="46" fill="none" stroke="#D4A024" stroke-width="3"/>
  <text x="48" y="60" font-family="sans-serif" font-size="34" font-weight="bold" fill="#D4A024" text-anchor="middle">${initials}</text>
</svg>`);
}
