'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import type { Product } from '@/lib/types';
import ProductCard from './ProductCard';

interface ProductGridProps {
  products: Product[];
  onQuickAdjust: (product: Product, delta: number) => void;
  onOpenBatch: (product: Product) => void;
  onEdit: (product: Product) => void;
  onRemove: (product: Product) => void;
}

export default function ProductGrid({ products, onQuickAdjust, onOpenBatch, onEdit, onRemove }: ProductGridProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | 'All'>('All');

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const filtered = products.filter((p) => {
    const matchesCategory = category === 'All' || p.category === category;
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="px-4">
      <div className="flex items-center gap-2">
        <div className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3">
          <Search size={15} className="shrink-0 text-konjo-cream/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search product or SKU"
            className="w-full bg-transparent text-[13px] text-konjo-cream placeholder:text-konjo-cream/35 focus:outline-none"
          />
        </div>
      </div>

      {categories.length > 2 && (
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full border px-3 py-1 text-[11.5px] font-medium transition ${
                category === c
                  ? 'border-konjo-red/40 bg-konjo-red/20 text-konjo-cream'
                  : 'border-white/10 bg-white/[0.03] text-konjo-cream/55'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-10 text-center">
          <p className="text-[13px] font-medium text-konjo-cream/60">No products match</p>
          <p className="mt-1 text-[11.5px] text-konjo-cream/35">Try a different search or category.</p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 pb-4">
          <AnimatePresence initial={false} mode="popLayout">
            {filtered.map((product) => (
              <motion.div key={product.id} layout="position" exit={{ opacity: 0 }}>
                <ProductCard product={product} onQuickAdjust={onQuickAdjust} onOpenBatch={onOpenBatch} onEdit={onEdit} onRemove={onRemove} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
