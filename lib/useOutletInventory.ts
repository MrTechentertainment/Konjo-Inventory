'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import type { DeliveryLineInput, DeliveryLogRow, Outlet, OutletInventory, PipelineStatus, PipelineSummary, Product } from './types';

export function useOutlets() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void supabase.from('outlets').select('*').order('type').order('name').then(({ data, error: queryError }) => {
      if (!active) return;
      setLoading(false);
      if (queryError) setError(queryError.message);
      else setOutlets((data as Outlet[]) ?? []);
    });
    return () => { active = false; };
  }, []);
  return { outlets, loading, error };
}

export function useOutletInventory(outletId: string) {
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<OutletInventory[]>([]);
  const [pending, setPending] = useState<Record<string, number>>({});
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLogRow[]>([]);
  const [pipeline, setPipeline] = useState<PipelineSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [outletResult, productsResult, inventoryResult, logsResult, pipelineResult] = await Promise.all([
      supabase.from('outlets').select('*').eq('id', outletId).single(),
      supabase.from('products').select('*').eq('is_active', true).order('category').order('name'),
      supabase.from('outlet_inventory').select('*').eq('outlet_id', outletId),
      supabase.rpc('get_delivery_logs', { target_outlet_id: outletId, row_limit: 100 }),
      supabase.rpc('get_outlet_pipeline', { target_outlet_id: outletId }),
    ]);
    const queryError = outletResult.error ?? productsResult.error ?? inventoryResult.error ?? logsResult.error ?? pipelineResult.error;
    if (queryError) setError(queryError.message);
    else {
      setOutlet(outletResult.data as Outlet);
      setProducts((productsResult.data as Product[]) ?? []);
      setInventory((inventoryResult.data as OutletInventory[]) ?? []);
      setDeliveryLogs((logsResult.data as DeliveryLogRow[]) ?? []);
      setPipeline((pipelineResult.data as PipelineSummary[]) ?? []);
    }
    setLoading(false);
  }, [outletId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const channel = supabase.channel(`outlet-inventory-${outletId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'outlet_inventory', filter: `outlet_id=eq.${outletId}` }, (payload) => {
      if (payload.eventType === 'DELETE') return;
      const row = payload.new as OutletInventory;
      setInventory((current) => current.some((item) => item.id === row.id) ? current.map((item) => item.id === row.id ? row : item) : [...current, row]);
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [outletId]);

  const stockByProduct = useMemo(() => Object.fromEntries(products.map((product) => {
    const stored = inventory.find((row) => row.product_id === product.id)?.stock_bottles ?? 0;
    return [product.id, stored + (pending[product.id] ?? 0)];
  })), [products, inventory, pending]);

  const recordSale = useCallback(async (productId: string, quantity = 1) => {
    if (!Number.isInteger(quantity) || quantity < 1) return false;
    setPending((current) => ({ ...current, [productId]: (current[productId] ?? 0) - quantity }));
    const { error: mutationError } = await supabase.rpc('record_outlet_sale', { target_outlet_id: outletId, target_product_id: productId, sold_quantity: quantity });
    setPending((current) => {
      const nextValue = (current[productId] ?? 0) + quantity;
      const next = { ...current };
      if (nextValue === 0) delete next[productId]; else next[productId] = nextValue;
      return next;
    });
    if (mutationError) { setError(mutationError.message); return false; }
    return true;
  }, [outletId]);

  const createDelivery = useCallback(async (items: DeliveryLineInput[], occurredAt: string, status: PipelineStatus = 'DELIVERED', notes = '') => {
    const deltas = Object.fromEntries(items.map(item => [item.product_id, item.quantity * (item.unit === 'PACK' ? 15 : 1)]));
    setPending(current => ({ ...current, ...Object.fromEntries(Object.entries(deltas).map(([id, delta]) => [id, (current[id] ?? 0) + delta])) }));
    const { error: mutationError } = await supabase.rpc('create_delivery', { target_outlet_id: outletId, occurred_at: occurredAt, items, delivery_status: status, device_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, delivery_notes: notes || null });
    setPending(current => { const next={...current}; for(const [id,delta] of Object.entries(deltas)){next[id]=(next[id]??0)-delta;if(next[id]===0)delete next[id];} return next; });
    if (mutationError) { setError(mutationError.message); return false; }
    await load(); return true;
  }, [load, outletId]);

  const createOrder = useCallback(async (items: DeliveryLineInput[], notes='') => {
    const { error: mutationError } = await supabase.rpc('create_stock_order', { target_outlet_id: outletId, items, order_notes: notes || null });
    if (mutationError) { setError(mutationError.message); return false; }
    await load(); return true;
  }, [load, outletId]);

  return { outlet, products, stockByProduct, deliveryLogs, pipeline, loading, error, clearError: () => setError(null), recordSale, createDelivery, createOrder, reload: load };
}
