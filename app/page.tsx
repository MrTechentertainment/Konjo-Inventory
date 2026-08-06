'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Header from '@/components/Header';
import KpiCards from '@/components/KpiCards';
import ProductGrid from '@/components/ProductGrid';
import ErrorToast from '@/components/ErrorToast';
import { useAuth } from '@/lib/AuthContext';
import { useInventory } from '@/lib/useInventory';
import type { Product, TransactionType } from '@/lib/types';

const BatchAdjustModal = dynamic(() => import('@/components/BatchAdjustModal'), { ssr: false });
const AddProductModal = dynamic(() => import('@/components/AddProductModal'), { ssr: false });
const AuditDrawer = dynamic(() => import('@/components/AuditDrawer'), { ssr: false });
const ProductEditModal = dynamic(() => import('@/components/ProductEditModal'), { ssr: false });

export default function DashboardPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const { products, loading, error, clearError, syncState, adjustStock, addProduct, updateProduct, removeProduct } = useInventory(profile?.role !== 'BASIC');
  const [batchProduct, setBatchProduct] = useState<Product | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const authorized = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';

  useEffect(() => { if (profile?.role === 'BASIC') router.replace('/outlets'); }, [profile, router]);

  const handleQuickAdjust = useCallback((product: Product, delta: number) => {
    if (!profile || !authorized) return;
    void adjustStock({ product, delta, type: delta > 0 ? 'STOCK_IN' : 'STOCK_OUT', loggedBy: profile.username });
  }, [adjustStock, authorized, profile]);

  const handleBatchSubmit = useCallback(async (delta: number, type: TransactionType, notes: string) => {
    if (!profile || !batchProduct || !authorized) return false;
    return adjustStock({ product: batchProduct, delta, type, loggedBy: profile.username, notes });
  }, [adjustStock, authorized, batchProduct, profile]);

  if (!authorized) return null;
  return (
    <div className="min-h-dvh bg-konjo-charcoal pb-10">
      <Header syncState={syncState} onOpenAudit={() => setIsAuditOpen(true)} onOpenAddProduct={() => setIsAddOpen(true)} />
      <main className="mx-auto max-w-3xl pt-4">
        <KpiCards products={products} />
        {loading ? <div className="mt-10 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-konjo-red" /></div> : <div className="mt-4"><ProductGrid products={products} onQuickAdjust={handleQuickAdjust} onOpenBatch={setBatchProduct} onEdit={setEditProduct} onRemove={(product)=>{const reason=window.prompt(`Reason for removing ${product.name} from the catalog?`);if(reason)void removeProduct(product,reason)}} /></div>}
      </main>
      {batchProduct && <BatchAdjustModal product={batchProduct} staffName={profile.username} onClose={() => setBatchProduct(null)} onSubmit={handleBatchSubmit} />}
      {isAddOpen && <AddProductModal isOpen onClose={() => setIsAddOpen(false)} onSubmit={addProduct} />}
      {isAuditOpen && <AuditDrawer isOpen onClose={() => setIsAuditOpen(false)} />}
      {editProduct && <ProductEditModal product={editProduct} onClose={()=>setEditProduct(null)} onSave={updateProduct}/>} 
      <ErrorToast message={error} onDismiss={clearError} />
    </div>
  );
}
