'use client';

import { memo, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PackageCheck, X } from 'lucide-react';
import { packsToBottles, productPackSize } from '@/lib/outlets';
import type { Product } from '@/lib/types';

export interface DeliveryEntry {
  productId: string;
  quantity: number;
  unit: 'PACK';
}

interface Props {
  open: boolean;
  products: Product[];
  onClose: () => void;
  onDeliver: (entries: DeliveryEntry[]) => Promise<boolean>;
}

function money(value: number): string {
  return `ETB ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SupermarketDeliveryModal({ open, products, onClose, onDeliver }: Props) {
  const [packs, setPacks] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const lines = useMemo(() => products.map((product) => {
    const quantity = packs[product.id] ?? 0;
    const packSize = productPackSize(product);
    const bottles = packsToBottles(quantity, packSize);
    const subtotal = bottles * Number(product.unit_price_etb ?? 0);
    const tax = subtotal * Number(product.tax_rate ?? 0);
    return { product, quantity, packSize, bottles, subtotal, tax, total: subtotal + tax };
  }).filter((line) => line.quantity > 0), [packs, products]);
  const entries: DeliveryEntry[] = lines.map((line) => ({ productId: line.product.id, quantity: line.quantity, unit: 'PACK' }));
  const bottleTotal = lines.reduce((sum, line) => sum + line.bottles, 0);
  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const tax = lines.reduce((sum, line) => sum + line.tax, 0);
  const grandTotal = subtotal + tax;

  const submit = async () => {
    if (!entries.length) return;
    setSubmitting(true);
    try {
      const ok = await onDeliver(entries);
      if (ok) { setPacks({}); onClose(); }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
        <motion.section initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} transition={{ type: 'tween', duration: 0.2 }} onClick={(event) => event.stopPropagation()} className="max-h-[92dvh] w-full max-w-lg overflow-hidden rounded-t-3xl border border-white/10 bg-konjo-charcoal-2 sm:rounded-3xl">
          <div className="flex items-start justify-between border-b border-white/10 p-4"><div><p className="flex items-center gap-2 font-display font-semibold text-konjo-cream"><PackageCheck size={17} className="text-konjo-green" />Log priced delivery</p><p className="mt-1 text-[11px] text-konjo-cream/40">Pack sizes, bottle prices, and tax come from Price &amp; Taxes.</p></div><button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-konjo-cream/60"><X size={16} /></button></div>
          <div className="max-h-[58dvh] space-y-2 overflow-y-auto p-4">
            {products.map((product) => { const quantity = packs[product.id] ?? 0; const packSize = productPackSize(product); const bottles = packsToBottles(quantity, packSize); const beforeTax = bottles * Number(product.unit_price_etb ?? 0); const taxAmount = beforeTax * Number(product.tax_rate ?? 0); return <label key={product.id} className="block rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="flex items-center gap-3"><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-konjo-cream">{product.name}</span><span className="text-[9.5px] text-konjo-cream/35">{packSize} bottles/pack · {money(Number(product.unit_price_etb ?? 0))}/bottle · {(Number(product.tax_rate ?? 0) * 100).toFixed(2)}% tax</span></span><input type="number" min={0} inputMode="numeric" value={quantity} onChange={(event) => setPacks((current) => ({ ...current, [product.id]: Math.max(0, Number.parseInt(event.target.value, 10) || 0) }))} aria-label={`${product.name} packs`} className="w-16 rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-center text-sm tabular-nums text-konjo-cream focus:outline-none" /><span className="w-10 text-[10px] text-konjo-cream/35">packs</span></div>{quantity > 0 && <p className="mt-2 border-t border-white/5 pt-2 text-[10px] text-konjo-cream/45">{quantity} × {packSize} = {bottles} bottles · {money(beforeTax)} + {money(taxAmount)} tax = <strong className="text-konjo-cream">{money(beforeTax + taxAmount)}</strong></p>}</label>; })}
          </div>
          <div className="border-t border-white/10 p-4"><div className="mb-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-black/15 p-2"><p className="text-xs font-semibold text-konjo-cream">{money(subtotal)}</p><p className="text-[8.5px] uppercase text-konjo-cream/30">Before tax</p></div><div className="rounded-lg bg-black/15 p-2"><p className="text-xs font-semibold text-konjo-amber">{money(tax)}</p><p className="text-[8.5px] uppercase text-konjo-cream/30">Tax</p></div><div className="rounded-lg bg-black/15 p-2"><p className="text-xs font-semibold text-konjo-green">{money(grandTotal)}</p><p className="text-[8.5px] uppercase text-konjo-cream/30">Total</p></div></div><button onClick={() => void submit()} disabled={submitting || !entries.length} className="h-12 w-full rounded-xl bg-gradient-to-br from-konjo-green to-konjo-green/70 font-display text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-40">{submitting ? 'Logging delivery…' : `Deliver ${bottleTotal} bottles · ${money(grandTotal)}`}</button></div>
        </motion.section>
      </motion.div>}
    </AnimatePresence>
  );
}

export default memo(SupermarketDeliveryModal);
