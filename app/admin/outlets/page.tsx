'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import OutletCategoryCards from '@/components/OutletCategoryCards';
import { useAuth } from '@/lib/AuthContext';
import { isAdminProfile } from '@/lib/authz';
import { useOutlets } from '@/lib/useOutletInventory';

export default function AdminOutletsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const authorized = isAdminProfile(profile);
  const { outlets, loading, error } = useOutlets();
  useEffect(() => { if (profile && !authorized) router.replace('/outlets'); }, [authorized, profile, router]);
  if (!authorized) return null;
  return <div className="min-h-dvh bg-konjo-charcoal pb-12"><Header title="Outlets Management" subtitle="admin location controls" /><main className="mx-auto max-w-4xl px-4 pt-6"><h1 className="font-display text-xl font-bold text-konjo-cream">Choose a section to manage</h1><p className="mt-1 text-xs leading-relaxed text-konjo-cream/45">Supermarkets, bazaars, gifts and samples now have separate searchable pages.</p>{loading && <div className="mt-12 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-konjo-red" /></div>}{error && <p className="mt-5 rounded-xl bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}{!loading && !error && <div className="mt-5"><OutletCategoryCards outlets={outlets} mode="management" /></div>}</main></div>;
}
