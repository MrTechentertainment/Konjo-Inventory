'use client';

import { useCallback, useEffect, useReducer, useState } from 'react';
import { supabase } from './supabaseClient';
import type { Product, SyncState, TransactionType } from './types';

interface State {
  serverProducts: Product[];
  pendingDeltas: Record<string, number>;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'SET_PRODUCTS'; products: Product[] }
  | { type: 'UPSERT_PRODUCT'; product: Product }
  | { type: 'ADD_PENDING'; productId: string; delta: number }
  | { type: 'CLEAR_PENDING'; productId: string; delta: number }
  | { type: 'SET_ERROR'; error: string | null };

const initialState: State = {
  serverProducts: [],
  pendingDeltas: {},
  loading: true,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PRODUCTS':
      return { ...state, serverProducts: action.products, pendingDeltas: {}, loading: false };
    case 'UPSERT_PRODUCT': {
      const exists = state.serverProducts.some((p) => p.id === action.product.id);
      return {
        ...state,
        serverProducts: exists
          ? state.serverProducts.map((p) => (p.id === action.product.id ? action.product : p))
          : [...state.serverProducts, action.product],
      };
    }
    case 'ADD_PENDING':
      return {
        ...state,
        pendingDeltas: {
          ...state.pendingDeltas,
          [action.productId]: (state.pendingDeltas[action.productId] ?? 0) + action.delta,
        },
      };
    case 'CLEAR_PENDING': {
      const next = (state.pendingDeltas[action.productId] ?? 0) - action.delta;
      const rest = { ...state.pendingDeltas };
      if (next === 0) {
        delete rest[action.productId];
      } else {
        rest[action.productId] = next;
      }
      return { ...state, pendingDeltas: rest };
    }
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
  loggedBy: string;
  notes?: string;
}

/**
 * Fetches the product catalog, keeps it in sync across every device via
 * Supabase Realtime, and exposes an optimistic `adjustStock` mutator.
 *
 * Optimistic math is deliberately kept as a *delta overlay* on top of the
 * last known server value (`pendingDeltas`), rather than mutating a copy of
 * the stock count directly. That means a slow network response, a realtime
 * push from a co-worker's phone, and a failed/rolled-back write can never
 * clobber each other or double-count — whichever arrives, the visible number
 * is always `server value + sum of this device's still-unconfirmed taps`.
 */
export function useInventory(enabled = true) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [inflight, setInflight] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (cancelled) return;
      if (error) {
        dispatch({ type: 'SET_ERROR', error: error.message });
        return;
      }
      dispatch({ type: 'SET_PRODUCTS', products: data ?? [] });
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    const channel = supabase
      .channel('products-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          dispatch({ type: 'UPSERT_PRODUCT', product: payload.new as Product });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const adjustStock = useCallback(async ({ product, delta, type, loggedBy, notes }: AdjustInput) => {
    dispatch({ type: 'ADD_PENDING', productId: product.id, delta });
    setInflight((n) => n + 1);

    const { error } = await supabase.from('inventory_transactions').insert({
      product_id: product.id,
      change_amount: delta,
      transaction_type: type,
      notes: notes?.trim() || null,
      logged_by: loggedBy,
    });

    setInflight((n) => Math.max(0, n - 1));
    dispatch({ type: 'CLEAR_PENDING', productId: product.id, delta });

    if (error) {
      dispatch({
        type: 'SET_ERROR',
        error: `"${product.name}" didn't save — ${error.message}. Stock reverted, try again.`,
      });
      return false;
    }
    return true;
  }, []);

  const addProduct = useCallback(
    async (input: Pick<Product, 'name' | 'sku' | 'category' | 'current_stock' | 'low_stock_threshold'>) => {
      const { data: productId, error } = await supabase.rpc('create_catalog_product', {
        product_name: input.name, product_sku: input.sku, product_category: input.category,
        product_description: '', starting_stock: input.current_stock, low_threshold: input.low_stock_threshold,
      });
      if (error) {
        dispatch({ type: 'SET_ERROR', error: `Couldn't add product — ${error.message}` });
        return null;
      }
      const { data, error: readError } = await supabase.from('products').select('*').eq('id', productId).single();
      if (readError) { dispatch({ type: 'SET_ERROR', error: readError.message }); return null; }
      dispatch({ type: 'UPSERT_PRODUCT', product: data as Product });
      return data as Product;
    },
    []
  );

  const updateProduct = useCallback(async (product: Product) => {
    const { error } = await supabase.rpc('update_catalog_product', { target_product_id: product.id, product_name: product.name,
      product_sku: product.sku, product_category: product.category, product_description: product.description ?? '', low_threshold: product.low_stock_threshold });
    if (error) { dispatch({ type: 'SET_ERROR', error: error.message }); return false; }
    const { data } = await supabase.from('products').select('*').eq('id', product.id).single();
    if (data) dispatch({ type: 'UPSERT_PRODUCT', product: data as Product }); return true;
  }, []);

  const removeProduct = useCallback(async (product: Product, reason: string) => {
    const { error } = await supabase.rpc('remove_catalog_product', { target_product_id: product.id, reason });
    if (error) { dispatch({ type: 'SET_ERROR', error: error.message }); return false; }
    dispatch({ type: 'SET_PRODUCTS', products: state.serverProducts.filter(item => item.id !== product.id) }); return true;
  }, [state.serverProducts]);

  const clearError = useCallback(() => dispatch({ type: 'SET_ERROR', error: null }), []);

  const products: Product[] = state.serverProducts.map((p) =>
    state.pendingDeltas[p.id]
      ? { ...p, current_stock: p.current_stock + state.pendingDeltas[p.id] }
      : p
  );

  const syncState: SyncState = !isOnline ? 'offline' : inflight > 0 ? 'syncing' : 'online';

  return {
    products,
    loading: state.loading,
    error: state.error,
    clearError,
    syncState,
    adjustStock,
    addProduct,
    updateProduct,
    removeProduct,
  };
}
