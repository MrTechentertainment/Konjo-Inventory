'use client';

import { memo, useMemo, useState } from 'react';
import { CalendarClock, Minus, PackageCheck, Plus, X } from 'lucide-react';
import type { DeliveryLineInput, PipelineStatus, Product, QuantityUnit } from '@/lib/types';

interface Props { open:boolean; products:Product[]; onClose:()=>void; mode?:'DELIVERY'|'ORDER'; onSubmit:(entries:DeliveryLineInput[], occurredAt:string, status:PipelineStatus, notes:string)=>Promise<boolean>; }
const localNow=()=>{const d=new Date(Date.now()-new Date().getTimezoneOffset()*60000);return d.toISOString().slice(0,16)};

function SupermarketDeliveryModal({open,products,onClose,mode='DELIVERY',onSubmit}:Props){
  const [quantities,setQuantities]=useState<Record<string,number>>({});const [units,setUnits]=useState<Record<string,QuantityUnit>>({});const [occurredAt,setOccurredAt]=useState(localNow);const [notes,setNotes]=useState('');const [submitting,setSubmitting]=useState(false);
  const entries=useMemo(()=>products.map(p=>({product_id:p.id,quantity:quantities[p.id]??0,unit:units[p.id]??'PACK'})).filter(x=>x.quantity>0),[products,quantities,units]);
  const bottles=entries.reduce((s,e)=>s+e.quantity*(e.unit==='PACK'?15:1),0);
  const submit=async()=>{if(!entries.length)return;setSubmitting(true);const ok=await onSubmit(entries,new Date(occurredAt).toISOString(),mode==='ORDER'?'PENDING_ORDER':'DELIVERED',notes);setSubmitting(false);if(ok){setQuantities({});setNotes('');setOccurredAt(localNow());onClose()}};
  if(!open)return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={onClose}><section onClick={e=>e.stopPropagation()} className="max-h-[92dvh] w-full max-w-md overflow-hidden rounded-t-3xl border border-white/10 bg-konjo-charcoal-2 sm:rounded-3xl">
    <div className="flex items-start justify-between border-b border-white/10 p-4"><div><p className="flex items-center gap-2 font-display font-semibold text-konjo-cream"><PackageCheck size={17} className={mode==='ORDER'?'text-konjo-amber':'text-konjo-green'}/>{mode==='ORDER'?'Order bottles not delivered':'New delivery'}</p><p className="mt-1 text-[11px] text-konjo-cream/40">Select products, quantity and pack/bottle unit</p></div><button onClick={onClose} className="rounded-full bg-white/5 p-2 text-konjo-cream/60"><X size={16}/></button></div>
    <div className="max-h-[62dvh] space-y-2 overflow-y-auto p-4">{products.map(p=>{const q=quantities[p.id]??0;return <div key={p.id} className={`rounded-xl border p-3 ${q?'border-konjo-red/30 bg-konjo-red/5':'border-white/10 bg-white/[0.03]'}`}><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-xs font-medium text-konjo-cream">{p.name}</span><button onClick={()=>setQuantities(c=>({...c,[p.id]:Math.max(0,q-1)}))} className="rounded-lg bg-white/5 p-2 text-konjo-cream/60"><Minus size={14}/></button><span className="w-7 text-center font-display text-lg font-bold text-konjo-cream">{q}</span><button onClick={()=>setQuantities(c=>({...c,[p.id]:q+1}))} className="rounded-lg bg-konjo-red p-2 text-white"><Plus size={14}/></button></div>{q>0&&<div className="mt-2 grid grid-cols-2 gap-1">{(['PACK','BOTTLE'] as QuantityUnit[]).map(unit=><button key={unit} onClick={()=>setUnits(c=>({...c,[p.id]:unit}))} className={`rounded-lg py-1.5 text-[10px] font-bold ${(units[p.id]??'PACK')===unit?'bg-white/15 text-konjo-cream':'bg-black/15 text-konjo-cream/35'}`}>{unit==='PACK'?'PACK · 15':'BOTTLE · 1'}</button>)}</div>}</div>})}
      {mode==='DELIVERY'&&<label className="block rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-konjo-cream/45"><span className="flex items-center gap-1.5"><CalendarClock size={14}/>Delivery date & time (device time; editable)</span><input type="datetime-local" value={occurredAt} onChange={e=>setOccurredAt(e.target.value)} max={localNow()} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-konjo-cream"/></label>}
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Notes (optional)" className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-konjo-cream outline-none"/>
    </div>
    <div className="border-t border-white/10 p-4"><button onClick={()=>void submit()} disabled={submitting||!entries.length} className={`h-12 w-full rounded-xl font-display text-sm font-bold text-white disabled:opacity-40 ${mode==='ORDER'?'bg-konjo-amber':'bg-konjo-green'}`}>{submitting?'Saving…':mode==='ORDER'?`Request ${bottles} bottles`:`Deliver ${bottles} bottles`}</button></div>
  </section></div>;
}
export default memo(SupermarketDeliveryModal);
