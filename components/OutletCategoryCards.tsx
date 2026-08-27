'use client';

import { Building2, CalendarDays, ExternalLink, Gift, Store, TentTree } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { ACTIVATION_PORTAL_URL, LOCAL_OUTLET_TYPES, OUTLET_TYPE_DESCRIPTION, OUTLET_TYPE_LABEL } from '@/lib/outlets';
import { managementCategoryHref, portalCategoryHref } from '@/lib/outletRoutes';
import type { Outlet, OutletType } from '@/lib/types';

const TYPE_ICON: Record<OutletType, LucideIcon> = {
  SUPERMARKET: Store,
  BAZAAR: TentTree,
  EVENT: CalendarDays,
  GIFT: Gift,
  SAMPLE: Building2,
};

export default function OutletCategoryCards({ outlets, mode }: { outlets: Outlet[]; mode: 'management' | 'portal' }) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:grid-cols-3">
      {LOCAL_OUTLET_TYPES.map((type) => {
        const Icon = TYPE_ICON[type];
        const count = outlets.filter((outlet) => outlet.type === type).length;
        const href = mode === 'management' ? managementCategoryHref(type) : portalCategoryHref(type);
        return (
          <Link key={type} href={href} className="group relative min-h-40 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] p-4 shadow-lg shadow-black/10 transition active:scale-[0.98] sm:hover:-translate-y-0.5 sm:hover:border-white/20">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-konjo-red/15 via-transparent to-transparent opacity-70" />
            <div className="relative flex h-full flex-col"><span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-konjo-cream"><Icon size={19} /></span><p className="mt-4 font-display text-base font-bold text-konjo-cream">{OUTLET_TYPE_LABEL[type]}</p><p className="mt-1 text-[11px] leading-relaxed text-konjo-cream/40">{OUTLET_TYPE_DESCRIPTION[type]}</p><p className="mt-auto pt-3 text-[10px] font-bold uppercase tracking-wide text-konjo-amber">Open {count} {count === 1 ? 'location' : 'locations'}</p></div>
          </Link>
        );
      })}
      <a href={ACTIVATION_PORTAL_URL} target="_blank" rel="noreferrer" className="group relative min-h-40 overflow-hidden rounded-3xl border border-konjo-amber/25 bg-konjo-amber/[0.07] p-4 shadow-lg shadow-black/10 transition active:scale-[0.98] sm:hover:-translate-y-0.5 sm:hover:border-konjo-amber/40">
        <div className="relative flex h-full flex-col"><div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-konjo-amber/20 bg-konjo-amber/10 text-konjo-amber"><CalendarDays size={19} /></span><ExternalLink size={15} className="text-konjo-amber/55" /></div><p className="mt-4 font-display text-base font-bold text-konjo-cream">Activation Events</p><p className="mt-1 text-[11px] leading-relaxed text-konjo-cream/40">Open the dedicated KTally activation workspace.</p><p className="mt-auto pt-3 text-[10px] font-bold uppercase tracking-wide text-konjo-amber">Open KTally</p></div>
      </a>
    </div>
  );
}
