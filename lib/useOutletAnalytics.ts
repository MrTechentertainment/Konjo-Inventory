'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage, withTimeout } from './async';
import { isAdminProfile } from './authz';
import { useAuth } from './AuthContext';
import { sourceLocation, type SourceLocation } from './sourceProvenance';
import { supabase } from './supabaseClient';
import type { OutletDeliveryFinancialRow, OutletOperationFeedRow } from './types';

export interface OutletAnalyticsItem {
  sku: string;
  name: string;
  quantity: number;
}

export interface OutletOrderAnalytics {
  id: string;
  legacyReference: string | null;
  status: 'ORDERED' | 'DELIVERED' | 'UNKNOWN';
  orderDate: string | null;
  orderDateRaw: string | null;
  deliveryDate: string | null;
  deliveryDateRaw: string | null;
  recordStatus: 'DRAFT' | 'COMPLETE';
  qualityNotes: string[];
  items: OutletAnalyticsItem[];
  source: SourceLocation;
}

export interface OutletCreditAnalytics {
  id: string;
  legacyReference: string | null;
  paymentStatus: 'PAID' | 'UNPAID' | 'UNKNOWN';
  totalPrice: number | null;
  saleDate: string | null;
  saleDateRaw: string | null;
  dueDate: string | null;
  dueDateRaw: string | null;
  paymentDate: string | null;
  paymentDateRaw: string | null;
  recordStatus: 'DRAFT' | 'COMPLETE';
  qualityNotes: string[];
  items: OutletAnalyticsItem[];
  source: SourceLocation;
}

export interface MonthlyProductVolume {
  month: string;
  label: string;
  total: number;
  products: { sku: string; name: string; quantity: number }[];
}

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function qualityNotes(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function itemsFrom(rawItems: unknown): OutletAnalyticsItem[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((raw: any) => {
    const product = relation(raw.products as { sku?: string; name?: string } | { sku?: string; name?: string }[] | null);
    return {
      sku: product?.sku ?? 'UNKNOWN',
      name: product?.name ?? 'Unknown product',
      quantity: Number(raw.quantity ?? 0),
    };
  }).filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);
}

