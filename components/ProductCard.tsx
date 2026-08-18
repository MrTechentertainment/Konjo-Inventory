'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { memo } from 'react';
import { Minus, Pencil, Plus, SlidersHorizontal } from 'lucide-react';
import type { Product } from '@/lib/types';
import { getProductAccent } from '@/lib/productAccent';
import ProductThumbnail from './ProductThumbnail';

interface ProductCardProps {
  product: Product;
  onQuickAdjust: (product: Product, delta: number) => void;
  onOpenBatch: (product: Product) => void;
  canEditImage?: boolean;
  onEditImage?: (product: Product) => void;
}

function ProductCard({ product, onQuickAdjust, onOpenBatch, canEditImage = false, onEditImage }: ProductCardProps) {
  const accent = getProductAccent(product.name);
  const isLow = product.current_stock <= product.low_stock_threshold;
  const [pulseKey, setPulseKey] = useState(0);

  const bump = (delta: number) => {
    if (delta < 0 && product.current_stock <= 0) return;
    setPulseKey((k) => k + 1);
    onQuickAdjust(product, delta);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`relative min-h-[250px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] p-3.5 shadow-lg ring-1 backdrop-blur-md ${accent.ring} ${accent.glow}`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent.gradient}`} />

      <div className="relative mb-3 flex h-24 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/15 p-2">
        <ProductThumbnail imageUrl={product.image_url} alt={product.name} className="h-full w-full border-0 bg-transparent p-0" />
        {canEditImage && onEditImage && <button onClick={() => onEditImage(product)} aria-label={`Upload or edit ${product.name} image`} title="Root Owner: edit product image" className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg border border-konjo-amber/25 bg-konjo-charcoal/90 text-konjo-amber shadow-lg"><Pencil size={12} /></button>}
      </div>

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${accent.chip}`}>
            {product.category}
          </span>
          <h3 className="mt-1 truncate font-display text-[14.5px] font-semibold leading-tight text-konjo-cream">
            {product.name}
          </h3>
          <p className="font-mono text-[10.5px] tracking-tight text-konjo-cream/45">{product.sku}</p>
        </div>

        <button
          onClick={() => onOpenBatch(product)}
          aria-label={`Batch adjust ${product.name}`}
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-konjo-cream/60 transition active:scale-90 active:bg-white/15"
        >
          <SlidersHorizontal size={12.5} strokeWidth={2.2} />
        </button>
      </div>

      <div className="relative mt-3 flex items-end justify-between">
        <div className="flex items-baseline gap-1.5">
          <motion.span
            key={pulseKey}
            initial={{ scale: 1.18 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className={`font-display text-[28px] font-bold tabular-nums leading-none ${
              isLow ? 'text-konjo-amber' : 'text-konjo-cream'
            }`}
          >
            {product.current_stock}
          </motion.span>
          <span className="text-[11px] text-konjo-cream/40">in stock</span>
        </div>
        {isLow && (
          <span className="rounded-full bg-konjo-amber/15 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-konjo-amber">
            Low
          </span>
        )}
      </div>

      <div className="relative mt-3 flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => bump(-1)}
          disabled={product.current_stock <= 0}
          aria-label={`Remove one ${product.name}`}
          className="flex h-10 flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-konjo-cream/80 transition active:bg-white/15 disabled:opacity-30"
        >
          <Minus size={17} strokeWidth={2.5} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => bump(1)}
          aria-label={`Add one ${product.name}`}
          className="flex h-10 flex-1 items-center justify-center rounded-xl bg-gradient-to-br from-konjo-red to-konjo-red-deep text-white shadow-md shadow-konjo-red/30 transition active:brightness-110"
        >
          <Plus size={17} strokeWidth={2.5} />
        </motion.button>
      </div>
    </motion.div>
  );
}

export default memo(ProductCard);
