'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { errorMessage, isTransientError, newOperationId, withTimeout } from './async';
import { PRODUCT_IMAGE_BUCKET, productImageStoragePath, resizeProductImage } from './productImages';
import { supabase } from './supabaseClient';
import type { Product, ProductCreateInput, SyncState, TransactionType } from './types';

interface PendingMutation {
  productId: string;
  delta: number;
}

interface State {
  serverProducts: Product[];
  pending: Record<string, PendingMutation>;
  deferredRealtime: Record<string, Product>;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'SET_PRODUCTS'; products: Product[] }
  | { type: 'REALTIME_PRODUCT'; product: Product }
  | { type: 'START_MUTATION'; operationId: string; productId: string; delta: number }
  | { type: 'CONFIRM_MUTATION'; operationId: string; product: Product }
  | { type: 'FAIL_MUTATION'; operationId: string }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null };

const initialState: State = {
  serverProducts: [],
  pending: {},
  deferredRealtime: {},
  loading: true,
  error: null,
};

function revision(product: Product | undefined): number {
  return Number(product?.stock_revision ?? 0);
}

function upsertProduct(products: Product[], product: Product): Product[] {
  const current = products.find((item) => item.id === product.id);
  if (current && revision(current) > revision(product)) return products;
  return current
    ? products.map((item) => (item.id === product.id ? product : item))
    : [...products, product];
}

function hasPendingForProduct(pending: Record<string, PendingMutation>, productId: string): boolean {
  return Object.values(pending).some((mutation) => mutation.productId === productId);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PRODUCTS':
      return { ...state, serverProducts: action.products, loading: false };
    case 'REALTIME_PRODUCT':
      if (hasPendingForProduct(state.pending, action.product.id)) {
        const previous = state.deferredRealtime[action.product.id];
        if (previous && revision(previous) >= revision(action.product)) return state;
        return {
          ...state,
          deferredRealtime: { ...state.deferredRealtime, [action.product.id]: action.product },
        };
      }
      return { ...state, serverProducts: upsertProduct(state.serverProducts, action.product) };
    case 'START_MUTATION':
      return {
        ...state,
        pending: {
          ...state.pending,
          [action.operationId]: { productId: action.productId, delta: action.delta },
        },
      };
    case 'CONFIRM_MUTATION': {
      const pending = { ...state.pending };
      delete pending[action.operationId];
      const deferred = state.deferredRealtime[action.product.id];
      const confirmed = deferred && revision(deferred) > revision(action.product) ? deferred : action.product;
      const deferredRealtime = { ...state.deferredRealtime };
      if (!hasPendingForProduct(pending, action.product.id)) delete deferredRealtime[action.product.id];
      return {
        ...state,
        pending,
        deferredRealtime,
        serverProducts: upsertProduct(state.serverProducts, confirmed),
      };
    }
    case 'FAIL_MUTATION': {
      const pending = { ...state.pending };
      const failed = pending[action.operationId];
      delete pending[action.operationId];
      let serverProducts = state.serverProducts;
      const deferredRealtime = { ...state.deferredRealtime };
      if (failed && !hasPendingForProduct(pending, failed.productId) && deferredRealtime[failed.productId]) {
        serverProducts = upsertProduct(serverProducts, deferredRealtime[failed.productId]);
        delete deferredRealtime[failed.productId];
      }
      return { ...state, pending, deferredRealtime, serverProducts };
    }
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    default:
      return state;
  }
}

export interface AdjustInput {
  product: Product;
  delta: number;
  type: TransactionType;
  notes?: string;
}

function firstProduct(data: unknown): Product | null {
  if (Array.isArray(data)) return (data[0] as Product | undefined) ?? null;
  return (data as Product | null) ?? null;
}

