import { Colors } from '@/constants/theme';

/** WCAG contrast ratio between two "#rrggbb" colors. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe.each(['light', 'dark'] as const)('%s theme', (scheme) => {
  const c = Colors[scheme];

  test.each([
    ['text', c.text],
    ['secondary text', c.textSecondary],
    ['tint', c.tint],
    ['danger', c.danger],
  ])('%s is readable (4.5:1) on the background and on element fills', (_name, color) => {
    expect(contrast(color, c.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color, c.backgroundElement)).toBeGreaterThanOrEqual(4.5);
  });

  test('text on the tint color is readable (4.5:1)', () => {
    expect(contrast(c.onTint, c.tint)).toBeGreaterThanOrEqual(4.5);
  });

  test('control outlines stand out (3:1) against the background and element fills', () => {
    expect(contrast(c.controlBorder, c.background)).toBeGreaterThanOrEqual(3);
    expect(contrast(c.controlBorder, c.backgroundElement)).toBeGreaterThanOrEqual(3);
  });

  test('a switch track that is off stands out (3:1) against the background', () => {
    expect(contrast(c.switchTrackOff, c.background)).toBeGreaterThanOrEqual(3);
  });
});
