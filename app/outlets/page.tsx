'use client';

import { Settings2 } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/Header';
import OutletCategoryCards from '@/components/OutletCategoryCards';
import { isAdminProfile } from '@/lib/authz';
import { useAuth } from '@/lib/AuthContext';
import { useOutlets } from '@/lib/useOutletInventory';

export default function OutletsPage() {
  const { profile } = useAuth();
  const { outlets, loading, error } = useOutlets();
  const canManage = isAdminProfile(profile);
  return <div className="min-h-dvh bg-konjo-charcoal pb-10"><Header title="Outlets Portal" subtitle="field stock & sales" /><main className="mx-auto max-w-4xl px-4 pt-5"><div className="flex items-start justify-between gap-3"><div><h1 className="font-display text-xl font-bold text-konjo-cream">Choose an outlet section</h1><p className="mt-1 text-xs leading-relaxed text-konjo-cream/45">Each section opens its own searchable mobile workspace.</p></div>{canManage && <Link href="/admin/outlets" className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-konjo-amber/25 bg-konjo-amber/10 px-3 py-2 text-xs font-semibold text-konjo-amber"><Settings2 size={14} />Manage</Link>}</div>{loading && <div className="mt-12 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-konjo-red" /></div>}{error && <p className="mt-5 rounded-xl bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}{!loading && !error && <div className="mt-5"><OutletCategoryCards outlets={outlets} mode="portal" /></div>}</main></div>;
}
