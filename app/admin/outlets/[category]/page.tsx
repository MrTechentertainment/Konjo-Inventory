import { notFound } from 'next/navigation';
import AdminOutletCategoryPage from '@/components/AdminOutletCategoryPage';
import { outletTypeFromSlug } from '@/lib/outletRoutes';

export default async function AdminOutletCategoryRoute({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const type = outletTypeFromSlug(category);
  if (!type) notFound();
  return <AdminOutletCategoryPage type={type} />;
}
