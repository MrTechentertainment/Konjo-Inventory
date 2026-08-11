'use client';

import { Loader2, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { errorMessage, withTimeout } from '@/lib/async';
import { supabase } from '@/lib/supabaseClient';

interface LedgerRow {
  id: string;
  legacy_reference: string | null;
  payment_status: 'PAID' | 'UNPAID' | 'UNKNOWN';
  total_price: number | null;
  refilled_date: string | null;
  refilled_date_raw: string | null;
  payment_type: string | null;
  sales_representative: string | null;
  source_name: string;
  outlets: { name: string; address: string | null; subcity: string | null } | { name: string; address: string | null; subcity: string | null }[] | null;
}

function formatEtb(value: number): string {
  const [whole, decimals] = value.toFixed(2).split('.');
  return `ETB ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimals}`;
}

export default function CreditSalesLedger() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await withTimeout(async (signal) => await supabase.from('credit_sales').select('id,legacy_reference,payment_status,total_price,refilled_date,refilled_date_raw,payment_type,sales_representative,source_name,outlets(name,address,subcity)').order('refilled_date', { ascending: false, nullsFirst: false }).limit(500).abortSignal(signal), 'Loading credit sales');
        if (result.error) throw result.error;
        if (active) setRows((result.data as unknown as LedgerRow[]) ?? []);
      } catch (caught) {
        if (active) setError(errorMessage(caught, 'Could not load credit sales.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => rows.filter((row) => { const outlet = Array.isArray(row.outlets) ? row.outlets[0] : row.outlets; const haystack = `${outlet?.name ?? ''} ${outlet?.address ?? ''} ${row.legacy_reference ?? ''} ${row.sales_representative ?? ''}`.toLowerCase(); return (status === 'ALL' || row.payment_status === status) && haystack.includes(query.trim().toLowerCase()); }), [query, rows, status]);
  const unpaidValue = rows.filter((row) => row.payment_status === 'UNPAID').reduce((sum, row) => sum + Number(row.total_price ?? 0), 0);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-konjo-red" /></div>;
  return <div>{error && <p className="mb-4 rounded-xl border border-konjo-red/25 bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}<div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="font-display text-2xl font-bold text-konjo-cream">{rows.length}</p><p className="text-[10px] uppercase tracking-wide text-konjo-cream/35">Imported sales</p></div><div className="rounded-2xl border border-konjo-amber/20 bg-konjo-amber/[0.06] p-4"><p className="truncate font-display text-xl font-bold text-konjo-amber">{formatEtb(unpaidValue)}</p><p className="text-[10px] uppercase tracking-wide text-konjo-cream/35">Unpaid value</p></div></div><div className="mt-4 flex gap-2"><label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3"><Search size={15} className="text-konjo-cream/30" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search supermarket, address or reference" className="min-w-0 flex-1 bg-transparent text-xs text-konjo-cream placeholder:text-konjo-cream/25 focus:outline-none" /></label><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="rounded-xl border border-white/10 bg-konjo-charcoal-2 px-3 text-xs text-konjo-cream"><option value="ALL">All</option><option value="UNPAID">Unpaid</option><option value="PAID">Paid</option></select></div><div className="mt-4 space-y-2">{filtered.map((row) => { const outlet = Array.isArray(row.outlets) ? row.outlets[0] : row.outlets; return <article key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-sm font-semibold text-konjo-cream">{outlet?.name ?? 'Unknown outlet'}</h2><p className="truncate text-[10.5px] text-konjo-cream/40">{[outlet?.address, outlet?.subcity].filter(Boolean).join(' · ') || 'No address'} · Ref {row.legacy_reference || '—'}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${row.payment_status === 'PAID' ? 'bg-konjo-green/15 text-konjo-green' : row.payment_status === 'UNPAID' ? 'bg-konjo-amber/15 text-konjo-amber' : 'bg-white/10 text-konjo-cream/45'}`}>{row.payment_status}</span></div><div className="mt-3 flex items-end justify-between"><div><p className="font-display text-lg font-bold tabular-nums text-konjo-cream">{row.total_price === null ? '—' : formatEtb(row.total_price)}</p><p className="text-[9.5px] text-konjo-cream/30">{row.payment_type || 'Payment type not supplied'}</p></div><p className="text-[10px] text-konjo-cream/35">{row.refilled_date ?? row.refilled_date_raw ?? 'No date'}</p></div></article>; })}{!filtered.length && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-konjo-cream/35">No matching sales records.</p>}</div></div>;
}
