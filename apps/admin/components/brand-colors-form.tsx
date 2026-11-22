'use client';

import { errorMessage, useUpdateSettingsMutation } from '@marketbd/api-client';
import { type BrandTheme, brandCssVars, contrastRatio, DEFAULT_BRAND_COLORS, HexColorSchema } from '@marketbd/shared';
import { AlertTriangle, Palette, RotateCcw } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, cn, Logo } from '@marketbd/ui';

/** Ready-made pairs (primary, accent) to start from. */
const PRESETS: { name: string; theme: BrandTheme }[] = [
  { name: 'Green + Orange (default)', theme: DEFAULT_BRAND_COLORS },
  { name: 'Purple + Amber', theme: { primary: '#6d28d9', accent: '#f59e0b' } },
  { name: 'Blue + Orange', theme: { primary: '#1d4ed8', accent: '#f97316' } },
  { name: 'Teal + Coral', theme: { primary: '#0f766e', accent: '#f43f5e' } },
  { name: 'Red + Navy', theme: { primary: '#b91c1c', accent: '#1e3a8a' } },
  { name: 'Forest + Gold', theme: { primary: '#065f46', accent: '#d97706' } },
];

const FIELDS: { key: keyof BrandTheme; label: string; hint: string; minContrast: number }[] = [
  { key: 'primary', label: 'Primary colour', hint: 'Header, buttons, links and the logo mark', minContrast: 4.5 },
  { key: 'accent', label: 'Accent colour', hint: 'Prices, offers, badges and "Buy now"', minContrast: 3 },
];

function ColorField({ label, hint, value, onChange, error }: { label: string; hint: string; value: string; onChange: (v: string) => void; error?: string }) {
  const valid = HexColorSchema.safeParse(value).success;
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-md border border-ink-200 bg-white p-1"
        />
        <input
          aria-label={`${label} hex`}
          className="input font-mono uppercase"
          value={value}
          maxLength={7}
          onChange={(e) => onChange(e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)}
        />
      </div>
      <p className={cn('mt-1 text-xs', error ? 'text-danger' : 'text-ink-400')}>{error ?? hint}</p>
    </div>
  );
}

/** Admin → Settings: the two brand colours, with a live preview and readability check. */
export function BrandColorsForm({ theme }: { theme: BrandTheme }) {
  const [update, state] = useUpdateSettingsMutation();
  const [draft, setDraft] = useState<BrandTheme>(theme);
  const valid = { primary: HexColorSchema.safeParse(draft.primary).success, accent: HexColorSchema.safeParse(draft.accent).success };
  const ready = valid.primary && valid.accent;
  const changed = draft.primary.toLowerCase() !== theme.primary || draft.accent.toLowerCase() !== theme.accent;
  // Preview scope: the same CSS variables the site uses, but only inside the preview box.
  const previewVars = (ready ? brandCssVars(draft, { full: true }) : {}) as CSSProperties;
  const warnings = FIELDS.filter((f) => valid[f.key] && contrastRatio(draft[f.key], '#ffffff') < f.minContrast).map(
    (f) => `${f.label}: white text is hard to read on ${draft[f.key].toUpperCase()} (contrast ${contrastRatio(draft[f.key], '#ffffff').toFixed(1)}:1, aim for ${f.minContrast}:1).`,
  );

  const save = async () => {
    try {
      await update({ brandPrimary: draft.primary, brandAccent: draft.accent }).unwrap();
      toast.success('Brand colours saved — the storefront updates right away');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <section className="card space-y-5 p-5">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <Palette className="size-5 text-primary-700" /> Brand colours
        </h3>
        <p className="mt-1 text-sm text-ink-600">Two colours drive the whole storefront and this panel. Lighter and darker shades are generated automatically.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const active = p.theme.primary === draft.primary.toLowerCase() && p.theme.accent === draft.accent.toLowerCase();
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => setDraft(p.theme)}
              aria-pressed={active}
              className={cn('flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs', active ? 'border-ink-900 font-semibold' : 'border-ink-200 hover:border-ink-400')}
            >
              <span className="flex">
                <span className="size-4 rounded-full border border-white" style={{ background: p.theme.primary }} />
                <span className="-ml-1.5 size-4 rounded-full border border-white" style={{ background: p.theme.accent }} />
              </span>
              {p.name}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <ColorField
            key={f.key}
            label={f.label}
            hint={f.hint}
            value={draft[f.key]}
            onChange={(v) => setDraft({ ...draft, [f.key]: v })}
            error={valid[f.key] ? undefined : 'Use a colour like #08755a'}
          />
        ))}
      </div>

      <div style={previewVars} className="rounded-lg border border-ink-100 bg-canvas p-4" aria-label="Preview">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Preview</p>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-white p-4 shadow-card">
          <span className="pointer-events-none">
            <Logo />
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="primary">Official store</Badge>
            <span className="rounded bg-accent-500 px-1.5 py-0.5 text-[11px] font-bold text-white">-25%</span>
            <span className="text-lg font-bold text-accent-600">৳1,499</span>
            <span className="text-sm font-medium text-primary-700 underline">View details</span>
          </div>
          <div className="flex gap-2">
            <span className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white">Add to cart</span>
            <span className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white">Buy now</span>
          </div>
        </div>
        <div className="mt-3 flex gap-1" aria-hidden="true">
          {(['primary', 'accent'] as const).map((k) =>
            [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((s) => (
              <span key={`${k}${s}`} title={`${k}-${s}`} className="h-4 flex-1 first:rounded-l last:rounded-r" style={{ background: `var(--color-${k}-${s})` }} />
            )),
          )}
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          {warnings.map((w) => (
            <p key={w} className="flex gap-2">
              <AlertTriangle className="size-4 shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => setDraft(DEFAULT_BRAND_COLORS)} disabled={draft.primary === DEFAULT_BRAND_COLORS.primary && draft.accent === DEFAULT_BRAND_COLORS.accent}>
          <RotateCcw className="size-4" /> Reset to default
        </Button>
        <Button onClick={() => void save()} loading={state.isLoading} disabled={!ready || !changed}>
          Save colours
        </Button>
      </div>
    </section>
  );
}
