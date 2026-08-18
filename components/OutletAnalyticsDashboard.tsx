'use client';

import { Activity, CalendarRange, CheckCircle2, CircleDollarSign, Clock3, PackageCheck, ReceiptText, Truck } from 'lucide-react';
import { sourceLocationLabel } from '@/lib/sourceProvenance';
import { productPackSize } from '@/lib/outlets';
import { formatEAT } from '@/lib/time';
import type { Outlet, Product } from '@/lib/types';
import { useOutletAnalytics } from '@/lib/useOutletAnalytics';

function formatEtb(value: number): string {
  return `ETB ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function recordDate(parsed: string | null, raw: string | null): string {
  return raw || parsed || 'Date missing';
}

function statusTone(status: string): string {
  if (status === 'DELIVERED' || status === 'PAID') return 'border-konjo-green/25 bg-konjo-green/10 text-konjo-green';
  if (status === 'ORDERED' || status === 'UNPAID') return 'border-konjo-amber/25 bg-konjo-amber/10 text-konjo-amber';
  return 'border-white/10 bg-white/5 text-konjo-cream/45';
}

function ItemSummary({ items }: { items: { sku: string; quantity: number }[] }) {
  if (!items.length) return <span className="text-konjo-cream/30">No product quantities</span>;
  return <span>{items.map((item) => `${item.sku} ${item.quantity}`).join(' · ')}</span>;
}

export default function OutletAnalyticsDashboard({ outlet, products, stockByProduct }: { outlet: Outlet; products: Product[]; stockByProduct: Record<string, number> }) {
  const analytics = useOutletAnalytics(outlet.id);
  const currentStock = products.reduce((sum, product) => sum + (stockByProduct[product.id] ?? 0), 0);
  const unpaidValue = analytics.pendingPayments.reduce((sum, sale) => sum + (sale.totalPrice ?? 0), 0);
  const stockValuation = products.map((product) => {
    const bottles = stockByProduct[product.id] ?? 0;
    const subtotal = bottles * Number(product.unit_price_etb ?? 0);
    const tax = subtotal * Number(product.tax_rate ?? 0);
    return { product, bottles, subtotal, tax, total: subtotal + tax };
  });
  const currentValue = stockValuation.reduce((totals, row) => ({ subtotal: totals.subtotal + row.subtotal, tax: totals.tax + row.tax, total: totals.total + row.total }), { subtotal: 0, tax: 0, total: 0 });

  return (
    <div className="space-y-6 px-4 pb-12 pt-2">
      <section>
        <div className="mb-3 flex items-center gap-2"><CalendarRange size={17} className="text-konjo-amber" /><div><h2 className="font-display text-base font-bold text-konjo-cream">Outlet analytics</h2><p className="text-[10.5px] text-konjo-cream/35">{analytics.canViewAdminAnalytics ? 'Historical Excel records and live outlet operations in one workspace.' : 'Live stock, pricing, tax, deliveries, and sales for this outlet.'}</p></div></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {analytics.canViewAdminAnalytics && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><ReceiptText size={15} className="text-konjo-amber" /><p className="mt-2 font-display text-2xl font-bold tabular-nums text-konjo-cream">{analytics.loading ? '…' : analytics.orders.length}</p><p className="text-[9.5px] uppercase tracking-wide text-konjo-cream/35">Previous orders</p></div>}
          {analytics.canViewAdminAnalytics && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><CircleDollarSign size={15} className="text-konjo-red" /><p className="mt-2 truncate font-display text-lg font-bold tabular-nums text-konjo-cream">{analytics.loading ? '…' : formatEtb(unpaidValue)}</p><p className="text-[9.5px] uppercase tracking-wide text-konjo-cream/35">Pending payment</p></div>}
          {analytics.canViewAdminAnalytics && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><Truck size={15} className="text-konjo-green" /><p className="mt-2 font-display text-2xl font-bold tabular-nums text-konjo-cream">{analytics.loading ? '…' : analytics.deliveryCounts.ordered}</p><p className="text-[9.5px] uppercase tracking-wide text-konjo-cream/35">Awaiting delivery</p></div>}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><PackageCheck size={15} className="text-konjo-green" /><p className="mt-2 font-display text-2xl font-bold tabular-nums text-konjo-cream">{currentStock.toLocaleString()}</p><p className="text-[9.5px] uppercase tracking-wide text-konjo-cream/35">Current bottles</p></div>
        </div>
        {analytics.error && <p role="alert" className="mt-3 rounded-xl border border-konjo-amber/25 bg-konjo-amber/10 p-3 text-[10.5px] text-konjo-amber">{analytics.error}</p>}
      </section>

      <section>
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-konjo-cream"><CircleDollarSign size={16} className="text-konjo-green" />Current stock valuation</h2>
        <p className="mt-1 text-[10px] text-konjo-cream/35">Live estimate using today&apos;s bottle price, tax rate, and product-specific pack size from Price &amp; Taxes.</p>
        <div className="mt-2 grid grid-cols-3 gap-2"><div className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><p className="truncate text-xs font-bold text-konjo-cream">{formatEtb(currentValue.subtotal)}</p><p className="text-[8.5px] uppercase text-konjo-cream/30">Before tax</p></div><div className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><p className="truncate text-xs font-bold text-konjo-amber">{formatEtb(currentValue.tax)}</p><p className="text-[8.5px] uppercase text-konjo-cream/30">Tax</p></div><div className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><p className="truncate text-xs font-bold text-konjo-green">{formatEtb(currentValue.total)}</p><p className="text-[8.5px] uppercase text-konjo-cream/30">Including tax</p></div></div>
        <div className="mt-2 space-y-2">{stockValuation.map(({ product, bottles, subtotal, tax, total }) => <article key={product.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-konjo-cream">{product.name}</p><p className="text-[9.5px] text-konjo-cream/35">{bottles} bottles · {productPackSize(product)} bottles/pack · {formatEtb(Number(product.unit_price_etb ?? 0))}/bottle</p></div><p className="shrink-0 text-xs font-bold text-konjo-green">{formatEtb(total)}</p></div><p className="mt-1 text-[9px] text-konjo-cream/30">{formatEtb(subtotal)} before tax + {formatEtb(tax)} tax ({(Number(product.tax_rate ?? 0) * 100).toFixed(2)}%)</p></article>)}</div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-konjo-cream"><PackageCheck size={16} className="text-konjo-amber" />Priced delivery history</h2>
        <p className="mt-1 text-[10px] text-konjo-cream/35">Each delivery keeps the price, tax, and pack size that applied when it was saved. Later price changes do not rewrite historical totals.</p>
        {analytics.deliveries.length > 0 && <div className="mt-2 grid grid-cols-3 gap-2"><div className="rounded-xl bg-black/15 p-2 text-center"><p className="text-[10.5px] font-bold text-konjo-cream">{formatEtb(analytics.deliveredFinancials.subtotal)}</p><p className="text-[8px] uppercase text-konjo-cream/30">Before tax</p></div><div className="rounded-xl bg-black/15 p-2 text-center"><p className="text-[10.5px] font-bold text-konjo-amber">{formatEtb(analytics.deliveredFinancials.tax)}</p><p className="text-[8px] uppercase text-konjo-cream/30">Tax</p></div><div className="rounded-xl bg-black/15 p-2 text-center"><p className="text-[10.5px] font-bold text-konjo-green">{formatEtb(analytics.deliveredFinancials.total)}</p><p className="text-[8px] uppercase text-konjo-cream/30">Total</p></div></div>}
        <div className="mt-2 space-y-2">{analytics.deliveries.map((delivery) => <article key={delivery.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-konjo-cream">{delivery.product_name}</p><p className="text-[9.5px] text-konjo-cream/35">{delivery.quantity_entered} {delivery.quantity_unit.toLowerCase()}{delivery.quantity_entered === 1 ? '' : 's'} × {delivery.bottles_per_pack} bottles/pack = {delivery.quantity_bottles} bottles</p></div><p className="shrink-0 text-xs font-bold text-konjo-green">{formatEtb(delivery.total_amount_etb)}</p></div><p className="mt-1 text-[9.5px] text-konjo-cream/40">{formatEtb(delivery.unit_price_etb)}/bottle · {formatEtb(delivery.subtotal_etb)} before tax + {formatEtb(delivery.tax_amount_etb)} tax ({(delivery.tax_rate * 100).toFixed(2)}%)</p><p className="mt-1 text-[9px] text-konjo-cream/25">Saved by {delivery.username} · {formatEAT(delivery.timestamp)}</p></article>)}{!analytics.loading && !analytics.deliveries.length && <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-konjo-cream/30">No priced deliveries have been recorded yet. Older unpriced stock logs remain visible in the operations tracker.</p>}</div>
      </section>

      {analytics.canViewAdminAnalytics && <>
      <section>
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-konjo-cream"><Truck size={16} className="text-konjo-green" />Delivery status</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[['Delivered', analytics.deliveryCounts.delivered, 'text-konjo-green'], ['Ordered', analytics.deliveryCounts.ordered, 'text-konjo-amber'], ['Unknown', analytics.deliveryCounts.unknown, 'text-konjo-cream/45']].map(([label, value, tone]) => <div key={String(label)} className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><p className={`font-display text-xl font-bold tabular-nums ${tone}`}>{analytics.loading ? '…' : String(value)}</p><p className="text-[9px] uppercase tracking-wide text-konjo-cream/30">{String(label)}</p></div>)}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-konjo-cream"><ReceiptText size={16} className="text-konjo-amber" />Previous orders</h2>
        <div className="mt-2 space-y-2">
          {analytics.orders.map((order) => <article key={order.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-konjo-cream">Order ref {order.legacyReference || '—'}</p><p className="mt-0.5 text-[10px] text-konjo-cream/35">Ordered {recordDate(order.orderDate, order.orderDateRaw)} · Delivered {recordDate(order.deliveryDate, order.deliveryDateRaw)}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[8.5px] font-bold ${statusTone(order.status)}`}>{order.status}</span></div><p className="mt-2 text-[10.5px] leading-relaxed text-konjo-cream/55"><ItemSummary items={order.items} /></p>{order.qualityNotes.length > 0 && <p className="mt-2 text-[9.5px] text-konjo-amber">Needs correction: {order.qualityNotes.join(' · ')}</p>}<p className="mt-2 break-words text-[9px] text-konjo-cream/25">Source: {sourceLocationLabel(order.source)}</p></article>)}
          {!analytics.loading && !analytics.orders.length && <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-konjo-cream/30">No previous orders are linked to this outlet.</p>}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-konjo-cream"><CircleDollarSign size={16} className="text-konjo-red" />Pending payments</h2>
        <div className="mt-2 space-y-2">
          {analytics.pendingPayments.map((sale) => <article key={sale.id} className="rounded-2xl border border-konjo-red/15 bg-konjo-red/[0.055] p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-konjo-cream">Credit ref {sale.legacyReference || '—'}</p><p className="mt-0.5 text-[10px] text-konjo-cream/35">Sale {recordDate(sale.saleDate, sale.saleDateRaw)} · Due {recordDate(sale.dueDate, sale.dueDateRaw)}</p></div><p className="shrink-0 font-display text-sm font-bold text-konjo-red">{sale.totalPrice === null ? 'Amount missing' : formatEtb(sale.totalPrice)}</p></div><p className="mt-2 text-[10.5px] text-konjo-cream/55"><ItemSummary items={sale.items} /></p><p className="mt-2 break-words text-[9px] text-konjo-cream/25">Source: {sourceLocationLabel(sale.source)}</p></article>)}
          {!analytics.loading && !analytics.pendingPayments.length && <p className="flex items-center gap-2 rounded-xl border border-konjo-green/20 bg-konjo-green/[0.06] p-3 text-xs text-konjo-green"><CheckCircle2 size={15} />No unpaid credit sale is linked to this outlet.</p>}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-konjo-cream"><CalendarRange size={16} className="text-konjo-amber" />Monthly product volume</h2>
        <p className="mt-1 text-[10px] text-konjo-cream/35">Volumes are summed from dated order product lines imported from the sales workbook.</p>
        <div className="mt-2 space-y-2">
          {analytics.monthlyVolume.map((month) => <article key={month.month} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-konjo-cream">{month.label}</p><p className="font-display text-lg font-bold tabular-nums text-konjo-cream">{month.total.toLocaleString()} <span className="font-body text-[9px] font-normal text-konjo-cream/30">bottles</span></p></div><div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">{month.products.map((product) => <div key={product.sku} className="flex items-center justify-between rounded-lg bg-black/15 px-2 py-1.5 text-[10px]"><span className="truncate text-konjo-cream/45">{product.sku}</span><span className="ml-2 font-semibold tabular-nums text-konjo-cream">{product.quantity}</span></div>)}</div></article>)}
          {!analytics.loading && !analytics.monthlyVolume.length && <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-konjo-cream/30">No dated order rows are available for a monthly summary.</p>}
          {analytics.undatedOrders > 0 && <p className="flex items-center gap-2 text-[9.5px] text-konjo-amber"><Clock3 size={12} />{analytics.undatedOrders} order{analytics.undatedOrders === 1 ? '' : 's'} cannot be assigned to a month until its raw date is corrected.</p>}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-konjo-cream"><Activity size={16} className="text-konjo-red" />Outlet operations tracker</h2>
        <p className="mt-1 text-[10px] text-konjo-cream/35">Recent stock movements for this outlet only.</p>
        <div className="mt-2 space-y-2">
          {analytics.activity.map((row) => <article key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-konjo-cream">{row.product_name}</p><p className="mt-0.5 truncate text-[10.5px] text-konjo-cream/40">{row.product_sku} · {row.username}</p></div><span className={`shrink-0 font-display text-sm font-bold tabular-nums ${row.change_bottles > 0 ? 'text-konjo-green' : 'text-konjo-red'}`}>{row.change_bottles > 0 ? '+' : ''}{row.change_bottles}</span></div><p className="mt-1 text-[9.5px] text-konjo-cream/25">{formatEAT(row.timestamp)}</p></article>)}
          {!analytics.loading && !analytics.activity.length && <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-konjo-cream/30">No live stock activity has been logged for this outlet yet.</p>}
        </div>
      </section>
      </>}
    </div>
  );
}
