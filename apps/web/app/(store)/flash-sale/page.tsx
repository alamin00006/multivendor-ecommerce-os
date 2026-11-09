import type { FlashSaleView } from '@marketbd/shared';
import type { Metadata } from 'next';
import { FlashSalePage } from '@/components/home/flash-sale-page';
import { apiTry } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Flash Sale' };
export const revalidate = 30;

export default async function Page() {
  const sale = await apiTry<FlashSaleView | null>('/flash-sales/active', { revalidate: 30 });
  return <FlashSalePage sale={sale} />;
}
