'use client';

import { Check, CircleDollarSign, Loader2, Package, Percent } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage, withTimeout } from '@/lib/async';
import { supabase } from '@/lib/supabaseClient';
import type { Product } from '@/lib/types';

interface Draft { price: string; taxPercent: string; bottlesPerPack: string }

export default function PriceTaxManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await withTimeout(async (signal) => await supabase.from('products').select('*').eq('is_active', true).order('name').abortSignal(signal), 'Loading prices');
        if (result.error) throw result.error;
        const rows = (result.data as Product[]) ?? [];
        if (!active) return;
        setProducts(rows);
        setDrafts(Object.fromEntries(rows.map((product) => [product.id, { price: String(product.unit_price_etb ?? 0), taxPercent: String(Number(product.tax_rate ?? 0) * 100), bottlesPerPack: String(product.bottles_per_pack ?? 15) }])));
      } catch (caught) {
        if (active) setError(errorMessage(caught, 'Could not load product prices.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const save = async (product: Product) => {
    const draft = drafts[product.id];
    const price = Number(draft?.price);
    const taxPercent = Number(draft?.taxPercent);
    const bottlesPerPack = Number(draft?.bottlesPerPack);
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100 || !Number.isInteger(bottlesPerPack) || bottlesPerPack < 1 || bottlesPerPack > 10_000) {
      setError('Bottle price must be zero or more, tax must be between 0 and 100%, and bottles per pack must be a whole number from 1 to 10,000.');
      return;
    }
    setSavingId(product.id);
    setSavedId(null);
    setError(null);
    try {
      const result = await withTimeout(
        async (signal) => await supabase.rpc('admin_update_product_commercials', { target_product_id: product.id, new_unit_price: price, new_tax_rate: taxPercent / 100, new_bottles_per_pack: bottlesPerPack }).abortSignal(signal),
        `Saving ${product.name}`
      );
      if (result.error) throw result.error;
      const updated = (Array.isArray(result.data) ? result.data[0] : result.data) as Product | null;
      if (updated) setProducts((current) => current.map((row) => row.id === updated.id ? updated : row));
      setSavedId(product.id);
      window.setTimeout(() => setSavedId((current) => current === product.id ? null : current), 1800);
    } catch (caught) {
      setError(errorMessage(caught, 'The price did not save.'));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-konjo-red" /></div>;
  return <div className="space-y-3">{error && <p role="alert" className="rounded-xl border border-konjo-red/25 bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}{products.map((product) => { const draft = drafts[product.id] ?? { price: '0', taxPercent: '0', bottlesPerPack: '15' }; const price = Number(draft.price) || 0; const taxRate = (Number(draft.taxPercent) || 0) / 100; const packSize = Math.max(1, Number.parseInt(draft.bottlesPerPack, 10) || 1); const packBeforeTax = price * packSize; const packAfterTax = packBeforeTax * (1 + taxRate); return <article key={product.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-konjo-cream">{product.name}</h2><p className="font-mono text-[10px] text-konjo-cream/35">{product.sku}</p></div><button disabled={savingId === product.id} onClick={() => void save(product)} className="flex h-10 min-w-24 items-center justify-center gap-2 rounded-xl bg-konjo-red px-3 text-xs font-semibold text-white disabled:opacity-50">{savingId === product.id ? <><Loader2 size={14} className="animate-spin" />Saving…</> : savedId === product.id ? <><Check size={14} />Saved</> : 'Save'}</button></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><label><span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-konjo-cream/40"><CircleDollarSign size={12} />Price per bottle (ETB)</span><input type="number" min={0} step="0.01" value={draft.price} onChange={(event) => setDrafts((current) => ({ ...current, [product.id]: { ...draft, price: event.target.value } }))} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm tabular-nums text-konjo-cream focus:outline-none focus:ring-2 focus:ring-konjo-red/40" /></label><label><span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-konjo-cream/40"><Percent size={12} />Tax rate</span><input type="number" min={0} max={100} step="0.01" value={draft.taxPercent} onChange={(event) => setDrafts((current) => ({ ...current, [product.id]: { ...draft, taxPercent: event.target.value } }))} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm tabular-nums text-konjo-cream focus:outline-none focus:ring-2 focus:ring-konjo-red/40" /></label><label><span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-konjo-cream/40"><Package size={12} />Bottles per pack</span><input type="number" min={1} step={1} value={draft.bottlesPerPack} onChange={(event) => setDrafts((current) => ({ ...current, [product.id]: { ...draft, bottlesPerPack: event.target.value } }))} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm tabular-nums text-konjo-cream focus:outline-none focus:ring-2 focus:ring-konjo-red/40" /></label></div><div className="mt-3 rounded-xl border border-konjo-amber/15 bg-konjo-amber/[0.05] p-3 text-[10.5px] text-konjo-cream/50"><p>1 pack = {packSize} bottles</p><p className="mt-1">Pack value: ETB {packBeforeTax.toLocaleString(undefined, { maximumFractionDigits: 2 })} before tax · ETB {packAfterTax.toLocaleString(undefined, { maximumFractionDigits: 2 })} including tax</p></div></article>; })}</div>;
}
