'use client';

import { memo, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownToLine, ArrowUpFromLine, Download, Search, Wrench, X } from 'lucide-react';
import { useAuditLedger } from '@/lib/useAuditLedger';
import { formatEAT } from '@/lib/time';
import type { TransactionType } from '@/lib/types';

const RANGE_OPTIONS = [7, 30, 90] as const;

const TYPE_META: Record<TransactionType, { label: string; icon: typeof ArrowDownToLine; className: string }> = {
  STOCK_IN: { label: 'Stock in', icon: ArrowDownToLine, className: 'bg-konjo-green/15 text-konjo-green' },
  STOCK_OUT: { label: 'Stock out', icon: ArrowUpFromLine, className: 'bg-konjo-red/15 text-konjo-red' },
  AUDIT_ADJUSTMENT: { label: 'Correction', icon: Wrench, className: 'bg-konjo-amber/15 text-konjo-amber' },
};

function toCSV(rows: ReturnType<typeof useAuditLedger>['rows']): string {
  const header = ['Timestamp (EAT)', 'Product', 'SKU', 'Type', 'Change', 'Logged by', 'Notes'];
  const lines = rows.map((r) =>
    [
      formatEAT(r.timestamp),
      r.products?.name ?? 'Unknown product',
      r.products?.sku ?? '',
      TYPE_META[r.transaction_type].label,
      r.change_amount > 0 ? `+${r.change_amount}` : `${r.change_amount}`,
      r.logged_by,
      (r.notes ?? '').replace(/"/g, '""'),
    ]
      .map((field) => `"${field}"`)
      .join(',')
  );
  return [header.map((h) => `"${h}"`).join(','), ...lines].join('\n');
}

function downloadCSV(csv: string, days: number) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `konjo-inventory-audit-${days}d-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function AuditDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [days, setDays] = useState<(typeof RANGE_OPTIONS)[number]>(30);
  const [search, setSearch] = useState('');
  const { rows, loading, error } = useAuditLedger(isOpen, days);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.products?.name.toLowerCase().includes(q) ||
        r.products?.sku.toLowerCase().includes(q) ||
        r.logged_by.toLowerCase().includes(q) ||
        (r.notes ?? '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-konjo-charcoal-2"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
              <div>
                <p className="font-display text-[15px] font-semibold text-konjo-cream">Audit ledger</p>
                <p className="text-[11px] text-konjo-cream/45">Immutable · every entry ever logged</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close audit ledger"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-konjo-cream/60"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2.5 border-b border-white/10 px-4 py-3">
              <div className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3">
                <Search size={14} className="shrink-0 text-konjo-cream/40" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search product, SKU, staff, notes"
                  className="w-full bg-transparent text-[12.5px] text-konjo-cream placeholder:text-konjo-cream/35 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  {RANGE_OPTIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                        days === d
                          ? 'border-konjo-red/40 bg-konjo-red/20 text-konjo-cream'
                          : 'border-white/10 bg-white/[0.03] text-konjo-cream/55'
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => downloadCSV(toCSV(filtered), days)}
                  disabled={filtered.length === 0}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-konjo-cream/70 transition active:scale-95 disabled:opacity-40"
                >
                  <Download size={12} />
                  CSV
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {loading && <p className="py-8 text-center text-[12.5px] text-konjo-cream/40">Loading ledger…</p>}
              {error && <p className="py-8 text-center text-[12.5px] text-konjo-red">{error}</p>}
              {!loading && !error && filtered.length === 0 && (
                <p className="py-8 text-center text-[12.5px] text-konjo-cream/40">No transactions in this window.</p>
              )}

              <ul className="space-y-2">
                {filtered.map((r) => {
                  const meta = TYPE_META[r.transaction_type];
                  const Icon = meta.icon;
                  return (
                    <li
                      key={r.id}
                      className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
                    >
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.className}`}>
                        <Icon size={13} strokeWidth={2.3} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[12.5px] font-medium text-konjo-cream">
                            {r.products?.name ?? 'Unknown product'}
                          </p>
                          <span
                            className={`shrink-0 tabular-nums text-[12.5px] font-semibold ${
                              r.change_amount > 0 ? 'text-konjo-green' : 'text-konjo-red'
                            }`}
                          >
                            {r.change_amount > 0 ? `+${r.change_amount}` : r.change_amount}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10.5px] text-konjo-cream/45">
                          {formatEAT(r.timestamp)} · {r.logged_by}
                        </p>
                        {r.notes && <p className="mt-1 text-[11px] italic text-konjo-cream/55">&ldquo;{r.notes}&rdquo;</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(AuditDrawer);
