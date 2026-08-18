'use client';

import dynamic from 'next/dynamic';
import { ArrowLeft, PackagePlus, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import BazaarSalesTracker from '@/components/BazaarSalesTracker';
import EditOutletStockModal from '@/components/EditOutletStockModal';
import ErrorToast from '@/components/ErrorToast';
import Header from '@/components/Header';
import OutletAnalyticsDashboard from '@/components/OutletAnalyticsDashboard';
import { isAdminProfile } from '@/lib/authz';
import { useAuth } from '@/lib/AuthContext';
import { OUTLET_TYPE_LABEL, productPackSize } from '@/lib/outlets';
import type { Product } from '@/lib/types';
import { useOutletInventory } from '@/lib/useOutletInventory';

const SupermarketDeliveryModal = dynamic(() => import('@/components/SupermarketDeliveryModal'), { ssr: false });

export default function OutletWorkspacePage() {
  const { profile } = useAuth();
  const canEditStock = isAdminProfile(profile);
  const params = useParams<{ outletId: string }>();
  const outletId = params.outletId;
  const { outlet, products, stockByProduct, loading, error, clearError, logChange, recordDelivery, setExactStock } = useOutletInventory(outletId);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const deliver = (entries: { productId: string; quantity: number; unit: 'PACK' }[]) => recordDelivery(entries);

  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-konjo-charcoal"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-konjo-red" /></div>;
  if (!outlet) return <div className="min-h-dvh bg-konjo-charcoal p-6 text-konjo-cream"><p>{error || 'Outlet not found.'}</p><Link href="/outlets" className="mt-4 inline-block text-konjo-red">Back to outlets</Link></div>;

  return (
    <div className="min-h-dvh bg-konjo-charcoal">
      <Header title={outlet.name} subtitle={OUTLET_TYPE_LABEL[outlet.type]} />
      <main className="mx-auto max-w-4xl pt-4">
        <div className="mb-4 flex items-center justify-between px-4"><Link href="/outlets" className="flex items-center gap-1.5 text-xs text-konjo-cream/55"><ArrowLeft size={15} />All outlets</Link>{outlet.type === 'SUPERMARKET' && <button onClick={() => setDeliveryOpen(true)} className="flex h-10 items-center gap-2 rounded-xl bg-konjo-green px-3 text-xs font-semibold text-white active:scale-95"><PackagePlus size={16} />New delivery</button>}</div>
        {outlet.type === 'SUPERMARKET' ? (
          <div className="px-4 pb-10">
            <div className="mb-3"><h1 className="font-display text-lg font-bold text-konjo-cream">Current delivered stock</h1><p className="text-[11px] text-konjo-cream/40">Pack size is configured per product in Price &amp; Taxes. Only Admins and the Root Owner can make exact stock corrections.</p></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {products.map((product) => <article key={product.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><div className="flex min-h-9 items-start justify-between gap-2"><p className="text-xs font-semibold leading-tight text-konjo-cream">{product.name}</p>{canEditStock && <button onClick={() => setEditingProduct(product)} aria-label={`Edit ${product.name} current stock`} title="Edit exact current stock" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-konjo-amber/20 bg-konjo-amber/10 text-konjo-amber"><Pencil size={12} /></button>}</div><p className="mt-2 font-display text-3xl font-bold tabular-nums text-konjo-cream">{stockByProduct[product.id] ?? 0}</p><p className="text-[10px] text-konjo-cream/35">bottles delivered · {productPackSize(product)}/pack</p></article>)}
            </div>
          </div>
        ) : <BazaarSalesTracker outlet={outlet} products={products} stockByProduct={stockByProduct} onLogChange={logChange} onRecordDelivery={recordDelivery} canEditStock={canEditStock} onEditStock={setEditingProduct} />}
        <OutletAnalyticsDashboard outlet={outlet} products={products} stockByProduct={stockByProduct} />
      </main>
      <SupermarketDeliveryModal open={deliveryOpen} products={products} onClose={() => setDeliveryOpen(false)} onDeliver={deliver} />
      {canEditStock && <EditOutletStockModal product={editingProduct} currentStock={editingProduct ? stockByProduct[editingProduct.id] ?? 0 : 0} onClose={() => setEditingProduct(null)} onSave={setExactStock} />}
      <ErrorToast message={error} onDismiss={clearError} />
    </div>
  );
}
