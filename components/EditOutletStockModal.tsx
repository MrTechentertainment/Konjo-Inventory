'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pencil, X } from 'lucide-react';
import { productPackSize } from '@/lib/outlets';
import type { Product } from '@/lib/types';

interface Props {
  product: Product | null;
  currentStock: number;
  onClose: () => void;
  onSave: (productId: string, stockBottles: number, reason: string) => Promise<boolean>;
}

export default function EditOutletStockModal({ product, currentStock, onClose, onSave }: Props) {
  const [stock, setStock] = useState(String(currentStock));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);

  useEffect(() => {
    setStock(String(currentStock));
    setReason('');
    setValidation(null);
  }, [currentStock, product?.id]);

  if (!product) return null;
  const parsedStock = Number(stock);
  const packSize = productPackSize(product);
  const fullPacks = Number.isInteger(parsedStock) && parsedStock >= 0 ? Math.floor(parsedStock / packSize) : 0;
  const looseBottles = Number.isInteger(parsedStock) && parsedStock >= 0 ? parsedStock % packSize : 0;

  const save = async () => {
    if (!Number.isInteger(parsedStock) || parsedStock < 0) { setValidation('Enter a non-negative whole number of bottles.'); return; }
    if (reason.trim().length < 3) { setValidation('A correction reason of at least 3 characters is required.'); return; }
    setSaving(true);
    setValidation(null);
    try {
      if (await onSave(product.id, parsedStock, reason)) onClose();
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 sm:items-center sm:p-4" onClick={() => !saving && onClose()}><section onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-t-3xl border border-white/10 bg-konjo-charcoal-2 p-5 shadow-2xl sm:rounded-3xl"><div className="flex items-start justify-between"><div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-konjo-amber"><Pencil size={13} />Admin stock correction</p><h2 className="mt-1 font-display text-lg font-bold text-konjo-cream">{product.name}</h2><p className="text-[10.5px] text-konjo-cream/40">This changes the exact current bottle balance and creates an audit entry.</p></div><button onClick={onClose} disabled={saving} aria-label="Close" className="text-konjo-cream/40"><X size={19} /></button></div><label className="mt-5 block"><span className="text-[9px] font-bold uppercase tracking-wide text-konjo-cream/35">Current delivered stock (bottles)</span><input autoFocus type="number" min={0} step={1} inputMode="numeric" value={stock} onChange={(event) => setStock(event.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-lg font-semibold tabular-nums text-konjo-cream focus:border-konjo-red/50 focus:outline-none" /></label><p className="mt-2 rounded-lg bg-white/[0.035] px-3 py-2 text-[10.5px] text-konjo-cream/45">Pack conversion: {packSize} bottles/pack · New balance = {fullPacks} full pack{fullPacks === 1 ? '' : 's'}{looseBottles ? ` + ${looseBottles} loose bottle${looseBottles === 1 ? '' : 's'}` : ''}</p><label className="mt-4 block"><span className="text-[9px] font-bold uppercase tracking-wide text-konjo-cream/35">Correction reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Example: physical count correction" className="mt-1.5 min-h-20 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-konjo-cream placeholder:text-konjo-cream/25 focus:border-konjo-red/50 focus:outline-none" /></label>{validation && <p className="mt-3 text-[10.5px] text-konjo-red">{validation}</p>}<button onClick={() => void save()} disabled={saving} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-konjo-red font-display text-sm font-semibold text-white disabled:opacity-50">{saving ? <><Loader2 size={15} className="animate-spin" />Saving correction…</> : 'Save exact stock'}</button></section></div>;
}
