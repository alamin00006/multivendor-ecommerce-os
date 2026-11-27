'use client';

import { useAdminActivityQuery, useAdminStaffQuery } from '@marketbd/api-client';
import { ADMIN_AREA_INFO, ADMIN_AREAS, type ActivityListQuery, type ActivityView } from '@marketbd/shared';
import { Badge, EmptyState, PageHeader, Pager, Skeleton, Table } from '@marketbd/ui';
import { History } from 'lucide-react';
import { useState } from 'react';

const METHOD_TONE: Record<string, 'success' | 'danger' | 'warning' | undefined> = { POST: 'success', DELETE: 'danger', PATCH: 'warning', PUT: 'warning' };
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const areaLabel = (area: string) => (area === 'owner' ? 'Staff' : area === 'any' ? 'General' : (ADMIN_AREA_INFO[area as keyof typeof ADMIN_AREA_INFO]?.label ?? area));

function Row({ a }: { a: ActivityView }) {
  const [open, setOpen] = useState(false);
  const hasDetails = a.details !== null && a.details !== undefined;
  return (
    <>
      <tr>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-500">{when(a.createdAt)}</td>
        <td className="px-4 py-3 font-medium">{a.actor?.name ?? 'Deleted account'}</td>
        <td className="px-4 py-3">
          <div className="text-sm">{a.summary ?? 'Change saved'}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
            <Badge tone={METHOD_TONE[a.method]}>{a.method}</Badge>
            <code className="break-all">{a.path}</code>
          </div>
        </td>
        <td className="px-4 py-3 text-xs">{areaLabel(a.area)}</td>
        <td className="px-4 py-3 text-right">
          {hasDetails && (
            <button type="button" className="text-xs font-medium text-primary-700 hover:underline" onClick={() => setOpen((v) => !v)}>
              {open ? 'Hide' : 'Details'}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="bg-ink-50 px-4 py-3">
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(a.details, null, 2)}</pre>
            {a.ip && <div className="mt-1 text-xs text-ink-500">IP: {a.ip}</div>}
          </td>
        </tr>
      )}
    </>
  );
}

export default function ActivityPage() {
  const [filters, setFilters] = useState<ActivityListQuery>({ page: 1, limit: 30 });
  const { data, isLoading } = useAdminActivityQuery(filters);
  const { data: staff } = useAdminStaffQuery();
  const set = (patch: Partial<ActivityListQuery>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  return (
    <div>
      <PageHeader title="Activity log" description="Every change made from the admin panel: who, what and when." />
      <div className="card">
        <div className="flex flex-wrap gap-2 border-b border-ink-100 p-3">
          <select className="input w-auto" value={filters.actorId ?? ''} onChange={(e) => set({ actorId: e.target.value || undefined })}>
            <option value="">All staff</option>
            {staff?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select className="input w-auto" value={filters.area ?? ''} onChange={(e) => set({ area: (e.target.value || undefined) as ActivityListQuery['area'] })}>
            <option value="">All sections</option>
            {ADMIN_AREAS.map((a) => (
              <option key={a} value={a}>{ADMIN_AREA_INFO[a].label}</option>
            ))}
            <option value="owner">Staff</option>
          </select>
          <input className="input max-w-xs" placeholder="Search action or path" value={filters.q ?? ''} onChange={(e) => set({ q: e.target.value || undefined })} />
        </div>
        {isLoading ? (
          <Skeleton className="m-4 h-40" />
        ) : (
          <Table head={['When', 'Staff', 'Action', 'Section', '']} empty={!data?.items.length ? <EmptyState icon={<History />} title="Nothing recorded yet" /> : null}>
            {data?.items.map((a) => <Row key={a.id} a={a} />)}
          </Table>
        )}
        {data && <Pager page={Number(filters.page ?? 1)} totalPages={data.meta.totalPages} onPage={(page) => set({ page })} />}
      </div>
    </div>
  );
}
