import { bn } from './bn.js';
import { type Dictionary, en } from './en.js';

/**
 * Bangla UI is turned off: the apps run in English only and hide the language switch.
 * Set to true to bring back the বাংলা toggle (all Bangla strings are kept below).
 */
export const BANGLA_ENABLED = false;

/** Cookie the web apps use to remember the UI language. */
export const LOCALE_COOKIE = 'mbd_locale';

/** UI strings shared by the web and mobile apps (English + Bangla). */
export type UiLocale = 'en' | 'bn';
export const dictionaries: Record<UiLocale, Dictionary> = { en, bn };
export const isUiLocale = (v: unknown): v is UiLocale => v === 'en' || v === 'bn';

/** Replaces {key} placeholders. */
export const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));

export type { Dictionary };
