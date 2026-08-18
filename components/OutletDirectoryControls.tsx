'use client';

import { Building2, CalendarDays, ExternalLink, Gift, Search, Store, TentTree, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ACTIVATION_PORTAL_URL, LOCAL_OUTLET_TYPES, OUTLET_TYPE_DESCRIPTION, OUTLET_TYPE_LABEL } from '@/lib/outlets';
import type { Outlet, OutletType } from '@/lib/types';

const TYPE_ICON: Record<OutletType, LucideIcon> = {
  SUPERMARKET: Store,
  BAZAAR: TentTree,
  EVENT: CalendarDays,
  GIFT: Gift,
  SAMPLE: Building2,
};

interface Props {
  outlets: Outlet[];
  query: string;
  onQueryChange: (value: string) => void;
  selectedType: Exclude<OutletType, 'EVENT'> | null;
  onSelectType: (value: Exclude<OutletType, 'EVENT'> | null) => void;
}

export default function OutletDirectoryControls({ outlets, query, onQueryChange, selectedType, onSelectType }: Props) {
  return (
    <>
      <div className="relative">
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-konjo-cream/35" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search every outlet by name, area or subcity"
          aria-label="Search outlets"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.055] py-3.5 pl-11 pr-11 text-sm text-konjo-cream shadow-lg shadow-black/10 placeholder:text-konjo-cream/30 focus:border-konjo-red/45 focus:outline-none focus:ring-2 focus:ring-konjo-red/15"
        />
        {query && <button onClick={() => onQueryChange('')} aria-label="Clear outlet search" className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/5 text-konjo-cream/45"><X size={14} /></button>}
      </div>

      {!query.trim() && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LOCAL_OUTLET_TYPES.map((type) => {
            const Icon = TYPE_ICON[type];
            const count = outlets.filter((outlet) => outlet.type === type).length;
            const active = selectedType === type;
            return (
              <button key={type} onClick={() => onSelectType(active ? null : type)} aria-expanded={active} className={`group relative min-h-36 overflow-hidden rounded-3xl border p-4 text-left shadow-lg shadow-black/10 transition hover:-translate-y-0.5 ${active ? 'border-konjo-red/45 bg-konjo-red/15 ring-2 ring-konjo-red/10' : 'border-white/10 bg-white/[0.045] hover:border-white/20'}`}>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-konjo-red/15 via-transparent to-transparent opacity-70" />
                <div className="relative flex h-full flex-col"><span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-konjo-cream"><Icon size={19} /></span><p className="mt-4 font-display text-sm font-bold text-konjo-cream">{OUTLET_TYPE_LABEL[type]}</p><p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-konjo-cream/40">{OUTLET_TYPE_DESCRIPTION[type]}</p><p className="mt-auto pt-3 text-[10px] font-bold uppercase tracking-wide text-konjo-amber">{count} {count === 1 ? 'location' : 'locations'}</p></div>
              </button>
            );
          })}
          <a href={ACTIVATION_PORTAL_URL} target="_blank" rel="noreferrer" className="group relative min-h-36 overflow-hidden rounded-3xl border border-konjo-amber/25 bg-konjo-amber/[0.07] p-4 text-left shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:border-konjo-amber/40">
            <div className="relative flex h-full flex-col"><div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-konjo-amber/20 bg-konjo-amber/10 text-konjo-amber"><CalendarDays size={19} /></span><ExternalLink size={15} className="text-konjo-amber/55" /></div><p className="mt-4 font-display text-sm font-bold text-konjo-cream">Activation Events</p><p className="mt-1 text-[10px] leading-relaxed text-konjo-cream/40">Open the dedicated KTally activation workspace.</p><p className="mt-auto pt-3 text-[10px] font-bold uppercase tracking-wide text-konjo-amber">Open KTally</p></div>
          </a>
        </div>
      )}
    </>
  );
}
