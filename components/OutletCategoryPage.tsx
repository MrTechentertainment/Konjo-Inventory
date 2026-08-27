'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import Header from './Header';
import OutletSearchInput from './OutletSearchInput';
import { useAuth } from '@/lib/AuthContext';
import { isAdminProfile } from '@/lib/authz';
import { OUTLET_TYPE_DESCRIPTION, OUTLET_TYPE_LABEL } from '@/lib/outlets';
import { managementCategoryHref } from '@/lib/outletRoutes';
import type { LocalOutletType } from '@/lib/outletRoutes';
import { searchOutlets } from '@/lib/outletSearch';
import { useOutlets } from '@/lib/useOutletInventory';

export default function OutletCategoryPage({ type }: { type: LocalOutletType }) {
  const { profile } = useAuth();
  const { outlets, loading, error } = useOutlets();
  const [query, setQuery] = useState('');
  const categoryOutlets = useMemo(() => outlets.filter((outlet) => outlet.type === type), [outlets, type]);
  const search = useMemo(() => searchOutlets(categoryOutlets, query), [categoryOutlets, query]);
  const visibleOutlets = query.trim() ? search.matches : categoryOutlets;
  const canManage = isAdminProfile(profile);

  return <div className="min-h-dvh bg-konjo-charcoal pb-10"><Header title={OUTLET_TYPE_LABEL[type]} subtitle="outlet portal" /><main className="mx-auto max-w-4xl px-4 pt-5"><div className="flex items-start justify-between gap-3"><div><Link href="/outlets" className="mb-3 flex items-center gap-1.5 text-xs text-konjo-cream/50"><ArrowLeft size={14} />All outlet sections</Link><h1 className="font-display text-xl font-bold text-konjo-cream">{OUTLET_TYPE_LABEL[type]}</h1><p className="mt-1 text-xs leading-relaxed text-konjo-cream/45">{OUTLET_TYPE_DESCRIPTION[type]}</p></div>{canManage && <Link href={managementCategoryHref(type)} className="mt-7 flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-konjo-amber/25 bg-konjo-amber/10 px-3 py-2 text-xs font-semibold text-konjo-amber"><Settings2 size={14} />Add / edit</Link>}</div><div className="mt-5"><OutletSearchInput value={query} onChange={setQuery} outletLabel={OUTLET_TYPE_LABEL[type]} /></div>{query.trim() && !search.hasDirectMatch && search.suggestion && <p className="mt-3 rounded-xl border border-konjo-amber/20 bg-konjo-amber/10 px-3 py-2 text-xs text-konjo-amber">Did you mean <button onClick={() => setQuery(search.suggestion?.name ?? '')} className="font-bold underline underline-offset-2">{search.suggestion.name}</button>?</p>}{loading && <div className="mt-12 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-konjo-red" /></div>}{error && <p className="mt-5 rounded-xl bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}{!loading && <section className="mt-5"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-konjo-amber">{visibleOutlets.length} {visibleOutlets.length === 1 ? 'location' : 'locations'}</p><div className="grid gap-3 sm:grid-cols-2">{visibleOutlets.map((outlet, index) => <motion.div key={outlet.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.025, 0.15) }}><Link href={`/outlets/${outlet.id}`} className="flex min-h-28 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-md shadow-black/10 transition active:scale-[0.98]"><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold leading-snug text-konjo-cream">{outlet.name}</p><p className="mt-1 break-words text-[11px] leading-relaxed text-konjo-cream/40">{[outlet.address, outlet.subcity].filter(Boolean).join(' · ') || 'Open outlet dashboard'}</p></div><ChevronRight size={17} className="shrink-0 text-konjo-cream/30" /></Link></motion.div>)}{!visibleOutlets.length && <p className="col-span-full rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-konjo-cream/35">No matching {OUTLET_TYPE_LABEL[type].toLowerCase()} found.</p>}</div></section>}</main></div>;
}
