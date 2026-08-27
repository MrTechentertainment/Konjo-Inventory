'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from './Header';
import OutletManagement from './OutletManagement';
import { useAuth } from '@/lib/AuthContext';
import { isAdminProfile } from '@/lib/authz';
import { OUTLET_TYPE_LABEL } from '@/lib/outlets';
import type { LocalOutletType } from '@/lib/outletRoutes';

export default function AdminOutletCategoryPage({ type }: { type: LocalOutletType }) {
  const { profile } = useAuth();
  const router = useRouter();
  const authorized = isAdminProfile(profile);
  useEffect(() => { if (profile && !authorized) router.replace('/outlets'); }, [authorized, profile, router]);
  if (!authorized) return null;
  return <div className="min-h-dvh bg-konjo-charcoal pb-12"><Header title={`Manage ${OUTLET_TYPE_LABEL[type]}`} subtitle="admin location controls" /><main className="mx-auto max-w-4xl px-4 pt-5"><Link href="/admin/outlets" className="mb-4 flex items-center gap-1.5 text-xs text-konjo-cream/50"><ArrowLeft size={14} />All outlet sections</Link><OutletManagement type={type} /></main></div>;
}
