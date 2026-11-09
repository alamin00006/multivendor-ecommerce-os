import { bn } from './bn.js';
import { type Dictionary, en } from './en.js';

/** UI strings shared by the web and mobile apps (English + Bangla). */
export type UiLocale = 'en' | 'bn';
export const dictionaries: Record<UiLocale, Dictionary> = { en, bn };
export const isUiLocale = (v: unknown): v is UiLocale => v === 'en' || v === 'bn';

/** Replaces {key} placeholders. */
export const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));

export type { Dictionary };
