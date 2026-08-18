'use client';

import { Archive, Check, Edit3, Loader2, MapPin, Plus, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage, withTimeout } from '@/lib/async';
import { LOCAL_OUTLET_TYPES, OUTLET_TYPE_LABEL } from '@/lib/outlets';
import { searchOutlets } from '@/lib/outletSearch';
import { supabase } from '@/lib/supabaseClient';
import type { Outlet, OutletType } from '@/lib/types';
import OutletDirectoryControls from './OutletDirectoryControls';

type LocalOutletType = Exclude<OutletType, 'EVENT'>;
interface FormState { id: string | null; name: string; type: LocalOutletType; address: string; subcity: string; active: boolean }
const blankForm: FormState = { id: null, name: '', type: 'SUPERMARKET', address: '', subcity: '', active: true };

export default function OutletManagement() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [form, setForm] = useState<FormState>(blankForm);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<LocalOutletType | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await withTimeout(async (signal) => await supabase.from('outlets').select('*').order('is_active', { ascending: false }).order('type').order('name').abortSignal(signal), 'Loading outlets');
      if (result.error) throw result.error;
      setOutlets((result.data as Outlet[]) ?? []);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not load outlets.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const search = useMemo(() => searchOutlets(outlets, query), [outlets, query]);
  const visibleOutlets = useMemo(() => {
    if (query.trim()) return search.matches;
    if (!selectedType) return [];
    return outlets.filter((outlet) => outlet.type === selectedType);
  }, [outlets, query, search.matches, selectedType]);

  const edit = (outlet: Outlet) => {
    if (outlet.type === 'EVENT') return;
    setForm({ id: outlet.id, name: outlet.name, type: outlet.type, address: outlet.address ?? '', subcity: outlet.subcity ?? '', active: outlet.is_active });
    setFormOpen(true);
    setError(null);
  };

  const close = () => { setForm(blankForm); setFormOpen(false); };

  const save = async () => {
    if (!form.name.trim()) { setError('Outlet name is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const result = await withTimeout(
        async (signal) => await supabase.rpc('admin_save_outlet', { target_outlet_id: form.id, outlet_name: form.name.trim(), outlet_type_value: form.type, outlet_address: form.address.trim() || null, outlet_subcity: form.subcity.trim() || null, outlet_active: form.active }).abortSignal(signal),
        'Saving outlet'
      );
      if (result.error) throw result.error;
      await load();
      close();
    } catch (caught) {
      setError(errorMessage(caught, 'The outlet did not save.'));
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (outlet: Outlet, active: boolean) => {
    setError(null);
    try {
      const result = await withTimeout(async (signal) => await supabase.rpc('admin_save_outlet', { target_outlet_id: outlet.id, outlet_name: outlet.name, outlet_type_value: outlet.type, outlet_address: outlet.address, outlet_subcity: outlet.subcity, outlet_active: active }).abortSignal(signal), 'Updating outlet');
      if (result.error) throw result.error;
      await load();
    } catch (caught) {
      setError(errorMessage(caught, 'The outlet status did not save.'));
    }
  };

  return (
    <div>
      {error && <p role="alert" className="mb-4 rounded-xl border border-konjo-red/25 bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><h1 className="font-display text-xl font-bold text-konjo-cream">Outlets Management</h1><p className="mt-1 text-xs text-konjo-cream/45">Search first or open a section. Activation events are managed in KTally.</p></div>
        <button onClick={() => { setForm(blankForm); setFormOpen(true); }} className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-konjo-red px-3 text-xs font-semibold text-white"><Plus size={15} />Add outlet</button>
      </div>

      <OutletDirectoryControls outlets={outlets} query={query} onQueryChange={setQuery} selectedType={selectedType} onSelectType={setSelectedType} />
      {query.trim() && !search.hasDirectMatch && search.suggestion && <p className="mt-3 rounded-xl border border-konjo-amber/20 bg-konjo-amber/10 px-3 py-2 text-xs text-konjo-amber">Did you mean <button onClick={() => setQuery(search.suggestion?.name ?? '')} className="font-bold underline underline-offset-2">{search.suggestion.name}</button>?</p>}

      {formOpen && <section className="mt-5 rounded-2xl border border-konjo-amber/25 bg-konjo-amber/[0.06] p-4"><div className="flex items-center justify-between"><h2 className="font-display text-sm font-semibold text-konjo-cream">{form.id ? 'Edit outlet' : 'New outlet'}</h2><button onClick={close} aria-label="Close form" className="text-konjo-cream/45"><X size={17} /></button></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label><span className="text-[10px] uppercase tracking-wide text-konjo-cream/40">Name</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-konjo-cream focus:outline-none" /></label><label><span className="text-[10px] uppercase tracking-wide text-konjo-cream/40">Type</span><select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as LocalOutletType }))} className="mt-1 w-full rounded-xl border border-white/10 bg-konjo-charcoal px-3 py-3 text-sm text-konjo-cream focus:outline-none">{LOCAL_OUTLET_TYPES.map((type) => <option key={type} value={type}>{OUTLET_TYPE_LABEL[type]}</option>)}</select></label><label><span className="text-[10px] uppercase tracking-wide text-konjo-cream/40">Address</span><input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-konjo-cream focus:outline-none" /></label><label><span className="text-[10px] uppercase tracking-wide text-konjo-cream/40">Subcity</span><input value={form.subcity} onChange={(event) => setForm((current) => ({ ...current, subcity: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-konjo-cream focus:outline-none" /></label></div><label className="mt-3 flex items-center gap-2 text-xs text-konjo-cream/60"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />Active location</label><button disabled={saving} onClick={() => void save()} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-konjo-green text-sm font-semibold text-white disabled:opacity-50">{saving ? <><Loader2 size={15} className="animate-spin" />Saving…</> : <><Check size={15} />Save outlet</>}</button></section>}

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-konjo-red" /></div> : (query.trim() || selectedType) && <section className="mt-5"><div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-konjo-amber">{query.trim() ? 'Search results' : OUTLET_TYPE_LABEL[selectedType!]}</p><p className="mt-1 text-xs text-konjo-cream/40">{visibleOutlets.length} {visibleOutlets.length === 1 ? 'location' : 'locations'}</p></div><div className="grid gap-3 sm:grid-cols-2">{visibleOutlets.map((outlet) => <article key={outlet.id} className={`rounded-2xl border p-4 ${outlet.is_active ? 'border-white/10 bg-white/[0.04]' : 'border-white/5 bg-white/[0.02] opacity-60'}`}><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-konjo-red/10 text-konjo-red"><MapPin size={18} /></span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold text-konjo-cream">{outlet.name}</h2><p className="text-[10px] uppercase tracking-wide text-konjo-cream/35">{OUTLET_TYPE_LABEL[outlet.type]}</p><p className="mt-1 text-[11px] text-konjo-cream/45">{[outlet.address, outlet.subcity].filter(Boolean).join(' · ') || 'No address supplied'}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => edit(outlet)} className="flex h-9 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-xs text-konjo-cream/65"><Edit3 size={13} />Edit</button><button onClick={() => void setActive(outlet, !outlet.is_active)} className="flex h-9 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-xs text-konjo-cream/65">{outlet.is_active ? <><Archive size={13} />Archive</> : <><RotateCcw size={13} />Restore</>}</button></div></article>)}{!visibleOutlets.length && <p className="col-span-full rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-konjo-cream/35">No matching outlet was found.</p>}</div></section>}
    </div>
  );
}
