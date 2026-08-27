'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Archive, Check, Edit3, Loader2, MapPin, Plus, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage, withTimeout } from '@/lib/async';
import { OUTLET_TYPE_DESCRIPTION, OUTLET_TYPE_LABEL } from '@/lib/outlets';
import type { LocalOutletType } from '@/lib/outletRoutes';
import { searchOutlets } from '@/lib/outletSearch';
import { supabase } from '@/lib/supabaseClient';
import type { Outlet } from '@/lib/types';
import OutletSearchInput from './OutletSearchInput';

interface FormState { id: string | null; name: string; address: string; subcity: string; active: boolean }
const blankForm: FormState = { id: null, name: '', address: '', subcity: '', active: true };

export default function OutletManagement({ type }: { type: LocalOutletType }) {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [form, setForm] = useState<FormState>(blankForm);
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await withTimeout(async (signal) => await supabase.from('outlets').select('*').eq('type', type).order('is_active', { ascending: false }).order('name').abortSignal(signal), `Loading ${OUTLET_TYPE_LABEL[type]}`);
      if (result.error) throw result.error;
      setOutlets((result.data as Outlet[]) ?? []);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught, `Could not load ${OUTLET_TYPE_LABEL[type].toLowerCase()}.`));
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => { void load(); }, [load]);

  const search = useMemo(() => searchOutlets(outlets, query), [outlets, query]);
  const visibleOutlets = query.trim() ? search.matches : outlets;

  const openAdd = () => { setForm(blankForm); setError(null); setFormOpen(true); };
  const edit = (outlet: Outlet) => {
    setForm({ id: outlet.id, name: outlet.name, address: outlet.address ?? '', subcity: outlet.subcity ?? '', active: outlet.is_active });
    setError(null);
    setFormOpen(true);
  };
  const close = () => { if (!saving) { setForm(blankForm); setFormOpen(false); } };

  const save = async () => {
    if (!form.name.trim()) { setError('Outlet name is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const result = await withTimeout(async (signal) => await supabase.rpc('admin_save_outlet', { target_outlet_id: form.id, outlet_name: form.name.trim(), outlet_type_value: type, outlet_address: form.address.trim() || null, outlet_subcity: form.subcity.trim() || null, outlet_active: form.active }).abortSignal(signal), 'Saving outlet');
      if (result.error) throw result.error;
      await load();
      setFormOpen(false);
      setForm(blankForm);
    } catch (caught) {
      setError(errorMessage(caught, 'The outlet did not save.'));
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (outlet: Outlet, active: boolean) => {
    setWorkingId(outlet.id);
    setError(null);
    try {
      const result = await withTimeout(async (signal) => await supabase.rpc('admin_save_outlet', { target_outlet_id: outlet.id, outlet_name: outlet.name, outlet_type_value: outlet.type, outlet_address: outlet.address, outlet_subcity: outlet.subcity, outlet_active: active }).abortSignal(signal), 'Updating outlet');
      if (result.error) throw result.error;
      await load();
    } catch (caught) {
      setError(errorMessage(caught, 'The outlet status did not save.'));
    } finally {
      setWorkingId(null);
    }
  };

  return <div><div className="flex items-start justify-between gap-3"><div><h1 className="font-display text-xl font-bold text-konjo-cream">Manage {OUTLET_TYPE_LABEL[type]}</h1><p className="mt-1 text-xs leading-relaxed text-konjo-cream/45">{OUTLET_TYPE_DESCRIPTION[type]}</p></div><button onClick={openAdd} className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-konjo-red px-3 py-2 text-xs font-semibold text-white"><Plus size={15} />Add</button></div><div className="mt-5"><OutletSearchInput value={query} onChange={setQuery} outletLabel={OUTLET_TYPE_LABEL[type]} /></div>{query.trim() && !search.hasDirectMatch && search.suggestion && <p className="mt-3 rounded-xl border border-konjo-amber/20 bg-konjo-amber/10 px-3 py-2 text-xs text-konjo-amber">Did you mean <button onClick={() => setQuery(search.suggestion?.name ?? '')} className="font-bold underline underline-offset-2">{search.suggestion.name}</button>?</p>}{error && !formOpen && <p role="alert" className="mt-4 rounded-xl border border-konjo-red/25 bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}{loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-konjo-red" /></div> : <section className="mt-5"><p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-konjo-amber">{visibleOutlets.length} {visibleOutlets.length === 1 ? 'location' : 'locations'}</p><div className="grid gap-3 sm:grid-cols-2">{visibleOutlets.map((outlet) => <article key={outlet.id} className={`rounded-2xl border p-4 ${outlet.is_active ? 'border-white/10 bg-white/[0.04]' : 'border-white/5 bg-white/[0.02] opacity-65'}`}><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-konjo-red/10 text-konjo-red"><MapPin size={18} /></span><div className="min-w-0 flex-1"><h2 className="break-words text-sm font-semibold leading-snug text-konjo-cream">{outlet.name}</h2><p className="mt-1 break-words text-[11px] leading-relaxed text-konjo-cream/45">{[outlet.address, outlet.subcity].filter(Boolean).join(' · ') || 'No address supplied'}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => edit(outlet)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 text-xs text-konjo-cream/70"><Edit3 size={14} />Edit here</button><button disabled={workingId === outlet.id} onClick={() => void setActive(outlet, !outlet.is_active)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 text-xs text-konjo-cream/70 disabled:opacity-40">{workingId === outlet.id ? <Loader2 size={14} className="animate-spin" /> : outlet.is_active ? <><Archive size={14} />Archive</> : <><RotateCcw size={14} />Restore</>}</button></div></article>)}{!visibleOutlets.length && <p className="col-span-full rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-konjo-cream/35">No matching {OUTLET_TYPE_LABEL[type].toLowerCase()} found.</p>}</div></section>}

    <AnimatePresence>{formOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"><motion.section initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }} onClick={(event) => event.stopPropagation()} className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-konjo-charcoal-2 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:rounded-3xl"><div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden" /><div className="flex items-start justify-between"><div><h2 className="font-display text-base font-bold text-konjo-cream">{form.id ? 'Edit this outlet' : `Add ${OUTLET_TYPE_LABEL[type].slice(0, -1)}`}</h2><p className="mt-1 text-[11px] text-konjo-cream/40">Changes save here without losing your place in the list.</p></div><button onClick={close} aria-label="Close outlet editor" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-konjo-cream/50"><X size={16} /></button></div><div className="mt-5 space-y-3"><label className="block"><span className="text-[10px] font-bold uppercase tracking-wide text-konjo-cream/40">Name</span><input autoFocus value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1.5 min-h-12 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-base text-konjo-cream focus:outline-none focus:ring-2 focus:ring-konjo-red/35" /></label><label className="block"><span className="text-[10px] font-bold uppercase tracking-wide text-konjo-cream/40">Address</span><input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} className="mt-1.5 min-h-12 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-base text-konjo-cream focus:outline-none focus:ring-2 focus:ring-konjo-red/35" /></label><label className="block"><span className="text-[10px] font-bold uppercase tracking-wide text-konjo-cream/40">Subcity</span><input value={form.subcity} onChange={(event) => setForm((current) => ({ ...current, subcity: event.target.value }))} className="mt-1.5 min-h-12 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-base text-konjo-cream focus:outline-none focus:ring-2 focus:ring-konjo-red/35" /></label><label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-konjo-cream/65"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} className="h-5 w-5" />Active location</label></div>{error && <p role="alert" className="mt-3 rounded-xl border border-konjo-red/25 bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}<button disabled={saving} onClick={() => void save()} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-konjo-green px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? <><Loader2 size={16} className="animate-spin" />Saving…</> : <><Check size={16} />Save changes</>}</button></motion.section></motion.div>}</AnimatePresence>
  </div>;
}
