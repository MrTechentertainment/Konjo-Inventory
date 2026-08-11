'use client';

import { motion } from 'framer-motion';
import { Building2, CalendarDays, ChevronRight, Gift, Store, TentTree } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/Header';
import { OUTLET_TYPE_DESCRIPTION, OUTLET_TYPE_LABEL } from '@/lib/outlets';
import { useOutlets } from '@/lib/useOutletInventory';
import type { OutletType } from '@/lib/types';

const TYPE_ICON = { SUPERMARKET: Store, BAZAAR: TentTree, EVENT: CalendarDays, GIFT: Gift, SAMPLE: Building2 } as const;
const TYPES: OutletType[] = ['SUPERMARKET', 'BAZAAR', 'EVENT', 'GIFT', 'SAMPLE'];

export default function OutletsPage() {
  const { outlets, loading, error } = useOutlets();
  return (
    <div className="min-h-dvh bg-konjo-charcoal pb-10">
      <Header title="Outlets Portal" subtitle="field stock & sales" />
      <main className="mx-auto max-w-4xl px-4 pt-5">
        <div><h1 className="font-display text-xl font-bold text-konjo-cream">Sales locations</h1><p className="mt-1 text-xs text-konjo-cream/45">Choose a location to deliver stock or record live sales.</p></div>
        {loading && <div className="mt-12 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-konjo-red" /></div>}
        {error && <p className="mt-5 rounded-xl bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}
        <div className="mt-5 space-y-5">
          {TYPES.map((type) => {
            const Icon = TYPE_ICON[type];
            const items = outlets.filter((outlet) => outlet.type === type);
            return (
              <section key={type}>
                <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-konjo-red/10 text-konjo-red"><Icon size={16} /></span><div><h2 className="font-display text-sm font-semibold text-konjo-cream">{OUTLET_TYPE_LABEL[type]}</h2><p className="text-[10.5px] text-konjo-cream/35">{OUTLET_TYPE_DESCRIPTION[type]}</p></div></div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {items.map((outlet, index) => (
                    <motion.div key={outlet.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.03, 0.15) }}>
                      <Link href={`/outlets/${outlet.id}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-md shadow-black/10 transition active:scale-[0.98]"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-konjo-cream">{outlet.name}</p><p className="mt-0.5 text-[10.5px] text-konjo-cream/35">Open stock workspace</p></div><ChevronRight size={17} className="text-konjo-cream/30" /></Link>
                    </motion.div>
                  ))}
                  {!loading && !items.length && <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-konjo-cream/30">No locations configured.</p>}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
