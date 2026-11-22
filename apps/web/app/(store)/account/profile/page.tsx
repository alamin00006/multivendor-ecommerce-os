'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { errorMessage, selectUser, useChangePasswordMutation, useUpdateProfileMutation } from '@marketbd/api-client';
import { BirthdaySchema, type ChangePasswordInput, ChangePasswordSchema, type Gender, GENDERS, NameSchema } from '@marketbd/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { z } from 'zod';
import { useI18n, Button } from '@marketbd/ui';

const GENDER_LABEL: Record<Gender, string> = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };

// Form fields are strings; empty birthday/gender means "not set".
const ProfileFormSchema = z.object({
  name: NameSchema,
  birthday: z.union([z.literal(''), BirthdaySchema]),
  gender: z.union([z.literal(''), z.enum(GENDERS)]),
});
type ProfileForm = z.infer<typeof ProfileFormSchema>;

const formatBirthday = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="font-semibold text-ink-900">{label}</p>
      <p className="mt-0.5 min-h-6 break-all text-ink-500">{value || ''}</p>
    </div>
  );
}

export default function ProfilePage() {
  const { t, locale } = useI18n();
  const user = useSelector(selectUser);
  const [mode, setMode] = useState<'view' | 'edit' | 'password'>('view');
  const [updateProfile, profileState] = useUpdateProfileMutation();
  const [changePassword, pwState] = useChangePasswordMutation();
  const profile = useForm<ProfileForm>({
    resolver: zodResolver(ProfileFormSchema),
    values: { name: user?.name ?? '', birthday: user?.birthday ?? '', gender: user?.gender ?? '' },
  });
  const pw = useForm<ChangePasswordInput>({ resolver: zodResolver(ChangePasswordSchema) });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <h1 className="mb-4 px-1 text-2xl font-semibold text-ink-900">My Profile</h1>
      <div className="rounded-lg bg-white p-5 shadow-card md:p-6">
        {mode === 'view' && (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:divide-x md:divide-ink-100">
              <div className="space-y-5">
                <Item label="Full Name" value={user?.name} />
                <Item label="Birthday" value={user?.birthday ? formatBirthday(user.birthday) : null} />
                <Item label="Gender" value={user?.gender ? GENDER_LABEL[user.gender] : null} />
              </div>
              <div className="space-y-5 md:pl-6">
                <Item label="Email" value={user?.email} />
                <Item label="Phone Number" value={user?.phone} />
              </div>
            </div>
            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setMode('edit')} className="rounded-full border border-ink-200 px-4 py-2 text-sm font-medium text-ink-900 hover:border-primary-400 hover:text-primary-700">
                Edit Profile
              </button>
              <button type="button" onClick={() => setMode('password')} className="rounded-full border border-ink-200 px-4 py-2 text-sm font-medium text-ink-900 hover:border-primary-400 hover:text-primary-700">
                Change Password
              </button>
            </div>
          </>
        )}

        {mode === 'edit' && (
          <form
            className="grid grid-cols-1 max-w-2xl gap-4 sm:grid-cols-2"
            onSubmit={profile.handleSubmit(async (v) => {
              try {
                await updateProfile({
                  name: v.name,
                  birthday: v.birthday || null,
                  gender: v.gender || null,
                  locale: locale === 'bn' ? 'BN' : 'EN',
                }).unwrap();
                toast.success('Profile updated');
                setMode('view');
              } catch (e) {
                toast.error(errorMessage(e));
              }
            })}
          >
            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">Full Name</label>
              <input id="name" className="input" autoComplete="name" {...profile.register('name')} />
              {profile.formState.errors.name && <p className="field-error">{profile.formState.errors.name.message}</p>}
            </div>
            <div>
              <label className="label" htmlFor="birthday">Birthday</label>
              <input id="birthday" type="date" max={today} min="1900-01-01" className="input" {...profile.register('birthday')} />
              {profile.formState.errors.birthday && <p className="field-error">{profile.formState.errors.birthday.message}</p>}
            </div>
            <div>
              <label className="label" htmlFor="gender">Gender</label>
              <select id="gender" className="input" {...profile.register('gender')}>
                <option value="">Prefer not to say</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {GENDER_LABEL[g]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="label">Email</span>
              <p className="input flex items-center bg-ink-50 text-ink-500">{user?.email ?? '—'}</p>
            </div>
            <div>
              <span className="label">Phone Number</span>
              <p className="input flex items-center bg-ink-50 text-ink-500">{user?.phone ?? '—'}</p>
            </div>
            <p className="text-xs text-ink-500 sm:col-span-2">Email and phone are verified sign-in details, so they cannot be changed here.</p>
            <div className="flex gap-3 sm:col-span-2">
              <Button type="submit" loading={profileState.isLoading}>
                {t.common.save}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  profile.reset();
                  setMode('view');
                }}
              >
                {t.common.cancel}
              </Button>
            </div>
          </form>
        )}

        {mode === 'password' && (
          <form
            className="grid max-w-md gap-4"
            onSubmit={pw.handleSubmit(async (v) => {
              try {
                await changePassword(v).unwrap();
                pw.reset();
                toast.success('Password changed');
                setMode('view');
              } catch (e) {
                toast.error(errorMessage(e));
              }
            })}
          >
            <h2 className="font-semibold text-ink-900">Change Password</h2>
            <div>
              <label className="label" htmlFor="currentPassword">{t.account.currentPassword}</label>
              <input id="currentPassword" type="password" className="input" autoComplete="current-password" {...pw.register('currentPassword')} />
              {pw.formState.errors.currentPassword && <p className="field-error">{pw.formState.errors.currentPassword.message}</p>}
            </div>
            <div>
              <label className="label" htmlFor="newPassword">{t.account.newPassword}</label>
              <input id="newPassword" type="password" className="input" autoComplete="new-password" {...pw.register('newPassword')} />
              {pw.formState.errors.newPassword && <p className="field-error">{pw.formState.errors.newPassword.message}</p>}
            </div>
            <div className="flex gap-3">
              <Button type="submit" loading={pwState.isLoading}>
                {t.common.save}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  pw.reset();
                  setMode('view');
                }}
              >
                {t.common.cancel}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
