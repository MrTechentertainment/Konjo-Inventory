'use client';

import { memo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { Product, ProductCreateInput } from '@/lib/types';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: ProductCreateInput) => Promise<Product | null>;
}

function AddProductModal({ isOpen, onClose, onSubmit }: AddProductModalProps) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [startingStock, setStartingStock] = useState('0');
  const [threshold, setThreshold] = useState('10');
  const [unitPrice, setUnitPrice] = useState('0');
  const [taxPercent, setTaxPercent] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setName('');
    setSku('');
    setCategory('');
    setStartingStock('0');
    setThreshold('10');
    setUnitPrice('0');
    setTaxPercent('0');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim() || !sku.trim() || !category.trim()) {
      setError('Name, SKU and category are all required.');
      return;
    }
    const price = Number(unitPrice);
    const tax = Number(taxPercent);
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(tax) || tax < 0 || tax > 100) {
      setError('Price must be zero or more, and tax must be between 0 and 100%.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit({
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        category: category.trim(),
        current_stock: Math.max(0, parseInt(startingStock, 10) || 0),
        low_stock_threshold: Math.max(0, parseInt(threshold, 10) || 10),
        unit_price_etb: price,
        tax_rate: tax / 100,
      });
      if (result) {
        reset();
        onClose();
      } else {
        setError('Could not add product — check the SKU is unique and try again.');
      }
    } catch {
      setError('Could not add product. Check the connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-konjo-charcoal-2 px-5 pb-8 pt-4 sm:rounded-3xl sm:border"
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden" />

          <div className="flex items-start justify-between">
            <p className="font-display text-base font-semibold text-konjo-cream">New product</p>
            <button
              onClick={handleClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-konjo-cream/60"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="text-[11px] font-medium text-konjo-cream/50">Product name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Konjo Datta Red"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13.5px] text-konjo-cream placeholder:text-konjo-cream/30 focus:outline-none focus:ring-2 focus:ring-konjo-red/40"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-konjo-cream/50">SKU</label>
                <input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="KDR-500"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-[13.5px] text-konjo-cream placeholder:text-konjo-cream/30 focus:outline-none focus:ring-2 focus:ring-konjo-red/40"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-konjo-cream/50">Category</label>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Datta"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13.5px] text-konjo-cream placeholder:text-konjo-cream/30 focus:outline-none focus:ring-2 focus:ring-konjo-red/40"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-konjo-cream/50">Unit price (ETB)</label>
                <input type="number" min={0} step="0.01" inputMode="decimal" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13.5px] tabular-nums text-konjo-cream focus:outline-none focus:ring-2 focus:ring-konjo-red/40" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-konjo-cream/50">Tax (%)</label>
                <input type="number" min={0} max={100} step="0.01" inputMode="decimal" value={taxPercent} onChange={(event) => setTaxPercent(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13.5px] tabular-nums text-konjo-cream focus:outline-none focus:ring-2 focus:ring-konjo-red/40" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-konjo-cream/50">Starting stock</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={startingStock}
                  onChange={(e) => setStartingStock(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13.5px] tabular-nums text-konjo-cream focus:outline-none focus:ring-2 focus:ring-konjo-red/40"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-konjo-cream/50">Low-stock alert at</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13.5px] tabular-nums text-konjo-cream focus:outline-none focus:ring-2 focus:ring-konjo-red/40"
                />
              </div>
            </div>
          </div>

          {error && <p className="mt-3 text-[12px] text-konjo-red">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-br from-konjo-red to-konjo-red-deep font-display text-[14px] font-semibold text-white shadow-lg shadow-konjo-red/30 transition active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? 'Adding…' : 'Add to catalog'}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default memo(AddProductModal);
