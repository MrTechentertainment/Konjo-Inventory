'use client';

import { memo, useMemo, useState } from 'react';
import { Minus, PackagePlus, Pencil } from 'lucide-react';
import { packsToBottles, productPackSize } from '@/lib/outlets';
import type { Outlet, Product } from '@/lib/types';

interface Props {
  outlet: Outlet;
  products: Product[];
  stockByProduct: Record<string, number>;
  onLogChange: (productId: string, changeBottles: number) => Promise<boolean>;
  onRecordDelivery: (entries: { productId: string; quantity: number; unit: 'PACK' }[]) => Promise<boolean>;
  canEditStock: boolean;
  onEditStock: (product: Product) => void;
}

function BazaarSalesTracker({ outlet, products, stockByProduct, onLogChange, onRecordDelivery, canEditStock, onEditStock }: Props) {
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [packs, setPacks] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const selectedProduct = products.find((product) => product.id === productId) ?? products[0];
  const packSize = productPackSize(selectedProduct ?? {});
  const bottleTotal = useMemo(() => packsToBottles(packs, packSize), [packSize, packs]);
  const subtotal = bottleTotal * Number(selectedProduct?.unit_price_etb ?? 0);
  const tax = subtotal * Number(selectedProduct?.tax_rate ?? 0);

  const addInitialStock = async () => {
    if (!productId || bottleTotal < 1) return;
    setSubmitting(true);
    try {
      const ok = await onRecordDelivery([{ productId, quantity: packs, unit: 'PACK' }]);
      if (ok) setPacks(1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 px-4 pb-10">
      <section className="rounded-2xl border border-konjo-amber/20 bg-konjo-amber/[0.07] p-4">
        <div className="flex items-center gap-2"><PackagePlus size={17} className="text-konjo-amber" /><h2 className="font-display text-sm font-semibold text-konjo-cream">Initial stock entry</h2></div>
        <p className="mt-1 text-[11px] text-konjo-cream/45">{selectedProduct ? `1 pack = ${packSize} bottles · ETB ${Number(selectedProduct.unit_price_etb ?? 0).toLocaleString()} per bottle` : 'Choose a product'}</p>
        <div className="mt-3 grid grid-cols-[1fr_88px] gap-2">
          <select value={productId} onChange={(event) => setProductId(event.target.value)} className="min-w-0 rounded-xl border border-white/10 bg-konjo-charcoal px-3 py-3 text-xs text-konjo-cream focus:outline-none">
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
          <input type="number" min={1} inputMode="numeric" value={packs} onChange={(event) => setPacks(Math.max(1, Number.parseInt(event.target.value, 10) || 1))} aria-label="Number of packs" className="rounded-xl border border-white/10 bg-konjo-charcoal px-3 py-3 text-center text-sm tabular-nums text-konjo-cream focus:outline-none" />
        </div>
        <p className="mt-2 text-[10px] text-konjo-cream/40">{bottleTotal} bottles · ETB {subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} before tax + ETB {tax.toLocaleString(undefined, { maximumFractionDigits: 2 })} tax = <strong className="text-konjo-cream">ETB {(subtotal + tax).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></p>
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
              <div className="flex min-h-9 items-start justify-between gap-2"><p className="text-xs font-semibold leading-tight text-konjo-cream">{product.name}</p>{canEditStock && <button onClick={() => onEditStock(product)} aria-label={`Edit ${product.name} current stock`} title="Edit exact current stock" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-konjo-amber/20 bg-konjo-amber/10 text-konjo-amber"><Pencil size={12} /></button>}</div>
              <p className="mt-2 font-display text-3xl font-bold tabular-nums text-konjo-cream">{stock}</p>
              <p className="text-[10px] text-konjo-cream/35">bottles remaining</p>
              <button disabled={stock < 1} onClick={() => void onLogChange(product.id, -1)} aria-label={`Sell one ${product.name}`} className="mt-3 flex h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-konjo-red text-sm font-bold text-white shadow-md shadow-konjo-red/20 transition active:scale-90 disabled:bg-white/5 disabled:text-konjo-cream/25 disabled:shadow-none"><Minus size={19} strokeWidth={3} />1 bottle</button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default memo(BazaarSalesTracker);
