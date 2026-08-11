'use client';

import { memo, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PackageCheck, X } from 'lucide-react';
import { BOTTLES_PER_PACK } from '@/lib/outlets';
import type { Product } from '@/lib/types';

interface Props { open: boolean; products: Product[]; onClose: () => void; onDeliver: (entries: { productId: string; bottles: number }[]) => Promise<boolean>; }

function SupermarketDeliveryModal({ open, products, onClose, onDeliver }: Props) {
  const [packs, setPacks] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const entries = useMemo(() => products.map((product) => ({ productId: product.id, bottles: (packs[product.id] ?? 0) * BOTTLES_PER_PACK })).filter((entry) => entry.bottles > 0), [packs, products]);
  const total = entries.reduce((sum, entry) => sum + entry.bottles, 0);
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
        <motion.section initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} transition={{ type: 'tween', duration: 0.2 }} onClick={(event) => event.stopPropagation()} className="max-h-[90dvh] w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-konjo-charcoal-2 sm:rounded-3xl">
          <div className="flex items-start justify-between border-b border-white/10 p-4"><div><p className="flex items-center gap-2 font-display font-semibold text-konjo-cream"><PackageCheck size={17} className="text-konjo-green" />Log delivery</p><p className="mt-1 text-[11px] text-konjo-cream/40">Enter packs · {BOTTLES_PER_PACK} bottles per pack</p></div><button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-konjo-cream/60"><X size={16} /></button></div>
          <div className="max-h-[60dvh] space-y-2 overflow-y-auto p-4">
            {products.map((product) => <label key={product.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"><span className="min-w-0 flex-1 text-xs font-medium text-konjo-cream">{product.name}</span><input type="number" min={0} inputMode="numeric" value={packs[product.id] ?? 0} onChange={(event) => setPacks((current) => ({ ...current, [product.id]: Math.max(0, Number.parseInt(event.target.value, 10) || 0) }))} className="w-16 rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-center text-sm tabular-nums text-konjo-cream focus:outline-none" /><span className="w-10 text-[10px] text-konjo-cream/35">packs</span></label>)}
          </div>
          <div className="border-t border-white/10 p-4"><button onClick={() => void submit()} disabled={submitting || !entries.length} className="h-12 w-full rounded-xl bg-gradient-to-br from-konjo-green to-konjo-green/70 font-display text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-40">{submitting ? 'Logging delivery…' : `Deliver ${total} bottles`}</button></div>
        </motion.section>
      </motion.div>}
    </AnimatePresence>
  );
}

export default memo(SupermarketDeliveryModal);
