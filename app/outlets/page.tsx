'use client';

import { motion } from 'framer-motion';
import { ChevronRight, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import Header from '@/components/Header';
import OutletDirectoryControls from '@/components/OutletDirectoryControls';
import { isAdminProfile } from '@/lib/authz';
import { useAuth } from '@/lib/AuthContext';
import { OUTLET_TYPE_LABEL } from '@/lib/outlets';
import { searchOutlets } from '@/lib/outletSearch';
import { useOutlets } from '@/lib/useOutletInventory';
import type { OutletType } from '@/lib/types';

type LocalOutletType = Exclude<OutletType, 'EVENT'>;

export default function OutletsPage() {
  const { profile } = useAuth();
  const { outlets, loading, error } = useOutlets();
  const [selectedType, setSelectedType] = useState<LocalOutletType | null>(null);
  const [query, setQuery] = useState('');
  const search = useMemo(() => searchOutlets(outlets, query), [outlets, query]);
  const visibleOutlets = useMemo(() => query.trim() ? search.matches : selectedType ? outlets.filter((outlet) => outlet.type === selectedType) : [], [outlets, query, search.matches, selectedType]);
  const canManage = isAdminProfile(profile);

  return (
    <div className="min-h-dvh bg-konjo-charcoal pb-10">
      <Header title="Outlets Portal" subtitle="field stock & sales" />
      <main className="mx-auto max-w-4xl px-4 pt-5">
        <div className="flex items-start justify-between gap-3"><div><h1 className="font-display text-xl font-bold text-konjo-cream">Sales locations</h1><p className="mt-1 text-xs text-konjo-cream/45">Search all local outlets or open a workspace section.</p></div>{canManage && <Link href="/admin/outlets" className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-konjo-amber/25 bg-konjo-amber/10 px-3 text-xs font-semibold text-konjo-amber"><Settings2 size={14} />Add / edit</Link>}</div>
        <div className="mt-4"><OutletDirectoryControls outlets={outlets} query={query} onQueryChange={setQuery} selectedType={selectedType} onSelectType={setSelectedType} /></div>
        {loading && <div className="mt-12 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-konjo-red" /></div>}
        {error && <p className="mt-5 rounded-xl bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}
        {query.trim() && !search.hasDirectMatch && search.suggestion && <p className="mt-3 rounded-xl border border-konjo-amber/20 bg-konjo-amber/10 px-3 py-2 text-xs text-konjo-amber">Did you mean <button onClick={() => setQuery(search.suggestion?.name ?? '')} className="font-bold underline underline-offset-2">{search.suggestion.name}</button>?</p>}

        {!loading && (query.trim() || selectedType) && <section className="mt-5"><div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-konjo-amber">{query.trim() ? 'Search results' : OUTLET_TYPE_LABEL[selectedType!]}</p><p className="mt-1 text-xs text-konjo-cream/40">Select a location to open stock, sales and analytics.</p></div><div className="grid gap-3 sm:grid-cols-2">{visibleOutlets.map((outlet, index) => <motion.div key={outlet.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.03, 0.15) }}><Link href={`/outlets/${outlet.id}`} className="flex min-h-24 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-md shadow-black/10 transition hover:border-white/20 active:scale-[0.98]"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-konjo-cream">{outlet.name}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-konjo-cream/30">{OUTLET_TYPE_LABEL[outlet.type]}</p><p className="mt-1 truncate text-[10.5px] text-konjo-cream/40">{[outlet.address, outlet.subcity].filter(Boolean).join(' · ') || 'Open outlet dashboard'}</p></div><ChevronRight size={17} className="text-konjo-cream/30" /></Link></motion.div>)}{!visibleOutlets.length && <p className="col-span-full rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-konjo-cream/35">No matching outlet was found.</p>}</div></section>}
      </main>
    </div>
  );
}
