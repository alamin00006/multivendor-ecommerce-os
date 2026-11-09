import type { CategoryNode } from '@marketbd/shared';
import type { Metadata } from 'next';
import { CategoryBrowser } from '@/components/home/category-browser';
import { apiTry } from '@/lib/server-api';

export const metadata: Metadata = { title: 'All categories' };
export const revalidate = 300;

export default async function CategoriesPage() {
  const categories = (await apiTry<CategoryNode[]>('/categories', { revalidate: 300 })) ?? [];
  return <CategoryBrowser categories={categories} />;
}
