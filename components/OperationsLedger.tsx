'use client';

import { AlertTriangle, CheckCircle2, Loader2, Pencil, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage, withTimeout } from '@/lib/async';
import { supabase } from '@/lib/supabaseClient';

type Kind = 'CREDIT' | 'ORDER' | 'SAMPLE' | 'INVENTORY';
interface Product { id: string; sku: string; name: string }
interface Item {
  sku: string;
  name: string;
  quantity: number;
  producedQuantity?: number | null;
  sampleOutQuantity?: number | null;
  supermarketOutQuantity?: number | null;
  endingStock?: number | null;
}
interface Outlet { name: string; address: string | null; subcity: string | null }
interface RecordRow {
  id: string;
  kind: Kind;
  recordStatus: 'DRAFT' | 'COMPLETE';
  qualityNotes: string[];
  legacyReference: string | null;
  outlet: Outlet;
  status: string;
  primaryDate: string | null;
  secondaryDate: string | null;
  thirdDate: string | null;
  totalPrice: number | null;
  items: Item[];
  fields: Record<string, string | null>;
}

function relation<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function formatEtb(value: number): string { return `ETB ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function safeJsonArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }

function TextField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="block"><span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-konjo-cream/35">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-konjo-cream placeholder:text-konjo-cream/20 focus:border-konjo-red/50 focus:outline-none" /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-konjo-cream/35">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-konjo-charcoal-2 px-3 text-xs text-konjo-cream focus:border-konjo-red/50 focus:outline-none">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

export default function OperationsLedger() {
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [tab, setTab] = useState<Kind>('CREDIT');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [inventoryQuantities, setInventoryQuantities] = useState<Record<string, { produced: string; sample: string; supermarket: string; ending: string }>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const [productResult, creditResult, orderResult, sampleResult, inventoryResult] = await withTimeout(async (signal) => await Promise.all([
        supabase.from('products').select('id,sku,name').eq('is_active', true).order('sku').abortSignal(signal),
        supabase.from('credit_sales').select('id,legacy_reference,payment_status,total_price,refilled_date_raw,due_date_raw,payment_date_raw,bottle_price_raw,agreement_period,payment_type,notes,sales_representative,record_status,quality_notes,outlets(name,address,subcity),credit_sale_items(quantity,products(sku,name))').order('refilled_date', { ascending: false, nullsFirst: false }).limit(1000).abortSignal(signal),
        supabase.from('sales_orders').select('id,legacy_reference,status,order_date_raw,delivery_date_raw,notes,record_status,quality_notes,outlets(name,address,subcity),sales_order_items(quantity,products(sku,name))').order('order_date', { ascending: false, nullsFirst: false }).limit(1000).abortSignal(signal),
        supabase.from('product_samples').select('id,legacy_reference,phone,supermarket_representative,sales_representative,date_given_raw,remark,status,feedback,record_status,quality_notes,outlets(name,address,subcity)').order('date_given', { ascending: false, nullsFirst: false }).limit(1000).abortSignal(signal),
        supabase.from('inventory_ledger_entries').select('id,entry_date_raw,reason,notes,sales_representative,source_name,source_sheet,source_row,record_status,quality_notes,inventory_ledger_items(produced_quantity,sample_out_quantity,supermarket_out_quantity,ending_stock,products(sku,name))').order('entry_date', { ascending: false, nullsFirst: false }).limit(1000).abortSignal(signal),
      ]), 'Loading operations records', 30_000);
      const failure = productResult.error ?? creditResult.error ?? orderResult.error ?? sampleResult.error ?? inventoryResult.error;
      if (failure) throw failure;
      setProducts((productResult.data as Product[]) ?? []);
      const credits: RecordRow[] = (creditResult.data ?? []).map((raw: any) => {
        const outlet = relation(raw.outlets) ?? { name: 'Missing outlet', address: null, subcity: null };
        return { id: raw.id, kind: 'CREDIT', recordStatus: raw.record_status ?? 'COMPLETE', qualityNotes: safeJsonArray(raw.quality_notes), legacyReference: raw.legacy_reference, outlet, status: raw.payment_status, primaryDate: raw.refilled_date_raw, secondaryDate: raw.due_date_raw, thirdDate: raw.payment_date_raw, totalPrice: raw.total_price === null ? null : Number(raw.total_price), items: (raw.credit_sale_items ?? []).map((item: any) => { const product = relation(item.products); return { sku: product?.sku ?? '', name: product?.name ?? '', quantity: Number(item.quantity) }; }).filter((item: Item) => item.sku), fields: { bottle_price_raw: raw.bottle_price_raw, agreement_period: raw.agreement_period, payment_type: raw.payment_type, notes: raw.notes, sales_representative: raw.sales_representative } };
      });
      const orders: RecordRow[] = (orderResult.data ?? []).map((raw: any) => {
        const outlet = relation(raw.outlets) ?? { name: 'Missing outlet', address: null, subcity: null };
        return { id: raw.id, kind: 'ORDER', recordStatus: raw.record_status ?? 'COMPLETE', qualityNotes: safeJsonArray(raw.quality_notes), legacyReference: raw.legacy_reference, outlet, status: raw.status, primaryDate: raw.order_date_raw, secondaryDate: raw.delivery_date_raw, thirdDate: null, totalPrice: null, items: (raw.sales_order_items ?? []).map((item: any) => { const product = relation(item.products); return { sku: product?.sku ?? '', name: product?.name ?? '', quantity: Number(item.quantity) }; }).filter((item: Item) => item.sku), fields: { notes: raw.notes } };
      });
      const samples: RecordRow[] = (sampleResult.data ?? []).map((raw: any) => {
        const outlet = relation(raw.outlets) ?? { name: 'Missing outlet', address: null, subcity: null };
        return { id: raw.id, kind: 'SAMPLE', recordStatus: raw.record_status ?? 'COMPLETE', qualityNotes: safeJsonArray(raw.quality_notes), legacyReference: raw.legacy_reference, outlet, status: raw.status, primaryDate: raw.date_given_raw, secondaryDate: null, thirdDate: null, totalPrice: null, items: [], fields: { phone: raw.phone, supermarket_representative: raw.supermarket_representative, sales_representative: raw.sales_representative, remark: raw.remark, feedback: raw.feedback } };
      });
      const inventory: RecordRow[] = (inventoryResult.data ?? []).map((raw: any) => {
        const items: Item[] = (raw.inventory_ledger_items ?? []).map((item: any) => {
          const product = relation(item.products);
          const produced = item.produced_quantity === null ? null : Number(item.produced_quantity);
          const sample = item.sample_out_quantity === null ? null : Number(item.sample_out_quantity);
          const supermarket = item.supermarket_out_quantity === null ? null : Number(item.supermarket_out_quantity);
          return {
            sku: product?.sku ?? '', name: product?.name ?? '', quantity: (produced ?? 0) - (sample ?? 0) - (supermarket ?? 0),
            producedQuantity: produced, sampleOutQuantity: sample, supermarketOutQuantity: supermarket,
            endingStock: item.ending_stock === null ? null : Number(item.ending_stock),
          };
        }).filter((item: Item) => item.sku);
        return {
          id: raw.id, kind: 'INVENTORY', recordStatus: raw.record_status ?? 'COMPLETE', qualityNotes: safeJsonArray(raw.quality_notes),
          legacyReference: raw.source_row?.toString() ?? null,
          outlet: { name: 'Factory inventory', address: raw.source_sheet ?? null, subcity: raw.source_name ?? null },
          status: 'HISTORICAL', primaryDate: raw.entry_date_raw, secondaryDate: null, thirdDate: null, totalPrice: null, items,
          fields: { reason: raw.reason, notes: raw.notes, sales_representative: raw.sales_representative, source_sheet: raw.source_sheet },
        };
      });
      setRows([...credits, ...orders, ...samples, ...inventory]);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not load operations records.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openEditor = (row: RecordRow) => {
    setEditing(row);
    setError(null);
    setForm({
      outlet: row.outlet.name.startsWith('[Incomplete ') ? '' : row.outlet.name,
      address: row.outlet.address ?? '', subcity: row.outlet.subcity ?? '', reference: row.legacyReference ?? '', status: row.status,
      primaryDate: row.primaryDate ?? '', secondaryDate: row.secondaryDate ?? '', thirdDate: row.thirdDate ?? '', total: row.totalPrice?.toString() ?? '',
      bottlePrice: row.fields.bottle_price_raw ?? '', agreement: row.fields.agreement_period ?? '', paymentType: row.fields.payment_type ?? '', notes: row.fields.notes ?? '', salesRepresentative: row.fields.sales_representative ?? '',
      phone: row.fields.phone ?? '', supermarketRepresentative: row.fields.supermarket_representative ?? '', remark: row.fields.remark ?? '', feedback: row.fields.feedback ?? '',
      reason: row.fields.reason ?? '',
    });
    setQuantities(Object.fromEntries(products.map((product) => [product.sku, row.items.find((item) => item.sku === product.sku)?.quantity.toString() ?? ''])));
    setInventoryQuantities(Object.fromEntries(products.map((product) => {
      const item = row.items.find((candidate) => candidate.sku === product.sku);
      return [product.sku, {
        produced: item?.producedQuantity?.toString() ?? '', sample: item?.sampleOutQuantity?.toString() ?? '',
        supermarket: item?.supermarketOutQuantity?.toString() ?? '', ending: item?.endingStock?.toString() ?? '',
      }];
    })));
  };

  const update = (key: string) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  const itemsPayload = () => products.map((product) => ({ sku: product.sku, quantity: Number(quantities[product.sku]) })).filter((item) => Number.isInteger(item.quantity) && item.quantity > 0);
  const inventoryItemsPayload = () => products.map((product) => {
    const values = inventoryQuantities[product.sku] ?? { produced: '', sample: '', supermarket: '', ending: '' };
    const parse = (value: string) => value.trim() === '' ? null : Number(value);
    return { sku: product.sku, produced_quantity: parse(values.produced), sample_out_quantity: parse(values.sample), supermarket_out_quantity: parse(values.supermarket), ending_stock: parse(values.ending) };
  }).filter((item) => [item.produced_quantity, item.sample_out_quantity, item.supermarket_out_quantity, item.ending_stock].some((value) => value !== null));

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const response = await withTimeout(async (signal) => {
        if (editing.kind === 'CREDIT') return await supabase.rpc('admin_update_credit_sale', {
          p_sale_id: editing.id, p_outlet_name: form.outlet, p_address: form.address, p_subcity: form.subcity, p_legacy_reference: form.reference,
          p_payment_status: form.status, p_total_price: form.total === '' ? null : Number(form.total), p_refilled_date_raw: form.primaryDate,
          p_due_date_raw: form.secondaryDate, p_payment_date_raw: form.thirdDate, p_bottle_price_raw: form.bottlePrice,
          p_agreement_period: form.agreement, p_payment_type: form.paymentType, p_notes: form.notes,
          p_sales_representative: form.salesRepresentative, p_items: itemsPayload(),
        }).abortSignal(signal);
        if (editing.kind === 'ORDER') return await supabase.rpc('admin_update_sales_order', {
          p_order_id: editing.id, p_outlet_name: form.outlet, p_address: form.address, p_legacy_reference: form.reference,
          p_status: form.status, p_order_date_raw: form.primaryDate, p_delivery_date_raw: form.secondaryDate, p_notes: form.notes, p_items: itemsPayload(),
        }).abortSignal(signal);
        if (editing.kind === 'SAMPLE') return await supabase.rpc('admin_update_product_sample', {
          p_sample_id: editing.id, p_outlet_name: form.outlet, p_address: form.address, p_legacy_reference: form.reference,
          p_phone: form.phone, p_supermarket_representative: form.supermarketRepresentative, p_sales_representative: form.salesRepresentative,
          p_date_given_raw: form.primaryDate, p_remark: form.remark, p_status: form.status, p_feedback: form.feedback,
        }).abortSignal(signal);
        return await supabase.rpc('admin_update_inventory_ledger_entry', {
          p_entry_id: editing.id, p_entry_date_raw: form.primaryDate, p_reason: form.reason,
          p_notes: form.notes, p_sales_representative: form.salesRepresentative, p_items: inventoryItemsPayload(),
        }).abortSignal(signal);
      }, 'Saving record', 30_000);
      if (response.error) throw response.error;
      setEditing(null);
      setLoading(true);
      await load();
    } catch (caught) {
      setError(errorMessage(caught, 'Could not save this record.'));
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => rows.filter((row) => row.kind === tab && `${row.outlet.name} ${row.outlet.address ?? ''} ${row.legacyReference ?? ''} ${row.status}`.toLowerCase().includes(query.trim().toLowerCase())), [query, rows, tab]);
  const tabRows = rows.filter((row) => row.kind === tab);
  const draftCount = tabRows.filter((row) => row.recordStatus === 'DRAFT').length;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-konjo-red" /></div>;
  return <div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-konjo-red/25 bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{([{ kind: 'CREDIT', label: 'Credit sales' }, { kind: 'ORDER', label: 'Orders' }, { kind: 'SAMPLE', label: 'Samples' }, { kind: 'INVENTORY', label: 'Inventory ledger' }] as const).map((item) => <button key={item.kind} onClick={() => setTab(item.kind)} className={`rounded-xl border p-3 text-left ${tab === item.kind ? 'border-konjo-red/40 bg-konjo-red/15' : 'border-white/10 bg-white/[0.035]'}`}><p className="text-xs font-semibold text-konjo-cream">{item.label}</p><p className="mt-1 text-[10px] text-konjo-cream/35">{rows.filter((row) => row.kind === item.kind).length} records</p></button>)}</div>
    <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="font-display text-2xl font-bold text-konjo-cream">{tabRows.length}</p><p className="text-[10px] uppercase tracking-wide text-konjo-cream/35">Total entries</p></div><div className="rounded-2xl border border-konjo-amber/20 bg-konjo-amber/[0.06] p-4"><p className="font-display text-2xl font-bold text-konjo-amber">{draftCount}</p><p className="text-[10px] uppercase tracking-wide text-konjo-cream/35">Need details</p></div></div>
    <label className="mt-4 flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3"><Search size={15} className="text-konjo-cream/30" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search outlet, address, reference or status" className="min-w-0 flex-1 bg-transparent text-xs text-konjo-cream placeholder:text-konjo-cream/25 focus:outline-none" /></label>
    <div className="mt-4 space-y-2">{filtered.map((row) => <button key={`${row.kind}-${row.id}`} onClick={() => openEditor(row)} className="w-full rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-white/20"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-sm font-semibold text-konjo-cream">{row.outlet.name}</h2>{row.recordStatus === 'DRAFT' ? <span className="rounded-full bg-konjo-amber/15 px-2 py-0.5 text-[8px] font-bold text-konjo-amber">DRAFT</span> : <CheckCircle2 size={13} className="text-konjo-green" />}</div><p className="truncate text-[10.5px] text-konjo-cream/40">{row.outlet.address || 'No address'} · Ref {row.legacyReference || '—'}</p></div><Pencil size={15} className="shrink-0 text-konjo-cream/30" /></div>{row.qualityNotes.length > 0 && <p className="mt-2 flex items-center gap-1 text-[9.5px] text-konjo-amber"><AlertTriangle size={11} />{row.qualityNotes.join(' · ')}</p>}<div className="mt-3 flex items-end justify-between"><div><p className="font-display text-base font-bold text-konjo-cream">{row.kind === 'INVENTORY' ? row.items.filter((item) => item.quantity !== 0).slice(0, 4).map((item) => `${item.sku} ${item.quantity > 0 ? '+' : ''}${item.quantity}`).join(' · ') || 'No movement quantities' : row.totalPrice === null ? row.items.map((item) => `${item.sku} ${item.quantity}`).join(' · ') || 'No product quantities' : formatEtb(row.totalPrice)}</p><p className="text-[9.5px] text-konjo-cream/30">{row.status}</p></div><p className="text-[10px] text-konjo-cream/35">{row.primaryDate || 'No date'}</p></div></button>)}{!filtered.length && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-konjo-cream/35">No matching records.</p>}</div>

    {editing && <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4" onClick={() => !saving && setEditing(null)}><div onClick={(event) => event.stopPropagation()} className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-white/10 bg-konjo-charcoal-2 p-5 shadow-2xl sm:rounded-3xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-konjo-amber">Edit {editing.kind.toLowerCase()} entry</p><h2 className="mt-1 font-display text-xl font-bold text-konjo-cream">Source ref {editing.legacyReference || '—'}</h2></div><button onClick={() => setEditing(null)} disabled={saving} className="text-konjo-cream/40"><X size={20} /></button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><TextField label="Outlet / supermarket" value={form.outlet} onChange={update('outlet')} placeholder="Add the missing outlet" /><TextField label="Address" value={form.address} onChange={update('address')} /><TextField label="Reference" value={form.reference} onChange={update('reference')} />{editing.kind === 'CREDIT' && <TextField label="Subcity" value={form.subcity} onChange={update('subcity')} />}
        {editing.kind === 'CREDIT' && <><SelectField label="Payment status" value={form.status} options={['PAID', 'UNPAID', 'UNKNOWN']} onChange={update('status')} /><TextField label="Total price (ETB)" type="number" value={form.total} onChange={update('total')} /><TextField label="Sale date (DD-MM-YYYY)" value={form.primaryDate} onChange={update('primaryDate')} /><TextField label="Due date" value={form.secondaryDate} onChange={update('secondaryDate')} /><TextField label="Payment date" value={form.thirdDate} onChange={update('thirdDate')} /><TextField label="Bottle price raw" value={form.bottlePrice} onChange={update('bottlePrice')} /><TextField label="Agreement period" value={form.agreement} onChange={update('agreement')} /><TextField label="Payment type" value={form.paymentType} onChange={update('paymentType')} /><TextField label="Sales representative" value={form.salesRepresentative} onChange={update('salesRepresentative')} /></>}
        {editing.kind === 'ORDER' && <><SelectField label="Order status" value={form.status} options={['ORDERED', 'DELIVERED', 'UNKNOWN']} onChange={update('status')} /><TextField label="Order date (DD-MM-YYYY)" value={form.primaryDate} onChange={update('primaryDate')} /><TextField label="Delivery date" value={form.secondaryDate} onChange={update('secondaryDate')} /></>}
        {editing.kind === 'SAMPLE' && <><SelectField label="Sample status" value={form.status} options={['ONGOING', 'COMPLETED', 'REJECTED', 'UNKNOWN']} onChange={update('status')} /><TextField label="Date given (DD-MM-YYYY)" value={form.primaryDate} onChange={update('primaryDate')} /><TextField label="Phone" value={form.phone} onChange={update('phone')} /><TextField label="Supermarket representative" value={form.supermarketRepresentative} onChange={update('supermarketRepresentative')} /><TextField label="Sales representative" value={form.salesRepresentative} onChange={update('salesRepresentative')} /><TextField label="Remark" value={form.remark} onChange={update('remark')} /><TextField label="Feedback" value={form.feedback} onChange={update('feedback')} /></>}
        {editing.kind === 'INVENTORY' && <><TextField label="Entry date (DD-MM-YYYY)" value={form.primaryDate} onChange={update('primaryDate')} /><TextField label="Reason" value={form.reason} onChange={update('reason')} /><TextField label="Sales representative" value={form.salesRepresentative} onChange={update('salesRepresentative')} /></>}
      </div>
      {editing.kind !== 'SAMPLE' && editing.kind !== 'INVENTORY' && <section className="mt-5"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-konjo-cream/40">Product quantities</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{products.map((product) => <TextField key={product.sku} label={product.sku} type="number" value={quantities[product.sku] ?? ''} onChange={(value) => setQuantities((current) => ({ ...current, [product.sku]: value }))} />)}</div></section>}
      {editing.kind === 'INVENTORY' && <section className="mt-5"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-konjo-cream/40">Historical quantities</p><div className="space-y-3">{products.map((product) => { const values = inventoryQuantities[product.sku] ?? { produced: '', sample: '', supermarket: '', ending: '' }; const setValue = (key: keyof typeof values) => (value: string) => setInventoryQuantities((current) => ({ ...current, [product.sku]: { ...(current[product.sku] ?? { produced: '', sample: '', supermarket: '', ending: '' }), [key]: value } })); return <div key={product.sku} className="rounded-xl border border-white/10 bg-black/15 p-3"><p className="mb-2 text-xs font-semibold text-konjo-cream">{product.sku}</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><TextField label="Produced" type="number" value={values.produced} onChange={setValue('produced')} /><TextField label="Sample / gift out" type="number" value={values.sample} onChange={setValue('sample')} /><TextField label="Supermarket out" type="number" value={values.supermarket} onChange={setValue('supermarket')} /><TextField label="Ending stock" type="number" value={values.ending} onChange={setValue('ending')} /></div></div>; })}</div></section>}
      {editing.kind !== 'SAMPLE' && <label className="mt-4 block"><span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-konjo-cream/35">Notes</span><textarea value={form.notes} onChange={(event) => update('notes')(event.target.value)} className="min-h-20 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-konjo-cream focus:border-konjo-red/50 focus:outline-none" /></label>}
      <button onClick={() => void save()} disabled={saving} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-konjo-green font-display text-sm font-semibold text-white disabled:opacity-50">{saving ? <><Loader2 size={16} className="animate-spin" />Saving…</> : 'Save entry'}</button>
    </div></div>}
  </div>;
}
