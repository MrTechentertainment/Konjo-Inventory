'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import OutletFormModal from '@/components/OutletFormModal';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { OUTLET_TYPE_LABEL } from '@/lib/outlets';
import type { Outlet, OutletType } from '@/lib/types';

const VALID:OutletType[]=['SUPERMARKET','BAZAAR','GIFT','SAMPLE'];
export default function OutletCategoryPage({params}:{params:{type:string}}){
  const router=useRouter();const {profile}=useAuth();const type=params.type.toUpperCase() as OutletType;const [items,setItems]=useState<Outlet[]>([]);const [loading,setLoading]=useState(true);const [editing,setEditing]=useState<Outlet|null|undefined>(undefined);const [openMenu,setOpenMenu]=useState<string|null>(null);const [error,setError]=useState<string|null>(null);
  const isAdmin=profile?.role==='ADMIN'||profile?.role==='SUPER_ADMIN';const canAdd=isAdmin||type==='SUPERMARKET'||type==='BAZAAR';
  const load=useCallback(async()=>{if(!VALID.includes(type)){router.replace('/outlets');return;}setLoading(true);const {data,error:e}=await supabase.rpc('list_outlets_for_type',{target_type:type});setLoading(false);if(e)setError(e.message);else setItems((data as Outlet[])??[]);},[router,type]);
  useEffect(()=>{void load()},[load]);
  const remove=async(outlet:Outlet)=>{const reason=window.prompt(`Reason for removing ${outlet.name}?`);if(!reason)return;const {error:e}=await supabase.rpc('remove_outlet',{target_outlet_id:outlet.id,reason});if(e)setError(e.message);else void load();};
  return <div className="min-h-dvh bg-konjo-charcoal pb-10"><Header title={OUTLET_TYPE_LABEL[type]??'Locations'} subtitle="location list"/><main className="mx-auto max-w-3xl px-4 pt-5">
    <div className="flex items-center justify-between"><div><Link href="/outlets" className="text-xs text-konjo-cream/40">← Dashboard</Link><h1 className="mt-2 font-display text-xl font-bold text-konjo-cream">{OUTLET_TYPE_LABEL[type]}</h1></div><button onClick={()=>canAdd&&setEditing(null)} disabled={!canAdd} title={!canAdd?'Only Admins can add this category':undefined} className="flex h-11 items-center gap-2 rounded-xl bg-konjo-red px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-35"><Plus size={16}/>Add New</button></div>
    {error&&<p className="mt-4 rounded-xl bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}{loading?<div className="mt-12 text-center text-sm text-konjo-cream/35">Loading…</div>:<div className="mt-5 grid gap-3 sm:grid-cols-2">{items.map(outlet=>{const canEdit=isAdmin||outlet.created_by===profile?.id;return <article key={outlet.id} className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-start gap-3"><Link href={`/outlets/${outlet.id}`} className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold text-konjo-cream">{outlet.name}</h2><p className="mt-1 text-[10px] text-konjo-cream/35">Created by {outlet.creator_name??'System'}</p>{outlet.exception_flag&&<p className="mt-2 flex items-center gap-1 text-[10px] text-konjo-amber"><AlertTriangle size={12}/>{outlet.exception_note}</p>}</Link>{canEdit&&<button onClick={()=>setOpenMenu(openMenu===outlet.id?null:outlet.id)} aria-label="Location options" className="rounded-full p-2 text-konjo-cream/50"><MoreVertical size={17}/></button>}</div>{openMenu===outlet.id&&<div className="absolute right-3 top-12 z-10 w-40 rounded-xl border border-white/10 bg-konjo-charcoal-2 p-1 shadow-2xl"><button onClick={()=>{setEditing(outlet);setOpenMenu(null)}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-konjo-cream/70"><Pencil size={14}/>Edit</button>{isAdmin&&<button onClick={()=>void remove(outlet)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-konjo-red"><Trash2 size={14}/>Delete</button>}</div>}</article>})}{!items.length&&<p className="col-span-full rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-konjo-cream/30">No locations yet.</p>}</div>}
  </main>{editing!==undefined&&<OutletFormModal type={type} outlet={editing} onClose={()=>setEditing(undefined)} onSaved={()=>{setEditing(undefined);void load()}}/>}</div>;
}
