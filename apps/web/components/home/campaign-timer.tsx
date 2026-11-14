'use client';

import { useCountdown } from '@marketbd/api-client';
import { useI18n } from '@marketbd/ui';

export function CampaignTimer({ endsAt }: { endsAt: string }) {
  const { t } = useI18n();
  const { days, hours, minutes, seconds } = useCountdown(endsAt);
  const cells: Array<[number, string]> = [
    [days, 'd'],
    [hours, 'h'],
    [minutes, 'm'],
    [seconds, 's'],
  ];
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-ink-500">{t.home.endsIn}</span>
      {cells.map(([v, u]) => (
        <span key={u} className="rounded-md bg-ink-900 px-2 py-1 font-bold tabular-nums text-white">
          {String(v).padStart(2, '0')}
          <span className="ml-0.5 text-xs font-normal text-ink-300">{u}</span>
        </span>
      ))}
    </div>
  );
}
