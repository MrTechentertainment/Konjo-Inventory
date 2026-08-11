'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Boxes, MapPin } from 'lucide-react';
import Header from '@/components/Header';
import { useAuth } from '@/lib/AuthContext';
import { OUTLET_TYPE_LABEL } from '@/lib/outlets';
import { supabase } from '@/lib/supabaseClient';
import { formatEAT } from '@/lib/time';
import type { Outlet, OutletInventory, OutletOperationFeedRow, Product } from '@/lib/types';
import { errorMessage } from '@/lib/async';
import { isAdminProfile } from '@/lib/authz';

export default function OutletTrackerPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<OutletInventory[]>([]);
  const [feed, setFeed] = useState<OutletOperationFeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authorized = isAdminProfile(profile);

  const load = useCallback(async () => {
    if (!authorized) return;
    try {
      const [outletResult, productResult, inventoryResult, feedResult] = await Promise.all([
        supabase.from('outlets').select('*').eq('is_active', true).order('name'),
        supabase.from('products').select('*').eq('is_active', true),
        supabase.from('outlet_inventory').select('*'),
        supabase.rpc('get_outlet_operations_feed', { row_limit: 200 }),
      ]);
      const queryError = outletResult.error ?? productResult.error ?? inventoryResult.error ?? feedResult.error;
      if (queryError) throw queryError;
      setOutlets((outletResult.data as Outlet[]) ?? []);
      setProducts((productResult.data as Product[]) ?? []);
      setInventory((inventoryResult.data as OutletInventory[]) ?? []);
      setFeed((feedResult.data as OutletOperationFeedRow[]) ?? []);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not load outlet operations.'));
    } finally {
      setLoading(false);
    }
  }, [authorized]);

  useEffect(() => { if (!authorized) router.replace('/outlets'); else void load(); }, [authorized, load, router]);
  useEffect(() => {
    if (!authorized) return;
    const channel = supabase.channel('admin-outlet-tracker').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'outlet_logs' }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [authorized, load]);

  const remainingTotal = useMemo(() => inventory.reduce((sum, row) => sum + row.stock_bottles, 0), [inventory]);
  if (!authorized) return null;
  return (
    <div className="min-h-dvh bg-konjo-charcoal pb-10">
      <Header title="Outlet Operations Tracker" subtitle="admin oversight" />
      <main className="mx-auto max-w-4xl px-4 pt-5">
        <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><MapPin size={17} className="text-konjo-amber" /><p className="mt-2 font-display text-2xl font-bold text-konjo-cream">{outlets.length}</p><p className="text-[10px] text-konjo-cream/40">active locations</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><Boxes size={17} className="text-konjo-green" /><p className="mt-2 font-display text-2xl font-bold tabular-nums text-konjo-cream">{remainingTotal}</p><p className="text-[10px] text-konjo-cream/40">bottles across outlets</p></div></div>
        {error && <p className="mt-4 rounded-xl bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}
        {loading ? <p className="py-10 text-center text-xs text-konjo-cream/40">Loading live operations…</p> : (
          <>
            <section className="mt-6"><h2 className="font-display text-sm font-semibold text-konjo-cream">Remaining stock by location</h2><div className="mt-2 space-y-2">{outlets.map((outlet) => { const rows = inventory.filter((row) => row.outlet_id === outlet.id && row.stock_bottles !== 0); const total = rows.reduce((sum, row) => sum + row.stock_bottles, 0); return <details key={outlet.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><summary className="flex cursor-pointer list-none items-center justify-between"><span><span className="block text-xs font-semibold text-konjo-cream">{outlet.name}</span><span className="text-[10px] text-konjo-cream/35">{OUTLET_TYPE_LABEL[outlet.type]}</span></span><span className="font-display text-lg font-bold tabular-nums text-konjo-cream">{total}</span></summary><div className="mt-3 space-y-1 border-t border-white/10 pt-2">{rows.length ? rows.map((row) => <div key={row.id} className="flex justify-between text-[11px] text-konjo-cream/55"><span>{products.find((product) => product.id === row.product_id)?.name ?? 'Unknown product'}</span><span className="tabular-nums">{row.stock_bottles}</span></div>) : <p className="text-[11px] text-konjo-cream/30">No stock logged.</p>}</div></details>; })}</div></section>
            <section className="mt-6"><h2 className="flex items-center gap-2 font-display text-sm font-semibold text-konjo-cream"><Activity size={16} className="text-konjo-red" />Live activity feed</h2><div className="mt-2 space-y-2">{feed.map((row) => <article key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-konjo-cream">{row.product_name}</p><p className="mt-0.5 truncate text-[10.5px] text-konjo-cream/40">{row.outlet_name} · {row.username}</p></div><span className={`shrink-0 font-display text-sm font-bold tabular-nums ${row.change_bottles > 0 ? 'text-konjo-green' : 'text-konjo-red'}`}>{row.change_bottles > 0 ? '+' : ''}{row.change_bottles}</span></div><p className="mt-1 text-[9.5px] text-konjo-cream/25">{formatEAT(row.timestamp)}</p></article>)}{!feed.length && <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-konjo-cream/30">No outlet activity yet.</p>}</div></section>
          </>
        )}
      </main>
    </div>
  );
}
