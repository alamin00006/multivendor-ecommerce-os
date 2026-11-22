'use client';

import { usePublicSettingsQuery } from '@marketbd/api-client';
import { brandCss, type BrandTheme } from '@marketbd/shared';
import { useEffect } from 'react';

const LIVE_ID = 'brand-theme-live';

/**
 * Server-rendered brand colours, so the first paint already uses the admin's colours.
 * Render it inside <head>; it outputs nothing when both colours are the defaults.
 */
export function BrandStyle({ theme }: { theme: BrandTheme | null | undefined }) {
  const css = theme ? brandCss(theme) : '';
  return css ? <style id="brand-theme" dangerouslySetInnerHTML={{ __html: css }} /> : null;
}

/**
 * Keeps open pages in step with Admin → Settings: whenever the public settings change, a separate
 * <style> after the server one receives both full scales (it wins the cascade, including a reset
 * back to the default colours). Mounted once by AppProviders.
 */
export function BrandThemeSync() {
  const { data } = usePublicSettingsQuery();
  const primary = data?.theme.primary;
  const accent = data?.theme.accent;

  useEffect(() => {
    if (!primary || !accent) return;
    let el = document.getElementById(LIVE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = LIVE_ID;
      document.head.appendChild(el);
    }
    el.textContent = brandCss({ primary, accent }, { full: true });
  }, [primary, accent]);

  return null;
}
