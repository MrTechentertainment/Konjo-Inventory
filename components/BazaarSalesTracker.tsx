'use client';

import { memo, useMemo, useState } from 'react';
import { Minus, PackagePlus } from 'lucide-react';
import { BOTTLES_PER_PACK, packsToBottles } from '@/lib/outlets';
import type { DeliveryLineInput, Outlet, Product } from '@/lib/types';

interface Props {
  outlet: Outlet;
  products: Product[];
  stockByProduct: Record<string, number>;
  onCreateDelivery: (items: DeliveryLineInput[], occurredAt: string) => Promise<boolean>;
  onRecordSale: (productId: string, quantity?: number) => Promise<boolean>;
}

function BazaarSalesTracker({ outlet, products, stockByProduct, onCreateDelivery, onRecordSale }: Props) {
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [packs, setPacks] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const bottleTotal = useMemo(() => packsToBottles(packs), [packs]);

  const addInitialStock = async () => {
    if (!productId || bottleTotal < 1) return;
    setSubmitting(true);
    const ok = await onCreateDelivery([{ product_id: productId, quantity: packs, unit: 'PACK' }], new Date().toISOString());
    setSubmitting(false);
    if (ok) setPacks(1);
  };

  return (
    <div className="space-y-4 px-4 pb-10">
      <section className="rounded-2xl border border-konjo-amber/20 bg-konjo-amber/[0.07] p-4">
        <div className="flex items-center gap-2"><PackagePlus size={17} className="text-konjo-amber" /><h2 className="font-display text-sm font-semibold text-konjo-cream">Initial stock entry</h2></div>
        <p className="mt-1 text-[11px] text-konjo-cream/45">Universal conversion: 1 pack = {BOTTLES_PER_PACK} bottles</p>
        <div className="mt-3 grid grid-cols-[1fr_88px] gap-2">
          <select value={productId} onChange={(event) => setProductId(event.target.value)} className="min-w-0 rounded-xl border border-white/10 bg-konjo-charcoal px-3 py-3 text-xs text-konjo-cream focus:outline-none">
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
          <input type="number" min={1} inputMode="numeric" value={packs} onChange={(event) => setPacks(Math.max(1, Number.parseInt(event.target.value, 10) || 1))} aria-label="Number of packs" className="rounded-xl border border-white/10 bg-konjo-charcoal px-3 py-3 text-center text-sm tabular-nums text-konjo-cream focus:outline-none" />
        </div>
        <button onClick={() => void addInitialStock()} disabled={submitting} className="mt-2 flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-br from-konjo-amber to-konjo-red font-display text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50">{submitting ? 'Saving…' : `Add ${packs} pack${packs === 1 ? '' : 's'} · ${bottleTotal} bottles`}</button>
      </section>

      <div>
        <h2 className="font-display text-sm font-semibold text-konjo-cream">Live {outlet.type === 'BAZAAR' ? 'sales' : 'usage'}</h2>
        <p className="mt-0.5 text-[11px] text-konjo-cream/40">Each tap records one bottle immediately.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {products.map((product) => {
          const stock = stockByProduct[product.id] ?? 0;
          return (
            <article key={product.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-lg shadow-black/10">
              <p className="min-h-9 text-xs font-semibold leading-tight text-konjo-cream">{product.name}</p>
              <p className="mt-2 font-display text-3xl font-bold tabular-nums text-konjo-cream">{stock}</p>
              <p className="text-[10px] text-konjo-cream/35">bottles remaining</p>
              <button disabled={stock < 1} onClick={() => void onRecordSale(product.id, 1)} aria-label={`Sell one ${product.name}`} className="mt-3 flex h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-konjo-red text-sm font-bold text-white shadow-md shadow-konjo-red/20 transition active:scale-90 disabled:bg-white/5 disabled:text-konjo-cream/25 disabled:shadow-none"><Minus size={19} strokeWidth={3} />1 bottle</button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default memo(BazaarSalesTracker);
