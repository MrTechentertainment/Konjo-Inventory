'use client';

import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Boxes,
  Building2,
  CircleDollarSign,
  ClipboardList,
  Factory,
  FileSpreadsheet,
  MapPinned,
  ReceiptText,
  Store,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { isRootProfile } from '@/lib/authz';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { ROLE_MODAL_EVENT } from './HamburgerMenu';

interface Summary {
  products: number;
  factoryUnits: number;
  outlets: number;
  unpaidSales: number;
  unpaidValue: number;
}

const emptySummary: Summary = { products: 0, factoryUnits: 0, outlets: 0, unpaidSales: 0, unpaidValue: 0 };

function formatWholeEtb(value: number): string {
  const whole = Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `ETB ${whole}`;
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const root = isRootProfile(profile);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [productsResult, outletsResult, salesResult] = await Promise.all([
          supabase.from('products').select('id,current_stock').eq('is_active', true),
          supabase.from('outlets').select('id').eq('is_active', true),
          supabase.from('credit_sales').select('payment_status,total_price').eq('payment_status', 'UNPAID'),
        ]);
        const queryError = productsResult.error ?? outletsResult.error ?? salesResult.error;
        if (queryError) throw queryError;
        if (!active) return;
        const products = productsResult.data ?? [];
        const sales = salesResult.data ?? [];
        setSummary({
          products: products.length,
          factoryUnits: products.reduce((sum, row) => sum + Number(row.current_stock ?? 0), 0),
          outlets: outletsResult.data?.length ?? 0,
          unpaidSales: sales.length,
          unpaidValue: sales.reduce((sum, row) => sum + Number(row.total_price ?? 0), 0),
        });
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Could not load the admin summary.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo(
    () => [
      { href: '/factory', title: 'Factory Inventory', description: 'Live stock, batch movements and audit history', icon: Factory, tone: 'from-konjo-red/35 via-konjo-red/10 to-transparent', metric: `${summary.factoryUnits.toLocaleString()} units` },
      { href: '/admin/outlets', title: 'Outlets Management', description: 'Create, edit and archive field locations', icon: MapPinned, tone: 'from-konjo-amber/30 via-konjo-amber/10 to-transparent', metric: `${summary.outlets} locations` },
      { href: '/outlets', title: 'Outlets Portal', description: 'Open each outlet dashboard for stock, sales, payments and live activity', icon: Store, tone: 'from-konjo-green/35 via-konjo-green/10 to-transparent', metric: 'Open portal' },
      { href: '/admin/pricing', title: 'Price & Taxes', description: 'Maintain selling price and tax for every product', icon: CircleDollarSign, tone: 'from-violet-500/30 via-violet-500/10 to-transparent', metric: `${summary.products} products` },
      { href: '/admin/credit-sales', title: 'Operations Records', description: 'Review and edit credit sales, orders and samples', icon: ReceiptText, tone: 'from-cyan-500/30 via-cyan-500/10 to-transparent', metric: `${summary.unpaidSales} unpaid` },
      ...(root ? [{ href: '/admin/import', title: 'Data Import', description: 'Protected CSV, XLSX and PDF inventory synchronization', icon: FileSpreadsheet, tone: 'from-emerald-500/30 via-emerald-500/10 to-transparent', metric: 'Root only' }] : []),
    ],
    [root, summary]
  );

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.025] p-5 shadow-2xl shadow-black/20 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-konjo-red/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-konjo-amber/10 blur-3xl" />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-konjo-amber">Admin command center</p>
          <h1 className="mt-2 max-w-2xl font-display text-2xl font-bold leading-tight text-konjo-cream sm:text-4xl">Good operations begin with one clear view.</h1>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-konjo-cream/50 sm:text-sm">Choose any workspace below. You are no longer forced into factory stock after signing in.</p>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [Boxes, loading ? '…' : summary.factoryUnits.toLocaleString(), 'Factory units'],
              [ClipboardList, loading ? '…' : summary.products.toLocaleString(), 'Products'],
              [Building2, loading ? '…' : summary.outlets.toLocaleString(), 'Outlets'],
              [CircleDollarSign, loading ? '…' : formatWholeEtb(summary.unpaidValue), 'Unpaid value'],
            ].map(([Icon, value, label]) => {
              const MetricIcon = Icon as typeof Boxes;
              return <div key={String(label)} className="rounded-2xl border border-white/10 bg-black/15 p-3"><MetricIcon size={16} className="text-konjo-amber" /><p className="mt-2 truncate font-display text-lg font-bold tabular-nums text-konjo-cream">{String(value)}</p><p className="text-[9.5px] uppercase tracking-wide text-konjo-cream/35">{String(label)}</p></div>;
            })}
          </div>
          {error && <p className="mt-4 rounded-xl border border-konjo-amber/25 bg-konjo-amber/10 p-3 text-xs text-konjo-amber">Run the supplied database migration if these totals are unavailable: {error}</p>}
        </div>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.045, 0.25) }} whileHover={{ y: -3 }}>
              <Link href={card.href} className="group relative flex min-h-48 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/15 transition hover:border-white/20">
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.tone}`} />
                <div className="relative flex w-full flex-col">
                  <div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-konjo-cream"><Icon size={21} /></span><ArrowUpRight size={18} className="text-konjo-cream/30 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-konjo-cream" /></div>
                  <h2 className="mt-5 font-display text-lg font-bold text-konjo-cream">{card.title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-konjo-cream/45">{card.description}</p>
                  <p className="mt-auto pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-konjo-cream/55">{card.metric}</p>
                </div>
              </Link>
            </motion.div>
          );
        })}

        {root && (
          <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }} onClick={() => window.dispatchEvent(new Event(ROLE_MODAL_EVENT))} className="group relative flex min-h-48 overflow-hidden rounded-3xl border border-konjo-amber/20 bg-konjo-amber/[0.055] p-5 text-left shadow-xl shadow-black/15">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-konjo-amber/25 via-konjo-amber/5 to-transparent" />
            <div className="relative flex w-full flex-col"><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-konjo-amber/25 bg-konjo-amber/10 text-konjo-amber"><UsersRound size={21} /></span><ArrowUpRight size={18} className="text-konjo-amber/50" /></div><h2 className="mt-5 font-display text-lg font-bold text-konjo-cream">User Roles</h2><p className="mt-1 text-xs leading-relaxed text-konjo-cream/45">Promote field accounts to Admin or return them to Basic access.</p><p className="mt-auto pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-konjo-amber">Root only</p></div>
          </motion.button>
        )}
      </div>
    </main>
  );
}
