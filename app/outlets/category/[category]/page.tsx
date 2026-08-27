import { notFound } from 'next/navigation';
import OutletCategoryPage from '@/components/OutletCategoryPage';
import { outletTypeFromSlug } from '@/lib/outletRoutes';

export default async function OutletCategoryRoute({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const type = outletTypeFromSlug(category);
  if (!type) notFound();
  return <OutletCategoryPage type={type} />;
}
