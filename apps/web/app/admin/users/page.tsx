'use client';

import { errorMessage, useAdminUpdateUserMutation, useAdminUsersQuery } from '@marketbd/api-client';
import { ROLES, type Role } from '@marketbd/shared';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { fmtDate, PageHeader, Pager, Table } from '@/components/manage/panel';
import { Badge, Button, EmptyState, Skeleton } from '@/components/ui';

export default function AdminUsersPage() {
  const [role, setRole] = useState<Role | ''>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminUsersQuery({ role: role || undefined, q: q || undefined, page, limit: 20 });
  const [update] = useAdminUpdateUserMutation();

  const act = async (id: string, body: { isActive?: boolean; role?: Role }) => {
    try {
      await update({ id, ...body }).unwrap();
      toast.success('User updated');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <PageHeader title="Users" />
      <div className="card">
        <div className="flex flex-wrap gap-2 border-b border-ink-100 p-3">
          <input className="input max-w-xs" placeholder="Name, email or phone" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <select className="input w-auto" value={role} onChange={(e) => { setRole(e.target.value as Role | ''); setPage(1); }}>
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        {isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <Table head={['User', 'Contact', 'Role', 'Orders', 'Joined', 'Status']} empty={!data?.items.length ? <EmptyState icon={<Users />} title="No users" /> : null}>
            {data?.items.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-xs">{u.email}<br />{u.phone}</td>
                <td className="px-4 py-3">
                  <select className="input h-8 w-auto text-xs" value={u.role} onChange={(e) => void act(u.id, { role: e.target.value as Role })}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">{u.ordersCount}</td>
                <td className="px-4 py-3 text-xs text-ink-500">{fmtDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge tone={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Active' : 'Disabled'}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => void act(u.id, { isActive: !u.isActive })}>
                      {u.isActive ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
        {data && <Pager page={page} totalPages={data.meta.totalPages} onPage={setPage} />}
      </div>
    </div>
  );
}
