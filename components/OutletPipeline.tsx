import type { DeliveryLogRow, PipelineStatus, PipelineSummary } from '@/lib/types';
import { formatEAT } from '@/lib/time';

const STATUSES:PipelineStatus[]=['DELIVERED','PENDING_ORDER','WAITING_CONFIRMATION','PAID','CONSIGNMENT'];
const LABEL:Record<PipelineStatus,string>={DELIVERED:'Delivered',PENDING_ORDER:'Pending Orders',WAITING_CONFIRMATION:'Waiting Confirmation',PAID:'Paid',CONSIGNMENT:'Consignment'};
export default function OutletPipeline({pipeline,logs}:{pipeline:PipelineSummary[];logs:DeliveryLogRow[]}){
  return <div className="space-y-5">
    <div className="flex gap-2 overflow-x-auto pb-1">{STATUSES.map(status=>{const row=pipeline.find(x=>x.status===status);return <div key={status} className="min-w-32 rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-konjo-cream/40">{LABEL[status]}</p><p className="mt-2 font-display text-2xl font-bold text-konjo-cream">{row?.item_count??0}</p><p className="text-[10px] text-konjo-cream/30">{row?.bottle_count??0} bottles</p></div>})}</div>
    <section><h2 className="font-display text-sm font-semibold text-konjo-cream">Chronological delivery log</h2><div className="mt-2 space-y-2">{logs.map(log=><article key={log.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-konjo-cream">{log.product_name}</p><p className="mt-1 text-[10px] text-konjo-cream/35">{formatEAT(log.occurred_at)} · {log.recorded_by_name}</p></div><div className="text-right"><p className="font-display text-base font-bold text-konjo-green">+{log.quantity_bottles}</p><p className="text-[9px] text-konjo-cream/30">{log.quantity} {log.unit.toLowerCase()}{Number(log.quantity)===1?'':'s'}</p></div></article>)}{!logs.length&&<p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-konjo-cream/30">No deliveries yet.</p>}</div></section>
  </div>;
}
