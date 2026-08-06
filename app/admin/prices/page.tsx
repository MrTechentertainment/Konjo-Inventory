'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calculator, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import type { ProductPrice } from '@/lib/types';

type Draft={tax:number;bottleBefore:number;bottleAfter:number;packBefore:number;packAfter:number};
export default function PricesPage(){
  const {profile}=useAuth();const router=useRouter();const [rows,setRows]=useState<ProductPrice[]>([]);const [drafts,setDrafts]=useState<Record<string,Draft>>({});const [saving,setSaving]=useState<string|null>(null);const [message,setMessage]=useState<string|null>(null);
  const authorized=profile?.role==='ADMIN'||profile?.role==='SUPER_ADMIN';
  const load=useCallback(async()=>{const {data,error}=await supabase.rpc('get_current_prices');if(error)setMessage(error.message);else{const list=(data as ProductPrice[])??[];setRows(list);setDrafts(Object.fromEntries(list.map(r=>[r.product_id,{tax:Number(r.tax_rate??0.15)*100,bottleBefore:Number(r.bottle_price_before_tax??0),bottleAfter:Number(r.bottle_price_after_tax??0),packBefore:Number(r.pack_price_before_tax??0),packAfter:Number(r.pack_price_after_tax??0)}]))) }},[]);
  useEffect(()=>{if(!authorized)router.replace('/outlets');else void load()},[authorized,load,router]);
  const change=(id:string,key:keyof Draft,value:number)=>setDrafts(d=>({...d,[id]:{...d[id],[key]:value}}));
  const calculate=(id:string)=>{const d=drafts[id];const rate=d.tax/100;setDrafts(current=>({...current,[id]:{...d,bottleAfter:Number((d.bottleBefore*(1+rate)).toFixed(2)),packAfter:Number((d.packBefore*(1+rate)).toFixed(2))}}))};
  const save=async(row:ProductPrice)=>{const d=drafts[row.product_id];setSaving(row.product_id);setMessage(null);const {error}=await supabase.rpc('set_product_price',{target_product_id:row.product_id,new_tax_rate:d.tax/100,new_bottle_before:d.bottleBefore,new_bottle_after:d.bottleAfter,new_pack_before:d.packBefore,new_pack_after:d.packAfter,starts_at:new Date().toISOString()});setSaving(null);if(error)setMessage(error.message);else{setMessage(`${row.product_name} pricing version saved.`);void load()}};
  if(!authorized)return null;
  return <div className="min-h-dvh bg-konjo-charcoal pb-10"><Header title="Prices & Tax" subtitle="master financial configuration"/><main className="mx-auto max-w-5xl px-4 pt-5">
    <div className="rounded-2xl border border-konjo-amber/20 bg-konjo-amber/[0.07] p-4"><h1 className="flex items-center gap-2 font-display text-lg font-bold text-konjo-cream"><Calculator className="text-konjo-amber"/>Master price table</h1><p className="mt-1 text-xs leading-relaxed text-konjo-cream/45">Sales staff enter quantities only. Saving creates a new effective-dated version; completed transactions keep the older tax snapshot.</p></div>
    {message&&<p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-konjo-cream/65">{message}</p>}
    <div className="mt-4 space-y-3">{rows.map(row=>{const d=drafts[row.product_id];if(!d)return null;return <article key={row.product_id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-start justify-between"><div><h2 className="text-sm font-bold text-konjo-cream">{row.product_name}</h2><p className="font-mono text-[10px] text-konjo-cream/35">{row.product_sku} · version {row.version??0} · 15 bottles/pack</p></div><button onClick={()=>calculate(row.product_id)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] font-bold text-konjo-cream/60">Recalculate after-tax</button></div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{([['Tax %','tax'],['Bottle before tax','bottleBefore'],['Bottle after tax','bottleAfter'],['Pack before tax','packBefore'],['Pack after tax','packAfter']] as [string,keyof Draft][]).map(([label,key])=><label key={key} className="text-[10px] text-konjo-cream/45">{label}<input type="number" step="0.01" min="0" value={d[key]} onChange={e=>change(row.product_id,key,Number(e.target.value))} className="mt-1 w-full rounded-xl border border-white/10 bg-black/15 px-2 py-2.5 text-right text-xs tabular-nums text-konjo-cream outline-none focus:border-konjo-red/50"/></label>)}</div>
      <div className="mt-3 flex items-center justify-between"><p className={`text-[10px] ${Math.abs(d.bottleAfter-d.bottleBefore*(1+d.tax/100))<=0.02&&Math.abs(d.packAfter-d.packBefore*(1+d.tax/100))<=0.02?'text-konjo-green':'text-konjo-red'}`}>Tax reconciliation: {Math.abs(d.bottleAfter-d.bottleBefore*(1+d.tax/100))<=0.02&&Math.abs(d.packAfter-d.packBefore*(1+d.tax/100))<=0.02?'balanced':'values do not reconcile'}</p><button onClick={()=>void save(row)} disabled={saving===row.product_id} className="flex items-center gap-2 rounded-xl bg-konjo-red px-4 py-2 text-xs font-bold text-white disabled:opacity-40"><Save size={14}/>{saving===row.product_id?'Saving…':'Save version'}</button></div>
    </article>})}</div>
  </main></div>;
}
