'use client';

import { selectAuth } from '@marketbd/api-client';
import type { Role } from '@marketbd/shared';
import { ShieldAlert } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useI18n } from '@/i18n/client';
import { ButtonLink, EmptyState, Spinner } from '@/components/ui';

/** Client-side route guard. Waits for session restore, then redirects anonymous users to /login. */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { status, user } = useSelector(selectAuth);
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    if (status === 'anonymous') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== 'authenticated' || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <EmptyState
        icon={<ShieldAlert />}
        title="Access denied"
        text="Your account does not have permission to open this page."
        action={<ButtonLink href="/">{t.common.backHome}</ButtonLink>}
      />
    );
  }
  return <>{children}</>;
}
