'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { daysAgoISO } from './time';
import type { InventoryTransactionWithProduct } from './types';
import { errorMessage, withTimeout } from './async';

const MAX_ROWS = 1000;

/**
 * Loads the audit ledger for the drawer. `days` is capped in the UI to 90 —
 * the compliance window this app is required to keep instantly retrievable
 * — but nothing here deletes or archives anything past that; every row ever
 * inserted stays in inventory_transactions forever (see sql/schema.sql).
 */
export function useAuditLedger(isOpen: boolean, days: number) {
  const [rows, setRows] = useState<InventoryTransactionWithProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const result = await withTimeout(
          async (signal) => await supabase.from('inventory_transactions').select('*, products ( name, sku )').gte('timestamp', daysAgoISO(days)).order('timestamp', { ascending: false }).limit(MAX_ROWS).abortSignal(signal),
          'Loading the audit ledger'
        );
        if (result.error) throw result.error;
        if (!cancelled) setRows((result.data as unknown as InventoryTransactionWithProduct[]) ?? []);
      } catch (caught) {
        if (!cancelled) setError(errorMessage(caught, 'Could not load the audit ledger.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [isOpen, days]);

  return { rows, loading, error };
}
