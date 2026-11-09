'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { errorMessage, selectUser, useChangePasswordMutation, useUpdateProfileMutation } from '@marketbd/api-client';
import { type ChangePasswordInput, ChangePasswordSchema, NameSchema } from '@marketbd/shared';
import { useForm } from 'react-hook-form';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { z } from 'zod';
import { useI18n } from '@/i18n/client';
import { Button } from '@/components/ui';

const ProfileSchema = z.object({ name: NameSchema });

export default function ProfilePage() {
  const { t, locale } = useI18n();
  const user = useSelector(selectUser);
  const [updateProfile, profileState] = useUpdateProfileMutation();
  const [changePassword, pwState] = useChangePasswordMutation();
  const profile = useForm<{ name: string }>({ resolver: zodResolver(ProfileSchema), values: { name: user?.name ?? '' } });
  const pw = useForm<ChangePasswordInput>({ resolver: zodResolver(ChangePasswordSchema) });

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h1 className="mb-4 font-semibold">{t.account.profile}</h1>
        <form
          className="grid max-w-lg gap-3"
          onSubmit={profile.handleSubmit(async (v) => {
            try {
              await updateProfile({ name: v.name, locale: locale === 'bn' ? 'BN' : 'EN' }).unwrap();
              toast.success(t.common.save);
            } catch (e) {
              toast.error(errorMessage(e));
            }
          })}
        >
          <div>
            <label className="label" htmlFor="name">{t.auth.name}</label>
            <input id="name" className="input" {...profile.register('name')} />
            {profile.formState.errors.name && <p className="field-error">{profile.formState.errors.name.message}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="label">{t.auth.email}</span>
              <p className="input flex items-center bg-ink-50">{user?.email ?? '—'}</p>
            </div>
            <div>
              <span className="label">{t.auth.phone}</span>
              <p className="input flex items-center bg-ink-50">{user?.phone ?? '—'}</p>
            </div>
          </div>
          <Button type="submit" className="w-fit" loading={profileState.isLoading}>
            {t.common.save}
          </Button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">{t.account.security}</h2>
        <form
          className="grid max-w-lg gap-3"
          onSubmit={pw.handleSubmit(async (v) => {
            try {
              await changePassword(v).unwrap();
              pw.reset();
              toast.success(t.common.save);
            } catch (e) {
              toast.error(errorMessage(e));
            }
          })}
        >
          <div>
            <label className="label" htmlFor="currentPassword">{t.account.currentPassword}</label>
            <input id="currentPassword" type="password" className="input" autoComplete="current-password" {...pw.register('currentPassword')} />
          </div>
          <div>
            <label className="label" htmlFor="newPassword">{t.account.newPassword}</label>
            <input id="newPassword" type="password" className="input" autoComplete="new-password" {...pw.register('newPassword')} />
            {pw.formState.errors.newPassword && <p className="field-error">{pw.formState.errors.newPassword.message}</p>}
          </div>
          <Button type="submit" className="w-fit" loading={pwState.isLoading}>
            {t.common.save}
          </Button>
        </form>
      </section>
    </div>
  );
}
