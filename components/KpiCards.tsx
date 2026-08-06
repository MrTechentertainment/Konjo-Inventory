'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Boxes, Package, TriangleAlert } from 'lucide-react';
import type { Product } from '@/lib/types';

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    if (!inView) return;
    const from = prevValue.current;
    const to = value;
    const duration = 500;
    const start = performance.now();

    let raf = 0;
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    prevValue.current = value;
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView]);

  return (
    <span ref={ref} className="tabular-nums">
      {display.toLocaleString()}
    </span>
  );
}

interface KpiCardsProps {
  products: Product[];
}

export default function KpiCards({ products }: KpiCardsProps) {
  const totalStock = products.reduce((sum, p) => sum + p.current_stock, 0);
  const totalProducts = products.length;
  const lowStock = products.filter((p) => p.current_stock <= p.low_stock_threshold);

  const cards = [
    {
      key: 'stock',
      label: 'Items in stock',
      value: totalStock,
      icon: Boxes,
      accent: 'from-konjo-red/25 to-konjo-red/0 text-konjo-red',
    },
    {
      key: 'products',
      label: 'Products tracked',
      value: totalProducts,
      icon: Package,
      accent: 'from-konjo-green/25 to-konjo-green/0 text-konjo-green',
    },
    {
      key: 'low',
      label: 'Low-stock alerts',
      value: lowStock.length,
      icon: TriangleAlert,
      accent:
        lowStock.length > 0
          ? 'from-konjo-amber/30 to-konjo-amber/0 text-konjo-amber'
          : 'from-white/10 to-white/0 text-konjo-cream/40',
    },
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-2.5 px-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35, ease: 'easeOut' }}
            className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${card.accent} bg-white/[0.04] p-3 backdrop-blur-md`}
          >
            <Icon size={16} strokeWidth={2.2} className="mb-2 opacity-90" />
            <p className="font-display text-xl font-semibold leading-none text-konjo-cream">
              <AnimatedNumber value={card.value} />
            </p>
            <p className="mt-1 text-[10.5px] leading-tight text-konjo-cream/55">{card.label}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