export function useInventory(enabled = true) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [inflight, setInflight] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const queues = useRef(new Map<string, Promise<void>>());

  useEffect(() => {
    if (!enabled) return;
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [enabled]);

  const loadProducts = useCallback(async () => {
    if (!enabled) return;
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const result = await withTimeout(
        async (signal) =>
          await supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .order('category')
            .order('name')
            .abortSignal(signal),
        'Loading products'
      );
      if (result.error) throw result.error;
      dispatch({ type: 'SET_PRODUCTS', products: (result.data as Product[]) ?? [] });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', error: errorMessage(error, 'Could not load products.') });
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, [enabled]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel('products-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        if (payload.eventType !== 'DELETE') {
          dispatch({ type: 'REALTIME_PRODUCT', product: payload.new as Product });
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled]);

  const adjustStock = useCallback(async ({ product, delta, type, notes }: AdjustInput) => {
    if (!Number.isInteger(delta) || delta === 0) return false;
    const operationId = newOperationId();
    dispatch({ type: 'START_MUTATION', operationId, productId: product.id, delta });
    setInflight((count) => count + 1);

    const previous = queues.current.get(product.id) ?? Promise.resolve();
    let queueMarker: Promise<void>;
    const task = previous
      .catch(() => undefined)
      .then(async () => {
        try {
          const call = async () => {
            const result = await withTimeout(
              async (signal) =>
                await supabase
                  .rpc('adjust_inventory_stock', {
                    target_product_id: product.id,
                    stock_delta: delta,
                    movement_type: type,
                    movement_notes: notes?.trim() || null,
                    p_operation_id: operationId,
                  })
                  .abortSignal(signal),
              `Saving ${product.name}`
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
          const confirmed = firstProduct(result.data);
          if (!confirmed) throw new Error('Supabase did not return the updated product.');
          dispatch({ type: 'CONFIRM_MUTATION', operationId, product: confirmed });
          return true;
        } catch (error) {
          dispatch({ type: 'FAIL_MUTATION', operationId });
          dispatch({
            type: 'SET_ERROR',
            error: `“${product.name}” did not save. ${errorMessage(error, 'Stock was restored; try again.')}`,
          });
          return false;
        } finally {
          setInflight((count) => Math.max(0, count - 1));
        }
      });

    queueMarker = task.then(() => undefined, () => undefined);
    queues.current.set(product.id, queueMarker);
    void queueMarker.finally(() => {
      if (queues.current.get(product.id) === queueMarker) queues.current.delete(product.id);
    });
    return task;
  }, []);

  const addProduct = useCallback(async (input: ProductCreateInput) => {
    try {
      const result = await withTimeout(
        async (signal) =>
          await supabase
            .rpc('create_inventory_product', {
              product_name: input.name,
              product_sku: input.sku,
              product_category: input.category,
              starting_stock: input.current_stock,
              low_stock_level: input.low_stock_threshold,
              unit_price: input.unit_price_etb,
              product_tax_rate: input.tax_rate,
            })
            .abortSignal(signal),
        'Creating product'
      );
      if (result.error) throw result.error;
      const product = firstProduct(result.data);
      if (!product) throw new Error('Supabase did not return the new product.');
      dispatch({ type: 'REALTIME_PRODUCT', product });
      return product;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', error: errorMessage(error, 'Could not add the product.') });
      return null;
    }
  }, []);

  const setProductImage = useCallback(async (product: Product, file: File | null) => {
    setInflight((count) => count + 1);
    let uploadedPath: string | null = null;
    try {
      let nextUrl: string | null = null;
      if (file) {
        const resized = await resizeProductImage(file);
        uploadedPath = `${product.id}/${Date.now()}-${crypto.randomUUID()}.webp`;
        const upload = await withTimeout(
          async () => await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(uploadedPath!, resized, { contentType: 'image/webp', cacheControl: '31536000', upsert: false }),
          `Uploading ${product.name} image`
        );
        if (upload.error) throw upload.error;
        nextUrl = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(uploadedPath).data.publicUrl;
      }

      const result = await withTimeout(
        async (signal) => await supabase.rpc('root_set_product_image', { target_product_id: product.id, new_image_url: nextUrl }).abortSignal(signal),
        `Saving ${product.name} image`
      );
      if (result.error) throw result.error;
      const updated = firstProduct(result.data);
      if (!updated) throw new Error('Supabase did not return the updated product.');
      dispatch({ type: 'REALTIME_PRODUCT', product: updated });

      const oldPath = productImageStoragePath(product.image_url);
      if (oldPath && oldPath !== uploadedPath) void supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([oldPath]);
      return true;
    } catch (error) {
      if (uploadedPath) void supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([uploadedPath]);
      dispatch({ type: 'SET_ERROR', error: errorMessage(error, 'Could not save the product image.') });
      return false;
    } finally {
      setInflight((count) => Math.max(0, count - 1));
    }
  }, []);

  const products = useMemo(() => {
    const deltaByProduct = Object.values(state.pending).reduce<Record<string, number>>((totals, mutation) => {
      totals[mutation.productId] = (totals[mutation.productId] ?? 0) + mutation.delta;
      return totals;
    }, {});
    return state.serverProducts.map((product) => ({
      ...product,
      current_stock: product.current_stock + (deltaByProduct[product.id] ?? 0),
    }));
  }, [state.pending, state.serverProducts]);

  const clearError = useCallback(() => dispatch({ type: 'SET_ERROR', error: null }), []);
  const syncState: SyncState = !isOnline ? 'offline' : inflight > 0 ? 'syncing' : 'online';

  return {
    products,
    loading: enabled && state.loading,
    error: state.error,
    clearError,
    syncState,
    adjustStock,
    addProduct,
    setProductImage,
    reload: loadProducts,
  };
}
