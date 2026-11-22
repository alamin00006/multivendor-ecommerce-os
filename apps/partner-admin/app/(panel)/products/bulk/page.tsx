'use client';

import { errorMessage, type StockSheetRow, useSellerBulkStockMutation, useSellerStockSheetQuery } from '@marketbd/api-client';
import { type BulkStockResult, fromPoisha, toPoisha } from '@marketbd/shared';
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import Link from 'next/link';
import { type ChangeEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button, cn, EmptyState, PageHeader, Skeleton, Table, useI18n } from '@marketbd/ui';

const HEADER = ['sku', 'title', 'variant', 'price', 'stock'];

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

interface Change {
  row: number;
  sku: string;
  title: string;
  price?: number;
  stock?: number;
  current?: StockSheetRow;
  problem?: string;
}

/** Reads an uploaded sheet and compares it with the current values; only real changes are kept. */
function readSheet(text: string, current: StockSheetRow[]): Change[] {
  const rows = parseCsv(text);
  const head = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const at = (name: string) => head.indexOf(name);
  if (at('sku') < 0 || (at('price') < 0 && at('stock') < 0)) throw new Error('The file needs a "sku" column and a "price" and/or "stock" column. Download the template to start.');
  const bySku = new Map(current.map((r) => [r.sku.toUpperCase(), r]));
  const out: Change[] = [];
  rows.slice(1).forEach((r, i) => {
    const sku = (r[at('sku')] ?? '').trim();
    if (!sku) return;
    const cur = bySku.get(sku.toUpperCase());
    const rawPrice = at('price') >= 0 ? (r[at('price')] ?? '').trim().replace(/[৳,\s]/g, '') : '';
    const rawStock = at('stock') >= 0 ? (r[at('stock')] ?? '').trim() : '';
    const change: Change = { row: i + 2, sku, title: cur ? `${cur.title}${cur.variant !== 'Default' ? ` · ${cur.variant}` : ''}` : (r[at('title')] ?? ''), current: cur };
    if (rawPrice) {
      const n = Number(rawPrice);
      if (!Number.isFinite(n) || n <= 0) change.problem = `Price "${rawPrice}" is not a valid amount`;
      else if (!cur || toPoisha(n) !== cur.price) change.price = toPoisha(n);
    }
    if (rawStock) {
      const n = Number(rawStock);
      if (!Number.isInteger(n) || n < 0) change.problem = `Stock "${rawStock}" must be a whole number`;
      else if (!cur || n !== cur.stock) change.stock = n;
    }
    if (!cur) change.problem ??= 'SKU not found in your shop';
    if (change.problem || change.price !== undefined || change.stock !== undefined) out.push(change);
  });
  return out;
}

/** Seller Center → Products → Bulk update: change prices and stock for many SKUs with a spreadsheet. */
export default function BulkStockPage() {
  const { money } = useI18n();
  const { data: sheet, isLoading } = useSellerStockSheetQuery();
  const [apply, state] = useSellerBulkStockMutation();
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<BulkStockResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const download = () => {
    if (!sheet) return;
    const csv = [HEADER, ...sheet.map((r) => [r.sku, r.title, r.variant, fromPoisha(r.price), r.stock])].map((r) => r.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `price-stock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !sheet) return;
    setResult(null);
    try {
      setChanges(readSheet(await file.text(), sheet));
      setFileName(file.name);
    } catch (err) {
      setChanges(null);
      toast.error(err instanceof Error ? err.message : 'Could not read the file');
    }
  };

  const valid = changes?.filter((c) => !c.problem) ?? [];
  const problems = changes?.filter((c) => c.problem) ?? [];

  const submit = async () => {
    try {
      const res = await apply({ rows: valid.map((c) => ({ sku: c.sku, price: c.price, stock: c.stock })) }).unwrap();
      setResult(res);
      setChanges(null);
      toast.success(`${res.updated} variant${res.updated === 1 ? '' : 's'} updated`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <Link href="/products" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700">
        <ArrowLeft className="size-4" /> Products
      </Link>
      <PageHeader title="Bulk price & stock update" description="Download your price list, edit it in Excel or Google Sheets, then upload it back." />

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { n: 1, title: 'Download', text: `Your ${sheet?.length ?? ''} SKUs with today’s price (৳) and stock.`, action: <Button size="sm" variant="outline" onClick={download} disabled={!sheet?.length}><Download className="size-4" /> Download CSV</Button> },
          { n: 2, title: 'Edit', text: 'Change the price and stock columns only. Leave a cell empty to keep it as it is.' },
          { n: 3, title: 'Upload', text: 'Check the preview, then apply. Only changed rows are saved.', action: <Button size="sm" onClick={() => input.current?.click()} disabled={!sheet}><Upload className="size-4" /> Upload CSV</Button> },
        ].map((s) => (
          <div key={s.n} className="card flex flex-col gap-2 p-4">
            <p className="flex items-center gap-2 font-semibold">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary-700 text-xs text-white">{s.n}</span> {s.title}
            </p>
            <p className="flex-1 text-sm text-ink-600">{s.text}</p>
            {s.action}
          </div>
        ))}
      </div>
      <input ref={input} type="file" accept=".csv,text/csv" className="hidden" aria-label="Upload CSV" onChange={(e) => void onFile(e)} />

      {isLoading && <Skeleton className="h-32" />}

      {result && (
        <div className="card p-4">
          <p className="flex items-center gap-2 font-semibold text-primary-700">
            <CheckCircle2 className="size-5" /> {result.updated} variant{result.updated === 1 ? '' : 's'} updated
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-danger">
              {result.errors.map((e) => (
                <li key={`${e.row}-${e.sku}`}>
                  {e.sku}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {changes && (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
            <div>
              <h3 className="font-semibold">Preview · {fileName}</h3>
              <p className="text-xs text-ink-500">
                {valid.length} change{valid.length === 1 ? '' : 's'} ready{problems.length ? ` · ${problems.length} row${problems.length === 1 ? '' : 's'} with problems will be skipped` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setChanges(null)}>
                Discard
              </Button>
              <Button size="sm" onClick={() => void submit()} loading={state.isLoading} disabled={valid.length === 0}>
                Apply {valid.length} change{valid.length === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
          {changes.length === 0 ? (
            <EmptyState icon={<FileSpreadsheet />} title="Nothing changed" text="Every price and stock in the file matches your shop." />
          ) : (
            <Table head={['Row', 'SKU', 'Product', 'Price', 'Stock', '']}>
              {changes.map((c) => (
                <tr key={`${c.row}-${c.sku}`} className={cn(c.problem && 'bg-red-50/60')}>
                  <td className="px-4 py-2 text-xs text-ink-400">{c.row}</td>
                  <td className="px-4 py-2 font-mono text-xs">{c.sku}</td>
                  <td className="max-w-xs truncate px-4 py-2 text-sm">{c.title}</td>
                  <td className="px-4 py-2 text-sm">
                    {c.price !== undefined ? (
                      <>
                        {c.current && <span className="text-ink-400 line-through">{money(c.current.price)}</span>} <span className="font-semibold">{money(c.price)}</span>
                      </>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {c.stock !== undefined ? (
                      <>
                        {c.current && <span className="text-ink-400 line-through">{c.current.stock}</span>} <span className="font-semibold">{c.stock}</span>
                      </>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-danger">{c.problem}</td>
                </tr>
              ))}
            </Table>
          )}
        </section>
      )}
    </div>
  );
}
