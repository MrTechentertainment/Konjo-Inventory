'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import ErrorToast from '@/components/ErrorToast';
import Header from '@/components/Header';
import KpiCards from '@/components/KpiCards';
import ProductGrid from '@/components/ProductGrid';
import { useAuth } from '@/lib/AuthContext';
import { isAdminProfile } from '@/lib/authz';
import type { Product, TransactionType } from '@/lib/types';
import { useInventory } from '@/lib/useInventory';

const BatchAdjustModal = dynamic(() => import('@/components/BatchAdjustModal'), { ssr: false });
const AddProductModal = dynamic(() => import('@/components/AddProductModal'), { ssr: false });
const AuditDrawer = dynamic(() => import('@/components/AuditDrawer'), { ssr: false });

export default function FactoryInventoryPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const authorized = isAdminProfile(profile);
  const { products, loading, error, clearError, syncState, adjustStock, addProduct } = useInventory(authorized);
  const [batchProduct, setBatchProduct] = useState<Product | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  useEffect(() => {
    if (profile && !authorized) router.replace('/outlets');
  }, [authorized, profile, router]);

  const handleQuickAdjust = useCallback(
    (product: Product, delta: number) => {
      if (!authorized) return;
      void adjustStock({ product, delta, type: delta > 0 ? 'STOCK_IN' : 'STOCK_OUT' });
    },
    [adjustStock, authorized]
  );

  const handleBatchSubmit = useCallback(
    async (delta: number, type: TransactionType, notes: string) => {
      if (!batchProduct || !authorized) return false;
      return adjustStock({ product: batchProduct, delta, type, notes });
    },
    [adjustStock, authorized, batchProduct]
  );

  if (!authorized) return null;
  return (
    <div className="min-h-dvh bg-konjo-charcoal pb-10">
      <Header syncState={syncState} title="Factory Inventory" subtitle="live warehouse stock" onOpenAudit={() => setIsAuditOpen(true)} onOpenAddProduct={() => setIsAddOpen(true)} />
      <main className="mx-auto max-w-3xl pt-4">
        <KpiCards products={products} />
        {loading ? (
          <div className="mt-10 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-konjo-red" /></div>
        ) : (
          <div className="mt-4"><ProductGrid products={products} onQuickAdjust={handleQuickAdjust} onOpenBatch={setBatchProduct} /></div>
        )}
      </main>
      {batchProduct && <BatchAdjustModal product={batchProduct} staffName={profile?.username ?? ''} onClose={() => setBatchProduct(null)} onSubmit={handleBatchSubmit} />}
      {isAddOpen && <AddProductModal isOpen onClose={() => setIsAddOpen(false)} onSubmit={addProduct} />}
      {isAuditOpen && <AuditDrawer isOpen onClose={() => setIsAuditOpen(false)} />}
      <ErrorToast message={error} onDismiss={clearError} />
    </div>
  );
}
