'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import OutletManagement from '@/components/OutletManagement';
import { useAuth } from '@/lib/AuthContext';
import { isAdminProfile } from '@/lib/authz';

export default function AdminOutletsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const authorized = isAdminProfile(profile);
  useEffect(() => { if (profile && !authorized) router.replace('/outlets'); }, [authorized, profile, router]);
  if (!authorized) return null;
  return <div className="min-h-dvh bg-konjo-charcoal pb-12"><Header title="Outlets Management" subtitle="admin location controls" /><main className="mx-auto max-w-4xl px-4 pt-6"><OutletManagement /></main></div>;
}
