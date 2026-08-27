'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { PackageCheck, X } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { packsToBottles, productPackSize } from '@/lib/outlets';
import type { Product } from '@/lib/types';
import ProductThumbnail from './ProductThumbnail';

export interface DeliveryEntry { productId: string; quantity: number; unit: 'PACK' }
interface Props { open: boolean; products: Product[]; onClose: () => void; onDeliver: (entries: DeliveryEntry[]) => Promise<boolean> }

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

  return <AnimatePresence>{open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"><motion.section initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} transition={{ type: 'tween', duration: 0.2 }} onClick={(event) => event.stopPropagation()} className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-konjo-charcoal-2 sm:rounded-3xl"><div className="flex shrink-0 items-start justify-between border-b border-white/10 p-4"><div className="min-w-0 pr-3"><p className="flex items-center gap-2 font-display font-semibold text-konjo-cream"><PackageCheck size={17} className="shrink-0 text-konjo-green" />Log priced delivery</p><p className="mt-1 text-[11px] leading-relaxed text-konjo-cream/40">Current pack sizes, bottle prices and tax are loaded from Price &amp; Taxes.</p></div><button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-konjo-cream/60"><X size={16} /></button></div><div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">{products.map((product) => {
    const quantity = packs[product.id] ?? 0;
    const packSize = productPackSize(product);
    const bottles = packsToBottles(quantity, packSize);
    const beforeTax = bottles * Number(product.unit_price_etb ?? 0);
    const taxAmount = beforeTax * Number(product.tax_rate ?? 0);
    return <article key={product.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><div className="flex items-start gap-3"><ProductThumbnail imageUrl={product.image_url} alt={product.name} className="h-14 w-14" /><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold leading-snug text-konjo-cream">{product.name}</h3><p className="mt-1 break-words text-[10px] leading-relaxed text-konjo-cream/40">SKU {product.sku} · {packSize} bottles/pack</p><p className="break-words text-[10px] leading-relaxed text-konjo-cream/40">{money(Number(product.unit_price_etb ?? 0))} per bottle · {(Number(product.tax_rate ?? 0) * 100).toFixed(2)}% tax</p></div></div><label className="mt-3 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/15 px-3"><span className="text-xs font-medium text-konjo-cream/60">Number of packs</span><input type="number" min={0} inputMode="numeric" value={quantity} onChange={(event) => setPacks((current) => ({ ...current, [product.id]: Math.max(0, Number.parseInt(event.target.value, 10) || 0) }))} aria-label={`${product.name} packs`} className="h-10 w-24 rounded-lg border border-white/10 bg-konjo-charcoal px-2 text-center text-base tabular-nums text-konjo-cream focus:outline-none focus:ring-2 focus:ring-konjo-red/35" /></label>{quantity > 0 && <p className="mt-2 break-words rounded-lg bg-konjo-green/[0.06] px-2.5 py-2 text-[10.5px] leading-relaxed text-konjo-cream/50">{quantity} packs × {packSize} = {bottles} bottles<br />{money(beforeTax)} + {money(taxAmount)} tax = <strong className="text-konjo-green">{money(beforeTax + taxAmount)}</strong></p>}</article>;
  })}</div><div className="shrink-0 border-t border-white/10 bg-konjo-charcoal-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"><div className="mb-3 grid grid-cols-1 gap-2 min-[390px]:grid-cols-3">{[[money(subtotal), 'Before tax', 'text-konjo-cream'], [money(tax), 'Tax', 'text-konjo-amber'], [money(grandTotal), 'Total', 'text-konjo-green']].map(([value, label, tone]) => <div key={label} className="rounded-lg bg-black/15 p-2 text-center"><p className={`break-words text-xs font-semibold ${tone}`}>{value}</p><p className="text-[8.5px] uppercase text-konjo-cream/30">{label}</p></div>)}</div><button onClick={() => void submit()} disabled={submitting || !entries.length} className="min-h-12 w-full rounded-xl bg-gradient-to-br from-konjo-green to-konjo-green/70 px-3 font-display text-sm font-semibold leading-snug text-white active:scale-[0.98] disabled:opacity-40">{submitting ? 'Logging delivery…' : `Deliver ${bottleTotal} bottles · ${money(grandTotal)}`}</button></div></motion.section></motion.div>}</AnimatePresence>;
}

export default memo(SupermarketDeliveryModal);
