'use client';

import dynamic from 'next/dynamic';
import { ArrowLeft, PackagePlus, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import BazaarSalesTracker from '@/components/BazaarSalesTracker';
import ErrorToast from '@/components/ErrorToast';
import Header from '@/components/Header';
import OutletPipeline from '@/components/OutletPipeline';
import { BOTTLES_PER_PACK, OUTLET_TYPE_LABEL } from '@/lib/outlets';
import { useOutletInventory } from '@/lib/useOutletInventory';

const SupermarketDeliveryModal = dynamic(() => import('@/components/SupermarketDeliveryModal'), { ssr: false });

export default function OutletWorkspacePage({ params }: { params: { outletId: string } }) {
  const { outlet, products, stockByProduct, deliveryLogs, pipeline, loading, error, clearError, recordSale, createDelivery, createOrder } = useOutletInventory(params.outletId);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-konjo-charcoal"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-konjo-red" /></div>;
  if (!outlet) return <div className="min-h-dvh bg-konjo-charcoal p-6 text-konjo-cream"><p>Outlet not found.</p><Link href="/outlets" className="mt-4 inline-block text-konjo-red">Back to outlets</Link></div>;

  return (
    <div className="min-h-dvh bg-konjo-charcoal">
      <Header title={outlet.name} subtitle={OUTLET_TYPE_LABEL[outlet.type]} />
      <main className="mx-auto max-w-4xl pt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-4"><Link href="/outlets" className="flex items-center gap-1.5 text-xs text-konjo-cream/55"><ArrowLeft size={15} />All outlets</Link>{outlet.type === 'SUPERMARKET' && <div className="flex gap-2"><button onClick={() => setOrderOpen(true)} className="flex h-10 items-center gap-2 rounded-xl border border-konjo-amber/30 bg-konjo-amber/10 px-3 text-xs font-semibold text-konjo-amber active:scale-95"><ShoppingCart size={16} />Order bottles not delivered</button><button onClick={() => setDeliveryOpen(true)} className="flex h-10 items-center gap-2 rounded-xl bg-konjo-green px-3 text-xs font-semibold text-white active:scale-95"><PackagePlus size={16} />New delivery</button></div>}</div>
        {outlet.type === 'SUPERMARKET' ? (
          <div className="px-4 pb-10">
            <div className="mb-3"><h1 className="font-display text-lg font-bold text-konjo-cream">Current delivered stock</h1><p className="text-[11px] text-konjo-cream/40">All products use {BOTTLES_PER_PACK} bottles per pack.</p></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {products.map((product) => <article key={product.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="min-h-9 text-xs font-semibold leading-tight text-konjo-cream">{product.name}</p><p className="mt-2 font-display text-3xl font-bold tabular-nums text-konjo-cream">{stockByProduct[product.id] ?? 0}</p><p className="text-[10px] text-konjo-cream/35">bottles delivered</p></article>)}
            </div>
            <div className="mt-6"><OutletPipeline pipeline={pipeline} logs={deliveryLogs}/></div>
          </div>
        ) : <BazaarSalesTracker outlet={outlet} products={products} stockByProduct={stockByProduct} onCreateDelivery={(items,date)=>createDelivery(items,date)} onRecordSale={recordSale} />}
      </main>
      <SupermarketDeliveryModal open={deliveryOpen} products={products} onClose={() => setDeliveryOpen(false)} onSubmit={(items,date,status,notes)=>createDelivery(items,date,status,notes)} />
      <SupermarketDeliveryModal open={orderOpen} mode="ORDER" products={products} onClose={() => setOrderOpen(false)} onSubmit={(items,_date,_status,notes)=>createOrder(items,notes)} />
      <ErrorToast message={error} onDismiss={clearError} />
    </div>
  );
}
