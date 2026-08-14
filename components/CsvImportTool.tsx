'use client';

import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, PackageCheck, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { DragEvent, useRef, useState } from 'react';
import { errorMessage, withTimeout } from '@/lib/async';
import { isRootProfile } from '@/lib/authz';
import { useAuth } from '@/lib/AuthContext';
import { parseImportFile, type ImportKind, type ImportParseSummary } from '@/lib/importFile';
import { supabase } from '@/lib/supabaseClient';

interface CreditResult { import_id: string; received_rows: number; inserted_rows: number; updated_rows: number; item_rows: number }
interface InventoryResult { import_id: string; received_rows: number; applied_rows: number; unchanged_rows: number; staged_rows: number }

export default function CsvImportTool() {
  const { profile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<ImportKind>('INVENTORY');
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportParseSummary | null>(null);
  const [batchKey, setBatchKey] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'parsing' | 'ready' | 'importing' | 'done'>('idle');
  const [result, setResult] = useState<CreditResult | InventoryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isRootProfile(profile)) return <p className="rounded-xl border border-konjo-red/25 bg-konjo-red/10 p-4 text-sm text-konjo-red">Root Owner access is required.</p>;

  const downloadInventoryTemplate = () => {
    const rows = [
      ['product_sku', 'target_quantity', 'location_type', 'outlet_name', 'address', 'subcity'],
      ['KDR-380', '', 'FACTORY', '', '', ''], ['KDG-380', '', 'FACTORY', '', '', ''],
      ['KHSK-380', '', 'FACTORY', '', '', ''], ['KDR-160', '', 'FACTORY', '', '', ''],
      ['KDG-160', '', 'FACTORY', '', '', ''], ['KM-250', '', 'FACTORY', '', '', ''],
      ['KM-100', '', 'FACTORY', '', '', ''], ['KGP-400', '', 'FACTORY', '', '', ''],
      ['KS-150', '', 'FACTORY', '', '', ''], ['KDR-2000', '', 'FACTORY', '', '', ''],
      ['KDG-2000', '', 'FACTORY', '', '', ''], ['KHSK-2000', '', 'FACTORY', '', '', ''],
      ['AWAZE', '', 'FACTORY', '', '', ''],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'KONJO_inventory_import_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const clear = () => {
    setFile(null);
    setSummary(null);
    setResult(null);
    setBatchKey(null);
    setError(null);
    setPhase('idle');
    if (inputRef.current) inputRef.current.value = '';
  };

  const choose = async (selected: File) => {
    setFile(selected);
    setSummary(null);
    setResult(null);
    setBatchKey(crypto.randomUUID());
    setError(null);
    setPhase('parsing');
    try {
      const parsed = await parseImportFile(selected, kind);
      setSummary(parsed);
      setPhase('ready');
    } catch (caught) {
      setError(errorMessage(caught, 'Could not safely read this file. Nothing was saved.'));
      setPhase('idle');
    }
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const selected = event.dataTransfer.files[0];
    if (selected) void choose(selected);
  };

  const importRows = async () => {
    if (!file || !summary || !batchKey) return;
    setPhase('importing');
    setError(null);
    try {
      const response = await withTimeout(
        async (signal) => kind === 'INVENTORY'
          ? await supabase.rpc('import_inventory_snapshot_batch', { p_rows: summary.inventoryRows, p_source_name: file.name, p_batch_key: batchKey }).abortSignal(signal)
          : await supabase.rpc('import_credit_sales_batch', { p_rows: summary.creditRows, p_source_name: file.name }).abortSignal(signal),
        kind === 'INVENTORY' ? 'Importing inventory snapshot' : 'Importing credit sales',
        90_000
      );
      if (response.error) throw response.error;
      setResult(response.data as CreditResult | InventoryResult);
      setPhase('done');
    } catch (caught) {
      setError(errorMessage(caught, 'The import failed. The database transaction was rolled back.'));
      setPhase('ready');
    }
  };

  const inventoryRows = summary?.inventoryRows ?? [];
  const creditRows = summary?.creditRows ?? [];
  const recognizedCount = kind === 'INVENTORY' ? inventoryRows.length : creditRows.length;
  const itemCount = kind === 'CREDIT_SALES' ? creditRows.reduce((sum, row) => sum + row.items.length, 0) : 0;

  return <div className="space-y-4">
    <section className="rounded-2xl border border-konjo-amber/20 bg-konjo-amber/[0.06] p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-konjo-amber" size={19} /><div><h2 className="text-sm font-semibold text-konjo-cream">Protected Root Owner operation</h2><p className="mt-1 text-xs leading-relaxed text-konjo-cream/45">Every file is parsed and previewed before one secured database transaction runs. Invalid inventory lines are kept as staged drafts; an unexpected database error rolls back the batch.</p></div></div></section>

    <section className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-2">
      {([{ value: 'INVENTORY', label: 'Inventory snapshot', detail: 'Set factory or outlet stock' }, { value: 'CREDIT_SALES', label: 'Credit sales', detail: 'Upsert sales and invoices' }] as const).map((option) => <button key={option.value} onClick={() => { if (kind !== option.value) { setKind(option.value); clear(); } }} disabled={phase === 'importing'} className={`rounded-xl border p-3 text-left transition ${kind === option.value ? 'border-konjo-red/40 bg-konjo-red/15' : 'border-transparent bg-black/10'}`}><p className="text-xs font-semibold text-konjo-cream">{option.label}</p><p className="mt-0.5 text-[9.5px] text-konjo-cream/35">{option.detail}</p></button>)}
    </section>

    {kind === 'INVENTORY' && <button type="button" onClick={downloadInventoryTemplate} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] text-xs font-semibold text-konjo-cream/65"><FileSpreadsheet size={15} />Download the safe inventory CSV template</button>}

    <div onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={drop} className={`relative rounded-3xl border-2 border-dashed p-8 text-center transition ${dragging ? 'border-konjo-amber bg-konjo-amber/10' : 'border-white/15 bg-white/[0.035]'}`}>
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void choose(selected); }} className="hidden" />
      <UploadCloud size={34} className="mx-auto text-konjo-red" />
      <h2 className="mt-3 font-display text-lg font-bold text-konjo-cream">Drop CSV, XLSX, or PDF here</h2>
      <p className="mt-1 text-xs text-konjo-cream/40">maximum 15 MB and 5,000 expanded rows</p>
      <button onClick={() => inputRef.current?.click()} disabled={phase === 'parsing' || phase === 'importing'} className="mt-5 h-11 rounded-xl bg-konjo-red px-5 text-sm font-semibold text-white disabled:opacity-50">Choose file</button>
    </div>

    {file && <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-start gap-3"><FileSpreadsheet className="shrink-0 text-konjo-green" size={21} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-konjo-cream">{file.name}</p><p className="text-[10px] text-konjo-cream/35">{(file.size / 1024).toFixed(1)} KB</p></div><button onClick={clear} disabled={phase === 'importing'} aria-label="Remove file" className="text-konjo-cream/40"><X size={17} /></button></div>
      {phase === 'parsing' && <p className="mt-4 flex items-center gap-2 text-xs text-konjo-cream/55"><Loader2 size={15} className="animate-spin" />Reading sheets/pages and checking rows…</p>}
      {summary && <><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-black/15 p-3"><p className="font-display text-xl font-bold text-konjo-cream">{recognizedCount}</p><p className="text-[9px] uppercase tracking-wide text-konjo-cream/35">Recognized rows</p></div><div className="rounded-xl bg-black/15 p-3"><p className="font-display text-xl font-bold text-konjo-cream">{kind === 'INVENTORY' ? recognizedCount - summary.draftRows : itemCount}</p><p className="text-[9px] uppercase tracking-wide text-konjo-cream/35">{kind === 'INVENTORY' ? 'Ready changes' : 'Product lines'}</p></div><div className="rounded-xl bg-black/15 p-3"><p className="font-display text-xl font-bold text-konjo-amber">{summary.issues.length}</p><p className="text-[9px] uppercase tracking-wide text-konjo-cream/35">Flagged rows</p></div></div>
      <div className="mt-3 overflow-hidden rounded-xl border border-white/10"><div className="grid grid-cols-[1fr_1fr_auto] gap-2 bg-black/20 px-3 py-2 text-[9px] font-bold uppercase tracking-wide text-konjo-cream/35"><span>Product / outlet</span><span>Quantity / status</span><span>Sheet / row</span></div>{kind === 'INVENTORY' ? inventoryRows.slice(0, 5).map((row, index) => <div key={`${row.source_workbook}-${row.source_sheet}-${row.source_row}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-white/5 px-3 py-2 text-[10px] text-konjo-cream/55"><span className="truncate">{row.product_sku || row.product_name || 'Missing product'} · {row.outlet_name || 'Factory'}</span><span>{row.target_quantity ?? 'Draft'}</span><span title={`${row.source_workbook} › ${row.source_sheet} › row ${row.source_row}`}>{row.source_sheet} · {row.source_row}</span></div>) : creditRows.slice(0, 5).map((row, index) => <div key={`${row.source_workbook}-${row.source_sheet}-${row.source_row}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 border-t border-white/5 px-3 py-2 text-[10px] text-konjo-cream/55"><span className="truncate">{row.supermarket || 'Missing outlet'} · Ref {row.legacy_reference || '—'}</span><span>{row.record_status}</span><span title={`${row.source_workbook} › ${row.source_sheet} › row ${row.source_row}`}>{row.source_sheet} · {row.source_row}</span></div>)}</div></>}
      {summary && (summary.warnings.length > 0 || summary.issues.length > 0) && <div className="mt-3 rounded-xl border border-konjo-amber/20 bg-konjo-amber/[0.06] p-3"><p className="flex items-center gap-2 text-xs font-semibold text-konjo-amber"><AlertTriangle size={14} />Review exact source locations</p><ul className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1 text-[10.5px] text-konjo-cream/45">{summary.issues.map((issue, index) => <li key={`${issue.workbook}-${issue.sheet}-${issue.row}-${index}`}>• <strong className="text-konjo-cream/65">{issue.workbook} › {issue.sheet} › row {issue.row}</strong>: {issue.messages.join(' · ')}</li>)}{summary.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul></div>}
      {phase === 'ready' && <button onClick={() => void importRows()} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-konjo-green font-display text-sm font-semibold text-white"><PackageCheck size={17} />Import reviewed batch</button>}
      {phase === 'importing' && <div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-2/3 animate-pulse rounded-full bg-konjo-amber" /></div><p className="mt-2 flex items-center justify-center gap-2 text-xs text-konjo-cream/55"><Loader2 size={14} className="animate-spin" />Saving one idempotent transaction… do not close this page.</p></div>}
      {phase === 'done' && result && <div className="mt-4 rounded-xl border border-konjo-green/25 bg-konjo-green/10 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-konjo-green"><CheckCircle2 size={17} />Import completed</p>{'applied_rows' in result ? <p className="mt-2 text-xs text-konjo-cream/55">Received {result.received_rows}: {result.applied_rows} stock values changed, {result.unchanged_rows} already matched, and {result.staged_rows} incomplete lines were kept as drafts.</p> : <p className="mt-2 text-xs text-konjo-cream/55">Received {result.received_rows}: {result.inserted_rows} new, {result.updated_rows} updated, and {result.item_rows} product lines saved.</p>}</div>}
    </section>}
    {error && <p role="alert" className="rounded-xl border border-konjo-red/25 bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}
    <p className="text-[10.5px] leading-relaxed text-konjo-cream/35"><strong className="text-konjo-cream/55">PDF limitation:</strong> selectable table text is supported. A scanned photo-PDF is rejected before database access; convert it to XLSX/CSV or run OCR first.</p>
  </div>;
}
