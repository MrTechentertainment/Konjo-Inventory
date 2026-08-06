'use client';

import { motion } from 'framer-motion';
import { CalendarDays, Gift, PackageOpen, Store, TentTree } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/Header';
import type { OutletType } from '@/lib/types';

const CATEGORIES: { type: OutletType; label: string; note: string; icon: typeof Store; external?: string; tone: string }[] = [
  { type:'SUPERMARKET', label:'Supermarkets', note:'Deliveries, orders and payment status', icon:Store, tone:'from-konjo-red/25 to-konjo-red/5' },
  { type:'BAZAAR', label:'Bazaars', note:'Live stock and rapid sales', icon:TentTree, tone:'from-konjo-amber/25 to-konjo-amber/5' },
  { type:'EVENT', label:'Activation Events', note:'Open KONJO Tally portal', icon:CalendarDays, external:'https://ktally.netlify.app', tone:'from-konjo-green/25 to-konjo-green/5' },
  { type:'GIFT', label:'Gifts', note:'Promotional distribution', icon:Gift, tone:'from-purple-500/20 to-purple-500/5' },
  { type:'SAMPLE', label:'Samples', note:'Field sampling stock', icon:PackageOpen, tone:'from-sky-500/20 to-sky-500/5' },
];

export default function OutletsDashboard() {
  return <div className="min-h-dvh bg-konjo-charcoal pb-10">
    <Header title="Field Dashboard" subtitle="choose a workspace" />
    <main className="mx-auto max-w-3xl px-4 pt-6">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-konjo-red">Outlets portal</p><h1 className="mt-1 font-display text-2xl font-bold text-konjo-cream">Where are you working?</h1><p className="mt-1 text-sm text-konjo-cream/45">Open only the location category you need.</p></div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CATEGORIES.map(({type,label,note,icon:Icon,external,tone},index)=>{
          const body=<motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:index*0.04}} className={`group min-h-40 rounded-3xl border border-white/10 bg-gradient-to-br ${tone} p-4 shadow-xl shadow-black/10 transition active:scale-[0.97]`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/15 text-konjo-cream"><Icon size={23}/></span>
            <h2 className="mt-5 font-display text-base font-bold text-konjo-cream">{label}</h2><p className="mt-1 text-[11px] leading-relaxed text-konjo-cream/40">{note}</p>
          </motion.div>;
          return external?<a key={type} href={external} aria-label={`Open ${label}`}>{body}</a>:<Link key={type} href={`/outlets/category/${type.toLowerCase()}`}>{body}</Link>;
        })}
      </div>
    </main>
  </div>;
}
