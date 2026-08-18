'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage, isTransientError, newOperationId, withTimeout } from './async';
import { supabase } from './supabaseClient';
import type { Outlet, OutletInventory, Product } from './types';

function firstInventoryRow(data: unknown): OutletInventory | null {
  if (Array.isArray(data)) return (data[0] as OutletInventory | undefined) ?? null;
  return (data as OutletInventory | null) ?? null;
}

export function useOutlets() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await withTimeout(
          async (signal) =>
            await supabase
              .from('outlets')
              .select('*')
              .eq('is_active', true)
              .order('type')
              .order('name')
              .abortSignal(signal),
          'Loading outlets'
        );
        if (result.error) throw result.error;
        if (active) setOutlets((result.data as Outlet[]) ?? []);
      } catch (caught) {
        if (active) setError(errorMessage(caught, 'Could not load outlets.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return { outlets, loading, error };
}

export function useOutletInventory(outletId: string) {
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<OutletInventory[]>([]);
  const [pending, setPending] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<Record<string, number>>({});
  const queues = useRef(new Map<string, Promise<void>>());

  const upsertInventory = useCallback((row: OutletInventory) => {
    setInventory((current) => {
      const existing = current.find((item) => item.id === row.id);
      if (existing && Number(existing.stock_revision ?? 0) > Number(row.stock_revision ?? 0)) return current;
      return existing ? current.map((item) => (item.id === row.id ? row : item)) : [...current, row];
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const [outletResult, productsResult, inventoryResult] = await Promise.all([
        withTimeout(
          async (signal) => await supabase.from('outlets').select('*').eq('id', outletId).abortSignal(signal).single(),
          'Loading outlet'
        ),
        withTimeout(
          async (signal) =>
            await supabase.from('products').select('*').eq('is_active', true).order('category').order('name').abortSignal(signal),
          'Loading outlet products'
        ),
        withTimeout(
          async (signal) => await supabase.from('outlet_inventory').select('*').eq('outlet_id', outletId).abortSignal(signal),
          'Loading outlet stock'
        ),
      ]);
      const queryError = outletResult.error ?? productsResult.error ?? inventoryResult.error;
      if (queryError) throw queryError;
      setOutlet(outletResult.data as Outlet);
      setProducts((productsResult.data as Product[]) ?? []);
      setInventory((inventoryResult.data as OutletInventory[]) ?? []);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not load this outlet.'));
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`outlet-inventory-${outletId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'outlet_inventory', filter: `outlet_id=eq.${outletId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as OutletInventory;
          if ((pendingRef.current[row.product_id] ?? 0) === 0) upsertInventory(row);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [outletId, upsertInventory]);

  const stockByProduct = useMemo(
    () =>
      Object.fromEntries(
        products.map((product) => {
          const stored = inventory.find((row) => row.product_id === product.id)?.stock_bottles ?? 0;
          return [product.id, stored + (pending[product.id] ?? 0)];
        })
      ),
    [products, inventory, pending]
  );

  const logChange = useCallback(
    async (productId: string, changeBottles: number) => {
      if (!Number.isInteger(changeBottles) || changeBottles === 0) return false;
      const operationId = newOperationId();
      pendingRef.current[productId] = (pendingRef.current[productId] ?? 0) + changeBottles;
      setPending((current) => ({ ...current, [productId]: (current[productId] ?? 0) + changeBottles }));

      const previous = queues.current.get(productId) ?? Promise.resolve();
      let queueMarker: Promise<void>;
      const task = previous
        .catch(() => undefined)
        .then(async () => {
          try {
            const call = async () => {
              const result = await withTimeout(
                async (signal) =>
                  await supabase
                    .rpc('log_outlet_change_v2', {
                      target_outlet_id: outletId,
                      target_product_id: productId,
                      bottle_change: changeBottles,
                      p_operation_id: operationId,
                    })
                    .abortSignal(signal),
                'Saving outlet stock'
              );
              if (result.error) throw result.error;
              return result;
            };
            let result;
            try {
              result = await call();
            } catch (caught) {
              if (!isTransientError(caught)) throw caught;
              result = await call();
            }
            const confirmed = firstInventoryRow(result.data);
            if (!confirmed) throw new Error('Supabase did not return the updated outlet stock.');
            upsertInventory(confirmed);
            return true;
          } catch (caught) {
            setError(errorMessage(caught, 'The outlet stock change did not save.'));
            return false;
          } finally {
            pendingRef.current[productId] = (pendingRef.current[productId] ?? 0) - changeBottles;
            if (pendingRef.current[productId] === 0) delete pendingRef.current[productId];
            setPending((current) => {
              const nextValue = (current[productId] ?? 0) - changeBottles;
              const next = { ...current };
              if (nextValue === 0) delete next[productId];
              else next[productId] = nextValue;
              return next;
            });
          }
        });

      queueMarker = task.then(() => undefined, () => undefined);
      queues.current.set(productId, queueMarker);
      void queueMarker.finally(() => {
        if (queues.current.get(productId) === queueMarker) {
          queues.current.delete(productId);
          void load();
        }
      });
      return task;
    },
    [load, outletId, upsertInventory]
  );

  const recordDelivery = useCallback(async (entries: { productId: string; quantity: number; unit: 'PACK' | 'BOTTLE' }[]) => {
    if (!entries.length) return false;
    try {
      const result = await withTimeout(
        async (signal) => await supabase.rpc('record_priced_outlet_delivery_batch', {
          target_outlet_id: outletId,
          p_items: entries.map((entry) => ({ product_id: entry.productId, quantity: entry.quantity, unit: entry.unit })),
          p_operation_id: newOperationId(),
          p_notes: null,
        }).abortSignal(signal),
        'Saving priced delivery'
      );
      if (result.error) throw result.error;
      await load();
      window.dispatchEvent(new CustomEvent('konjo:outlet-updated', { detail: outletId }));
      return true;
    } catch (caught) {
      setError(errorMessage(caught, 'The priced delivery did not save.'));
      return false;
    }
  }, [load, outletId]);

  const setExactStock = useCallback(async (productId: string, targetStock: number, reason: string) => {
    if (!Number.isInteger(targetStock) || targetStock < 0) {
      setError('Current delivered stock must be a non-negative whole number of bottles.');
      return false;
    }
    if (reason.trim().length < 3) {
      setError('Enter a correction reason with at least 3 characters.');
      return false;
    }
    try {
      const result = await withTimeout(
        async (signal) => await supabase.rpc('admin_set_outlet_stock_exact', {
          target_outlet_id: outletId,
          target_product_id: productId,
          target_stock_bottles: targetStock,
          adjustment_reason: reason.trim(),
          p_operation_id: newOperationId(),
        }).abortSignal(signal),
        'Correcting outlet stock'
      );
      if (result.error) throw result.error;
      const confirmed = firstInventoryRow(result.data);
      if (confirmed) upsertInventory(confirmed);
      else await load();
      window.dispatchEvent(new CustomEvent('konjo:outlet-updated', { detail: outletId }));
      return true;
    } catch (caught) {
      setError(errorMessage(caught, 'The outlet stock correction did not save.'));
      return false;
    }
  }, [load, outletId, upsertInventory]);

  return {
    outlet,
    products,
    stockByProduct,
    loading,
    error,
    clearError: () => setError(null),
    logChange,
    recordDelivery,
    setExactStock,
  };
}
