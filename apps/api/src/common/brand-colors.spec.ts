import { brandCss, brandCssVars, brandScale, contrastRatio, DEFAULT_BRAND_COLORS, HexColorSchema } from '@marketbd/shared';
import { describe, expect, it } from 'vitest';

describe('brand colours', () => {
  it('keeps the chosen colour at its anchor shade and gets lighter/darker around it', () => {
    const primary = brandScale('#6d28d9', 'primary');
    expect(primary[700]).toBe('#6d28d9');
    expect(primary[50]).toMatch(/^#f[0-9a-f]{5}$/); // near white
    expect(primary[950] < primary[700]).toBe(true); // darker (hex sorts by red channel first)
    expect(brandScale('#f59e0b', 'accent')[500]).toBe('#f59e0b');
  });

  it('only overrides colours that differ from the defaults', () => {
    expect(brandCss(DEFAULT_BRAND_COLORS)).toBe('');
    const vars = brandCssVars({ primary: '#6d28d9', accent: DEFAULT_BRAND_COLORS.accent });
    expect(Object.keys(vars)).toHaveLength(11);
    expect(vars['--color-primary-700']).toBe('#6d28d9');
    expect(vars['--color-accent-500']).toBeUndefined();
  });

  it('validates hex colours and measures contrast with white text', () => {
    expect(HexColorSchema.parse('#6D28D9')).toBe('#6d28d9');
    expect(HexColorSchema.safeParse('purple').success).toBe(false);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrastRatio('#08755a', '#ffffff')).toBeGreaterThan(4.5);
    expect(contrastRatio('#ffeb3b', '#ffffff')).toBeLessThan(3);
  });
});
