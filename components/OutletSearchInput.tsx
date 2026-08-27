'use client';

import { Search, X } from 'lucide-react';

export default function OutletSearchInput({ value, onChange, outletLabel }: { value: string; onChange: (value: string) => void; outletLabel: string }) {
  return <div className="relative"><Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-konjo-cream/35" /><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={`Search ${outletLabel.toLowerCase()} by name, area or subcity`} aria-label={`Search ${outletLabel}`} className="w-full rounded-2xl border border-white/10 bg-white/[0.055] py-3.5 pl-11 pr-11 text-sm text-konjo-cream shadow-lg shadow-black/10 placeholder:text-konjo-cream/30 focus:border-konjo-red/45 focus:outline-none focus:ring-2 focus:ring-konjo-red/15" />{value && <button onClick={() => onChange('')} aria-label="Clear outlet search" className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/5 text-konjo-cream/45"><X size={14} /></button>}</div>;
}