function monthKey(value: string | null): string | null {
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const local = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (!local) return null;
  const month = Number(local[2]);
  let year = Number(local[3]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function monthlyVolumes(orders: OutletOrderAnalytics[]): MonthlyProductVolume[] {
  const months = new Map<string, Map<string, { sku: string; name: string; quantity: number }>>();
  orders.forEach((order) => {
    const key = monthKey(order.orderDate ?? order.orderDateRaw ?? order.deliveryDate ?? order.deliveryDateRaw);
    if (!key) return;
    const products = months.get(key) ?? new Map<string, { sku: string; name: string; quantity: number }>();
    order.items.forEach((item) => {
      const current = products.get(item.sku) ?? { sku: item.sku, name: item.name, quantity: 0 };
      current.quantity += item.quantity;
      products.set(item.sku, current);
    });
    months.set(key, products);
  });
  return Array.from(months.entries()).map(([month, products]) => {
    const rows = Array.from(products.values()).sort((a, b) => b.quantity - a.quantity || a.sku.localeCompare(b.sku));
    return { month, label: monthLabel(month), total: rows.reduce((sum, row) => sum + row.quantity, 0), products: rows };
  }).sort((a, b) => b.month.localeCompare(a.month));
}

export function useOutletAnalytics(outletId: string) {
  const { profile } = useAuth();
  const canViewAdminAnalytics = isAdminProfile(profile);
  const [orders, setOrders] = useState<OutletOrderAnalytics[]>([]);
  const [creditSales, setCreditSales] = useState<OutletCreditAnalytics[]>([]);
  const [activity, setActivity] = useState<OutletOperationFeedRow[]>([]);
  const [deliveries, setDeliveries] = useState<OutletDeliveryFinancialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!outletId) return;
    try {
      const [orderResult, creditResult, feedResult, deliveryResult] = await withTimeout(async (signal) => await Promise.all([
        canViewAdminAnalytics ? supabase.from('sales_orders').select('id,legacy_reference,status,order_date,order_date_raw,delivery_date,delivery_date_raw,record_status,quality_notes,source_name,source_sheet,source_row,raw_row,sales_order_items(quantity,products(sku,name))').eq('outlet_id', outletId).order('order_date', { ascending: false, nullsFirst: false }).limit(250).abortSignal(signal) : Promise.resolve({ data: [], error: null }),
        canViewAdminAnalytics ? supabase.from('credit_sales').select('id,legacy_reference,payment_status,total_price,refilled_date,refilled_date_raw,due_date,due_date_raw,payment_date,payment_date_raw,record_status,quality_notes,source_name,source_sheet,source_row,raw_row,credit_sale_items(quantity,products(sku,name))').eq('outlet_id', outletId).order('refilled_date', { ascending: false, nullsFirst: false }).limit(250).abortSignal(signal) : Promise.resolve({ data: [], error: null }),
        canViewAdminAnalytics ? supabase.rpc('get_outlet_operations_feed', { row_limit: 500 }).abortSignal(signal) : Promise.resolve({ data: [], error: null }),
        supabase.rpc('get_outlet_delivery_financials', { target_outlet_id: outletId, row_limit: 250 }).abortSignal(signal),
      ]), 'Loading outlet analytics', 30_000);
      const requiredError = orderResult.error ?? creditResult.error;
      if (requiredError) throw requiredError;

      const mappedOrders: OutletOrderAnalytics[] = (orderResult.data ?? []).map((raw: any) => ({
        id: raw.id,
        legacyReference: raw.legacy_reference,
        status: raw.status ?? 'UNKNOWN',
        orderDate: raw.order_date,
        orderDateRaw: raw.order_date_raw,
        deliveryDate: raw.delivery_date,
        deliveryDateRaw: raw.delivery_date_raw,
        recordStatus: raw.record_status ?? 'COMPLETE',
        qualityNotes: qualityNotes(raw.quality_notes),
        items: itemsFrom(raw.sales_order_items),
        source: sourceLocation({ sourceName: raw.source_name, sourceSheet: raw.source_sheet, sourceRow: raw.source_row, rawRow: raw.raw_row }),
      }));
      const mappedCredit: OutletCreditAnalytics[] = (creditResult.data ?? []).map((raw: any) => ({
        id: raw.id,
        legacyReference: raw.legacy_reference,
        paymentStatus: raw.payment_status ?? 'UNKNOWN',
        totalPrice: raw.total_price === null ? null : Number(raw.total_price),
        saleDate: raw.refilled_date,
        saleDateRaw: raw.refilled_date_raw,
        dueDate: raw.due_date,
        dueDateRaw: raw.due_date_raw,
        paymentDate: raw.payment_date,
        paymentDateRaw: raw.payment_date_raw,
        recordStatus: raw.record_status ?? 'COMPLETE',
        qualityNotes: qualityNotes(raw.quality_notes),
        items: itemsFrom(raw.credit_sale_items),
        source: sourceLocation({ sourceName: raw.source_name, sourceSheet: raw.source_sheet, sourceRow: raw.source_row, rawRow: raw.raw_row }),
      }));

      setOrders(mappedOrders);
      setCreditSales(mappedCredit);
      setActivity(feedResult.error ? [] : ((feedResult.data as OutletOperationFeedRow[] | null) ?? []).filter((row) => row.outlet_id === outletId));
      setDeliveries(deliveryResult.error ? [] : ((deliveryResult.data as OutletDeliveryFinancialRow[] | null) ?? []).map((row) => ({
        ...row,
        quantity_entered: Number(row.quantity_entered),
        quantity_bottles: Number(row.quantity_bottles),
        bottles_per_pack: Number(row.bottles_per_pack),
        unit_price_etb: Number(row.unit_price_etb),
        tax_rate: Number(row.tax_rate),
        subtotal_etb: Number(row.subtotal_etb),
        tax_amount_etb: Number(row.tax_amount_etb),
        total_amount_etb: Number(row.total_amount_etb),
      })));
      const optionalErrors = [feedResult.error?.message, deliveryResult.error?.message].filter(Boolean);
      setError(optionalErrors.length ? `Historical analytics loaded, but some live details are unavailable: ${optionalErrors.join(' · ')}` : null);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not load this outlet’s historical analytics.'));
    } finally {
      setLoading(false);
    }
  }, [canViewAdminAnalytics, outletId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = (event: Event) => {
      if ((event as CustomEvent<string>).detail === outletId) void load();
    };
    window.addEventListener('konjo:outlet-updated', refresh);
    return () => window.removeEventListener('konjo:outlet-updated', refresh);
  }, [load, outletId]);
  useEffect(() => {
    if (!outletId) return;
    const channel = supabase.channel(`outlet-dashboard-${outletId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'outlet_logs', filter: `outlet_id=eq.${outletId}` }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, outletId]);

  const pendingPayments = useMemo(() => creditSales.filter((sale) => sale.paymentStatus === 'UNPAID'), [creditSales]);
  const monthlyVolume = useMemo(() => monthlyVolumes(orders), [orders]);
  const deliveryCounts = useMemo(() => ({
    delivered: orders.filter((order) => order.status === 'DELIVERED').length,
    ordered: orders.filter((order) => order.status === 'ORDERED').length,
    unknown: orders.filter((order) => order.status === 'UNKNOWN').length,
  }), [orders]);
  const undatedOrders = useMemo(() => orders.filter((order) => monthKey(order.orderDate ?? order.orderDateRaw ?? order.deliveryDate ?? order.deliveryDateRaw) === null).length, [orders]);
  const deliveredFinancials = useMemo(() => ({
    subtotal: deliveries.reduce((sum, row) => sum + row.subtotal_etb, 0),
    tax: deliveries.reduce((sum, row) => sum + row.tax_amount_etb, 0),
    total: deliveries.reduce((sum, row) => sum + row.total_amount_etb, 0),
  }), [deliveries]);

  return { orders, creditSales, pendingPayments, monthlyVolume, deliveryCounts, undatedOrders, activity, deliveries, deliveredFinancials, canViewAdminAnalytics, loading, error };
}
