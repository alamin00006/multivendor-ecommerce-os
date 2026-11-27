'use client';

import { errorMessage, useAdminCreateStaffMutation, useAdminStaffQuery, useAdminUpdateStaffMutation, useMeQuery } from '@marketbd/api-client';
import { ADMIN_AREA_INFO, ADMIN_AREAS, type AdminPermission, FULL_ADMIN_ACCESS, type StaffView } from '@marketbd/shared';
import { Badge, Button, EmptyState, fmtDate, Modal, PageHeader, Skeleton, Table } from '@marketbd/ui';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

function PermissionPicker({ value, onChange }: { value: AdminPermission[]; onChange: (v: AdminPermission[]) => void }) {
  const full = value.includes(FULL_ADMIN_ACCESS);
  const toggle = (area: AdminPermission) => onChange(value.includes(area) ? value.filter((a) => a !== area) : [...value, area]);
  return (
    <div className="space-y-2">
      <label className="flex items-start gap-3 rounded-lg border border-ink-200 p-3">
        <input type="checkbox" className="mt-1" checked={full} onChange={() => onChange(full ? [] : [FULL_ADMIN_ACCESS])} />
        <span>
          <span className="block text-sm font-semibold">Full access (owner)</span>
          <span className="block text-xs text-ink-500">Everything, including staff accounts and the activity log</span>
        </span>
      </label>
      {!full && (
        <div className="grid gap-2 sm:grid-cols-2">
          {ADMIN_AREAS.map((area) => (
            <label key={area} className="flex items-start gap-3 rounded-lg border border-ink-100 p-3">
              <input type="checkbox" className="mt-1" checked={value.includes(area)} onChange={() => toggle(area)} />
              <span>
                <span className="block text-sm font-medium">{ADMIN_AREA_INFO[area].label}</span>
                <span className="block text-xs text-ink-500">{ADMIN_AREA_INFO[area].description}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      <p className="text-xs text-ink-500">Every staff member can see the dashboard.</p>
    </div>
  );
}

function AreaBadges({ permissions }: { permissions: string[] }) {
  if (permissions.includes(FULL_ADMIN_ACCESS)) return <Badge tone="success">Full access</Badge>;
  if (!permissions.length) return <span className="text-xs text-ink-500">Dashboard only</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {permissions.map((p) => (
        <Badge key={p}>{ADMIN_AREA_INFO[p as keyof typeof ADMIN_AREA_INFO]?.label ?? p}</Badge>
      ))}
    </div>
  );
}

function AddStaff({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [create, { isLoading }] = useAdminCreateStaffMutation();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create({ ...form, phone: form.phone || undefined, permissions }).unwrap();
      toast.success('Staff account created. Share the email and temporary password with them.');
      setForm({ name: '', email: '', phone: '', password: '' });
      setPermissions([]);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add staff member" size="lg">
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Name</span>
            <input className="input" required value={form.name} onChange={set('name')} />
          </label>
          <label className="block">
            <span className="label">Email (used to sign in)</span>
            <input className="input" type="email" required value={form.email} onChange={set('email')} />
          </label>
          <label className="block">
            <span className="label">Phone (optional)</span>
            <input className="input" value={form.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" />
          </label>
          <label className="block">
            <span className="label">Temporary password</span>
            <input className="input" type="text" autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} />
          </label>
        </div>
        <div>
          <span className="label">What can they manage?</span>
          <PermissionPicker value={permissions} onChange={setPermissions} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isLoading}>Create account</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditStaff({ staff, onClose }: { staff: StaffView; onClose: () => void }) {
  const [update, { isLoading }] = useAdminUpdateStaffMutation();
  const [permissions, setPermissions] = useState<AdminPermission[]>(staff.permissions as AdminPermission[]);
  const save = async () => {
    try {
      await update({ id: staff.id, permissions }).unwrap();
      toast.success('Access updated');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Modal open onClose={onClose} title={`Access for ${staff.name}`} size="lg">
      <PermissionPicker value={permissions} onChange={setPermissions} />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={isLoading} onClick={() => void save()}>Save</Button>
      </div>
    </Modal>
  );
}

export default function StaffPage() {
  const { data, isLoading } = useAdminStaffQuery();
  const { data: me } = useMeQuery();
  const [update] = useAdminUpdateStaffMutation();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<StaffView | null>(null);

  const toggleActive = async (s: StaffView) => {
    try {
      await update({ id: s.id, isActive: !s.isActive }).unwrap();
      toast.success(s.isActive ? 'Account disabled; they are signed out' : 'Account enabled');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Admin accounts and what each one can manage. Changes apply on their next click."
        actions={<Button onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" /> Add staff</Button>}
      />
      <div className="card">
        {isLoading ? (
          <Skeleton className="m-4 h-32" />
        ) : (
          <Table head={['Staff member', 'Access', 'Last activity', 'Added', 'Status', '']} empty={!data?.length ? <EmptyState icon={<ShieldCheck />} title="No staff yet" /> : null}>
            {data?.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{s.name}{s.id === me?.id && <span className="ml-1 text-xs text-ink-500">(you)</span>}</div>
                  <div className="text-xs text-ink-500">{s.email}{s.phone ? ` · ${s.phone}` : ''}</div>
                </td>
                <td className="px-4 py-3"><AreaBadges permissions={s.permissions} /></td>
                <td className="px-4 py-3 text-xs text-ink-500">{s.lastActivityAt ? fmtDate(s.lastActivityAt) : '—'}</td>
                <td className="px-4 py-3 text-xs text-ink-500">{fmtDate(s.createdAt)}</td>
                <td className="px-4 py-3"><Badge tone={s.isActive ? 'success' : 'danger'}>{s.isActive ? 'Active' : 'Disabled'}</Badge></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>Edit access</Button>
                    {s.id !== me?.id && (
                      <Button size="sm" variant="ghost" onClick={() => void toggleActive(s)}>{s.isActive ? 'Disable' : 'Enable'}</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      <AddStaff open={adding} onClose={() => setAdding(false)} />
      {editing && <EditStaff key={editing.id} staff={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
