'use client';

import { errorMessage, useCollectCouponMutation, useIsAuthenticated } from '@marketbd/api-client';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

/** "Collect" for voucher cards: guests go to sign-in first; tracks which card is busy. */
export function useCollectVoucher() {
  const authed = useIsAuthenticated();
  const router = useRouter();
  const pathname = usePathname();
  const [collect] = useCollectCouponMutation();
  const [busyId, setBusyId] = useState<string | null>(null);

  const onCollect = async (id: string) => {
    if (!authed) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
    setBusyId(id);
    try {
      await collect(id).unwrap();
      toast.success('Voucher collected — it will show at checkout');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };
  return { onCollect, busyId };
}
