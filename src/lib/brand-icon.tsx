import type { ReactElement } from 'react';

// "Reefer Frost" marks, approximated from the OKLCH theme tokens as
// concrete hex — ImageResponse needs literal CSS colors. BRAND_STEEL
// tracks --primary: oklch(0.496 0.075 207.4) (chilled cyan-teal, as of
// 2026-08-19, replacing the earlier steel/cobalt blue); update this if
// --primary ever changes again.
export const BRAND_STEEL = '#1f6e78';
export const BRAND_PALE = '#eef3f2';

/**
 * The stockkit "S" app mark for ImageResponse-generated icons. stockkit's
 * display font is Fraunces (shared family face, see
 * docs/business/2026-08-13-typography-family-standard.md), a serif, so this
 * uses the same Georgia stand-in as qkit.
 */
export function brandIcon(size: number): ReactElement {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: BRAND_STEEL,
        color: BRAND_PALE,
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontWeight: 700,
        fontSize: size * 0.62,
        lineHeight: 1,
        borderRadius: size * 0.22,
      }}
    >
      S
    </div>
  );
}
