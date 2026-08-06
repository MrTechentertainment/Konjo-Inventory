'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { Outlet, OutletDuplicate, OutletType } from '@/lib/types';

export default function OutletFormModal({ type, outlet, onClose, onSaved }:{type:OutletType;outlet?:Outlet|null;onClose:()=>void;onSaved:()=>void}) {
  const router=useRouter(); const [name,setName]=useState(outlet?.name??''); const [note,setNote]=useState(outlet?.exception_note??'');
  const [duplicate,setDuplicate]=useState<OutletDuplicate|null>(null); const [exceptionMode,setExceptionMode]=useState(false); const [saving,setSaving]=useState(false); const [error,setError]=useState<string|null>(null);
  useEffect(()=>setName(outlet?.name??''),[outlet]);
  const save=async()=>{
    if(name.trim().length<2)return setError('Enter a location name.'); setSaving(true);setError(null);
    if(outlet){const {error:e}=await supabase.rpc('update_outlet',{target_outlet_id:outlet.id,new_name:name.trim(),new_type:type,edit_note:note||null});setSaving(false);if(e)return setError(e.message);onSaved();return;}
    if(!exceptionMode){const {data,error:e}=await supabase.rpc('check_outlet_duplicate',{candidate_name:name.trim()});if(e){setSaving(false);return setError(e.message);}const row=(data as OutletDuplicate[]|null)?.[0];if(row){setDuplicate(row);setSaving(false);return;}}
    if(exceptionMode&&note.trim().length<3){setSaving(false);return setError('Explain why this is a separate location, for example “Piazza Branch”.');}
    const {error:e}=await supabase.rpc('create_outlet',{candidate_name:name.trim(),candidate_type:type,exception_note:exceptionMode?note.trim():null});setSaving(false);if(e)return setError(e.message);onSaved();
  };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onClose}><div onClick={e=>e.stopPropagation()} className="w-full max-w-md rounded-t-3xl border border-white/10 bg-konjo-charcoal-2 p-5 sm:rounded-3xl">
    <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold text-konjo-cream">{outlet?'Edit location':'Add new location'}</h2><button onClick={onClose} className="rounded-full bg-white/5 p-2 text-konjo-cream/60"><X size={16}/></button></div>
    {duplicate?<div className="mt-5"><div className="rounded-2xl border border-konjo-amber/30 bg-konjo-amber/10 p-4"><AlertTriangle className="text-konjo-amber"/><p className="mt-2 text-sm font-semibold text-konjo-cream">{duplicate.name} already exists, created by {duplicate.created_by_name}.</p></div><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={()=>router.push(`/outlets/${duplicate.id}`)} className="rounded-xl bg-konjo-green px-3 py-3 text-xs font-bold text-white">Log into Existing</button><button onClick={()=>{setDuplicate(null);setExceptionMode(true)}} className="rounded-xl border border-konjo-amber/30 bg-konjo-amber/10 px-3 py-3 text-xs font-bold text-konjo-amber">Create Exception</button></div></div>:<>
      <label className="mt-5 block text-xs text-konjo-cream/50">Location name<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="ABC Supermarket" className="mt-1 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-konjo-cream outline-none focus:border-konjo-red/50"/></label>
      {(exceptionMode||outlet?.exception_flag)&&<label className="mt-3 block text-xs text-konjo-cream/50">Exception justification<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Piazza Branch" rows={3} className="mt-1 w-full resize-none rounded-xl border border-konjo-amber/25 bg-konjo-amber/5 px-3 py-3 text-sm text-konjo-cream outline-none"/></label>}
      {error&&<p role="alert" className="mt-3 text-xs text-konjo-red">{error}</p>}
      <button onClick={()=>void save()} disabled={saving} className="mt-5 h-12 w-full rounded-xl bg-konjo-red font-bold text-white disabled:opacity-50">{saving?'Saving…':outlet?'Save changes':exceptionMode?'Create flagged exception':'Check & create'}</button>
    </>}
  </div></div>;
}
