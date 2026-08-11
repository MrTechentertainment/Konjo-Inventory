'use client';

import { memo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, X } from 'lucide-react';
import type { Product, TransactionType } from '@/lib/types';

interface BatchAdjustModalProps {
  product: Product | null;
  staffName: string;
  onClose: () => void;
  onSubmit: (delta: number, type: TransactionType, notes: string) => Promise<boolean>;
}

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'STOCK_IN', label: 'Stock in' },
  { value: 'STOCK_OUT', label: 'Stock out' },
  { value: 'AUDIT_ADJUSTMENT', label: 'Correction' },
];

function BatchAdjustModal({ product, staffName, onClose, onSubmit }: BatchAdjustModalProps) {
  const [type, setType] = useState<TransactionType>('STOCK_IN');
  const [quantity, setQuantity] = useState(1);
  const [sign, setSign] = useState<1 | -1>(1);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!product) return null;

  const isAudit = type === 'AUDIT_ADJUSTMENT';
  const effectiveSign = type === 'STOCK_IN' ? 1 : type === 'STOCK_OUT' ? -1 : sign;
  const wouldExceedStock = type === 'STOCK_OUT' && quantity > product.current_stock;

  const reset = () => {
    setType('STOCK_IN');
    setQuantity(1);
    setSign(1);
    setNotes('');
    setFormError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (quantity < 1) {
      setFormError('Quantity must be at least 1.');
      return;
    }
    if (wouldExceedStock) {
      setFormError(`Only ${product.current_stock} in stock — can't remove ${quantity}.`);
      return;
    }
    if (isAudit && notes.trim().length === 0) {
      setFormError('Corrections need a short note for the audit trail.');
      return;
    }

    setSubmitting(true);
    try {
      const ok = await onSubmit(quantity * effectiveSign, type, notes);
      if (ok) {
        reset();
        onClose();
      }
    } catch {
      setFormError('The stock change did not save. Check the connection and try again.');
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
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-konjo-charcoal-2 px-5 pb-8 pt-4"
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />

          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-base font-semibold text-konjo-cream">{product.name}</p>
              <p className="font-mono text-[11px] text-konjo-cream/45">
                {product.sku} · {product.current_stock} in stock
              </p>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-konjo-cream/60"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-1.5">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setType(opt.value)}
                className={`rounded-xl border px-2 py-2 text-[12px] font-medium transition ${
                  type === opt.value
                    ? 'border-konjo-red/40 bg-konjo-red/20 text-konjo-cream'
                    : 'border-white/10 bg-white/[0.03] text-konjo-cream/55'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-center gap-4">
            {isAudit && (
              <button
                onClick={() => setSign((s) => (s === 1 ? -1 : 1))}
                className={`flex h-12 w-12 items-center justify-center rounded-xl border text-lg font-semibold transition ${
                  sign === 1
                    ? 'border-konjo-green/40 bg-konjo-green/15 text-konjo-green'
                    : 'border-konjo-red/40 bg-konjo-red/15 text-konjo-red'
                }`}
                aria-label="Toggle correction direction"
              >
                {sign === 1 ? '+' : '−'}
              </button>
            )}

            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-konjo-cream active:scale-90"
              aria-label="Decrease quantity"
            >
              <Minus size={18} />
            </button>

            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-20 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-center font-display text-2xl font-bold tabular-nums text-konjo-cream focus:outline-none focus:ring-2 focus:ring-konjo-red/40"
            />

            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-konjo-cream active:scale-90"
              aria-label="Increase quantity"
            >
              <Plus size={18} />
            </button>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isAudit ? 'Reason for correction (required)' : 'Notes (optional)'}
            rows={2}
            className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] text-konjo-cream placeholder:text-konjo-cream/35 focus:outline-none focus:ring-2 focus:ring-konjo-red/40"
          />

          {formError && <p className="mt-2 text-[12px] text-konjo-red">{formError}</p>}

          <p className="mt-3 text-[11px] text-konjo-cream/40">Logging as {staffName}</p>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-br from-konjo-red to-konjo-red-deep font-display text-[14px] font-semibold text-white shadow-lg shadow-konjo-red/30 transition active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? 'Saving…' : `Confirm ${effectiveSign === 1 ? '+' : '−'}${quantity}`}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default memo(BatchAdjustModal);
