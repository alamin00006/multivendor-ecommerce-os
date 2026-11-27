'use client';

import type { SellerReport } from '@marketbd/shared';
import { useState } from 'react';
import { cn } from '../primitives';
import { useI18n } from '../i18n';

/** Today's date in Dhaka as YYYY-MM-DD. */
export const dhakaToday = () => new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);
export const shiftDay = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const PRESETS = [
  { key: '7', label: 'Last 7 days', from: (t: string) => shiftDay(t, -6) },
  { key: '30', label: 'Last 30 days', from: (t: string) => shiftDay(t, -29) },
  { key: '90', label: 'Last 90 days', from: (t: string) => shiftDay(t, -89) },
  { key: 'month', label: 'This month', from: (t: string) => `${t.slice(0, 8)}01` },
] as const;

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Packing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return requested',
  RETURNED: 'Returned',
  REFUNDED: 'Refunded',
};

export interface ReportRange {
  from: string;
  to: string;
}

/** Date range state for a report page, starting with the last 30 days. */
export function useReportRange() {
  const [today] = useState(dhakaToday);
  const [range, setRange] = useState<ReportRange>({ from: shiftDay(today, -29), to: today });
  const [preset, setPreset] = useState<string>('30');
  return { today, range, setRange, preset, setPreset };
}

/** Preset buttons plus from/to date inputs. */
export function ReportRangeBar({ today, range, setRange, preset, setPreset }: ReturnType<typeof useReportRange>) {
  return (
    <div className="card flex flex-wrap items-center gap-2 p-3">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          aria-pressed={preset === p.key}
          onClick={() => {
            setPreset(p.key);
            setRange({ from: p.from(today), to: today });
          }}
          className={cn('rounded-full border px-3 py-1 text-sm', preset === p.key ? 'border-primary-700 bg-primary-50 font-semibold text-primary-800' : 'border-ink-200 text-ink-600')}
        >
          {p.label}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-2 text-sm">
        <input
          type="date"
          aria-label="From"
          className="input h-9 w-auto"
          value={range.from}
          max={range.to}
          onChange={(e) => {
            if (!e.target.value) return;
            setPreset('');
            setRange((x) => ({ ...x, from: e.target.value }));
          }}
        />
        <span className="text-ink-400">to</span>
        <input
          type="date"
          aria-label="To"
          className="input h-9 w-auto"
          value={range.to}
          min={range.from}
          max={today}
          onChange={(e) => {
            if (!e.target.value) return;
            setPreset('');
            setRange((x) => ({ ...x, to: e.target.value }));
          }}
        />
      </div>
    </div>
  );
}

/** Rounds the axis maximum up to a "nice" number so gridlines land on round taka values. */
const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
};

/** Daily sales bars with a hover card. `netLabel` names the second figure (earnings or commission). */
export function SalesChart({ daily, netLabel = 'You earn' }: { daily: SellerReport['daily']; netLabel?: string }) {
  const { money } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...daily.map((d) => d.gross)));
  const ticks = [1, 0.5, 0];
  const labelEvery = Math.ceil(daily.length / 8);
  const h = hover === null ? null : daily[hover];

  return (
    <figure className="relative">
      <div className="flex gap-2">
        <div className="flex h-56 w-16 shrink-0 flex-col justify-between text-right text-[11px] text-ink-400" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {money(max * t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
            {ticks.map((t) => (
              <span key={t} className={cn('border-t', t === 0 ? 'border-ink-300' : 'border-dashed border-ink-100')} />
            ))}
          </div>
          <div className="relative flex h-56 items-end" style={{ gap: daily.length > 45 ? 1 : 2 }} onMouseLeave={() => setHover(null)}>
            {daily.map((d, i) => (
              <button
                key={d.date}
                type="button"
                className="group flex h-full min-w-0 flex-1 items-end focus:outline-none"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${shortDay(d.date)}: ${money(d.gross)} from ${d.orders} orders`}
              >
                <span
                  className={cn('block w-full rounded-t-[4px] bg-primary-600 transition-colors', hover === i ? 'bg-primary-800' : hover !== null && 'bg-primary-300')}
                  style={{ height: d.gross ? `max(2px, ${(d.gross / max) * 100}%)` : 0 }}
                />
              </button>
            ))}
          </div>
          <div className="mt-1 flex text-[11px] text-ink-400" aria-hidden>
            {daily.map((d, i) => (
              <span key={d.date} className="min-w-0 flex-1 text-center">
                {i % labelEvery === 0 ? shortDay(d.date) : ''}
              </span>
            ))}
          </div>
          {h && hover !== null && (
            <div
              role="tooltip"
              className="pointer-events-none absolute top-0 z-10 w-44 rounded-lg bg-white p-2.5 text-xs shadow-raised ring-1 ring-ink-100"
              style={{ left: `clamp(0px, calc(${((hover + 0.5) / daily.length) * 100}% - 88px), calc(100% - 176px))` }}
            >
              <p className="font-semibold text-ink-900">{shortDay(h.date)}</p>
              <p className="mt-1 flex justify-between text-ink-600">
                Sales <span className="font-semibold text-ink-900">{money(h.gross)}</span>
              </p>
              <p className="flex justify-between text-ink-600">
                Orders <span className="font-semibold text-ink-900">{h.orders}</span>
              </p>
              <p className="flex justify-between text-ink-600">
                {netLabel} <span className="font-semibold text-ink-900">{money(h.net)}</span>
              </p>
            </div>
          )}
        </div>
      </div>
      <figcaption className="sr-only">Daily sales. Download the CSV for the full numbers.</figcaption>
    </figure>
  );
}

const csvCell = (v: string | number) => (typeof v === 'number' ? String(v) : `"${v.replace(/"/g, '""')}"`);

/** Downloads rows as a UTF-8 CSV (with BOM so Excel shows Bangla and ৳ correctly). */
export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
