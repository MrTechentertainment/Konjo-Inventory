import Papa, { type ParseResult } from 'papaparse';

export interface CsvImportItem {
  sku: string;
  quantity: number;
}

export interface CsvImportRow {
  legacy_reference: string | null;
  supermarket: string;
  address: string | null;
  subcity: string | null;
  payment_status: 'PAID' | 'UNPAID' | 'UNKNOWN';
  total_price: number | null;
  total_price_raw: string | null;
  refilled_date_raw: string | null;
  due_date_raw: string | null;
  payment_date_raw: string | null;
  bottle_price_raw: string | null;
  agreement_period: string | null;
  payment_type: string | null;
  notes: string | null;
  sales_representative: string | null;
  source_row: number;
  items: CsvImportItem[];
}

export interface CsvParseSummary {
  rows: CsvImportRow[];
  skippedBlankRows: number;
  warnings: string[];
}

const PRODUCT_COLUMNS = [
  { sku: 'KDR-380', aliases: ['KDR-380'] },
  { sku: 'KDG-380', aliases: ['KDG-380'] },
  { sku: 'KHSK-380', aliases: ['KHSK-380', 'KHS-380'] },
  { sku: 'KDR-160', aliases: ['KDR-160'] },
  { sku: 'KDG-160', aliases: ['KDG-160'] },
  { sku: 'KM-250', aliases: ['KM-250'] },
  { sku: 'KM-100', aliases: ['KM-100'] },
  { sku: 'KGP-400', aliases: ['Garlic paste (KGP-400)', 'KGP-400'] },
  { sku: 'KS-150', aliases: ['Senafich (KS-150)', 'KS-150'] },
] as const;

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findHeader(headers: string[], aliases: readonly string[]): number {
  const wanted = new Set(aliases.map(normalizeHeader));
  return headers.findIndex((header) => wanted.has(normalizeHeader(header)));
}

function cell(row: string[], index: number): string {
  return index < 0 ? '' : String(row[index] ?? '').trim();
}

function nullable(value: string): string | null {
  const clean = value.trim();
  return clean ? clean : null;
}

function parseDecimal(raw: string): number | null {
  const clean = raw.replace(/,/g, '').trim();
  if (!clean) return null;
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}

function paymentStatus(raw: string): CsvImportRow['payment_status'] {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'paid') return 'PAID';
  if (normalized === 'unpaid') return 'UNPAID';
  return 'UNKNOWN';
}

function paymentType(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'cash') return 'CASH';
  if (normalized === 'credit') return 'CREDIT';
  if (normalized === 'consinment' || normalized === 'consignment') return 'CONSIGNMENT';
  if (normalized === 'check' || normalized === 'cheque') return 'CHEQUE';
  return raw.trim().toUpperCase();
}

function parseRows(result: ParseResult<string[]>): CsvParseSummary {
  if (result.errors.some((error) => error.code === 'MissingQuotes' || error.code === 'UndetectableDelimiter')) {
    throw new Error(`CSV parsing failed: ${result.errors[0]?.message ?? 'invalid file format'}`);
  }
  const matrix = result.data;
  if (matrix.length < 2) throw new Error('The CSV has no data rows.');
  const headers = matrix[0].map((header) => String(header ?? ''));
  const columns = {
    reference: findHeader(headers, ['Column 1', 'Reference', 'ID']),
    supermarket: findHeader(headers, ['Supermarket', 'Outlet', 'Customer']),
    address: findHeader(headers, ['Adress', 'Address']),
    subcity: findHeader(headers, ['Subcity', 'Sub-city']),
    representativeFallback: findHeader(headers, ['Column 13']),
    status: findHeader(headers, ['Payment Status']),
    total: findHeader(headers, ['Total Price', 'Total']),
    refilledDate: findHeader(headers, ['Refilled Date', 'Sale Date', 'Delivery Date']),
    dueDate: findHeader(headers, ['When to be paid', 'Due Date']),
    paymentDate: findHeader(headers, ['Payment date', 'Paid Date']),
    bottlePrice: findHeader(headers, ['Bottle price', 'Unit Price']),
    agreement: findHeader(headers, ['Agreement Period']),
    paymentType: findHeader(headers, ['Payment Type']),
    extraNote: findHeader(headers, ['Column 21']),
    note: findHeader(headers, ['Note', 'Notes']),
    representative: findHeader(headers, ['Sales Representative', 'Representative']),
  };
  if (columns.supermarket < 0) throw new Error('Required “Supermarket” column was not found.');
  if (columns.status < 0 || columns.total < 0) throw new Error('Required payment status or total price column was not found.');

  const productColumns = PRODUCT_COLUMNS.map((product) => ({ ...product, index: findHeader(headers, product.aliases) })).filter((product) => product.index >= 0);
  if (!productColumns.length) throw new Error('No recognized KONJO product quantity columns were found.');

  const rows: CsvImportRow[] = [];
  const warnings: string[] = [];
  let skippedBlankRows = 0;

  matrix.slice(1).forEach((rawRow, index) => {
    const sourceRow = index + 2;
    const row = rawRow.map((value) => String(value ?? ''));
    const supermarket = cell(row, columns.supermarket);
    if (!supermarket) {
      skippedBlankRows += 1;
      return;
    }
    const rawTotal = cell(row, columns.total);
    const total = parseDecimal(rawTotal);
    if (rawTotal && total === null) warnings.push(`Row ${sourceRow}: total price “${rawTotal}” was kept as text because it is not a number.`);

    const items: CsvImportItem[] = [];
    productColumns.forEach((product) => {
      const rawQuantity = cell(row, product.index);
      if (!rawQuantity) return;
      const numeric = parseDecimal(rawQuantity);
      if (numeric === null || !Number.isInteger(numeric) || numeric < 0) {
        warnings.push(`Row ${sourceRow}: ${product.sku} quantity “${rawQuantity}” was not imported because it is not a whole non-negative number.`);
        return;
      }
      if (numeric > 0) items.push({ sku: product.sku, quantity: numeric });
    });

    const noteParts = [cell(row, columns.extraNote), cell(row, columns.note)].filter(Boolean);
    rows.push({
      legacy_reference: nullable(cell(row, columns.reference)),
      supermarket,
      address: nullable(cell(row, columns.address)),
      subcity: nullable(cell(row, columns.subcity)),
      payment_status: paymentStatus(cell(row, columns.status)),
      total_price: total,
      total_price_raw: nullable(rawTotal),
      refilled_date_raw: nullable(cell(row, columns.refilledDate)),
      due_date_raw: nullable(cell(row, columns.dueDate)),
      payment_date_raw: nullable(cell(row, columns.paymentDate)),
      bottle_price_raw: nullable(cell(row, columns.bottlePrice)),
      agreement_period: nullable(cell(row, columns.agreement)),
      payment_type: paymentType(cell(row, columns.paymentType)),
      notes: nullable(Array.from(new Set(noteParts)).join(' | ')),
      sales_representative: nullable(cell(row, columns.representative) || cell(row, columns.representativeFallback)),
      source_row: sourceRow,
      items,
    });
  });

  if (!rows.length) throw new Error('No rows with a supermarket name were found.');
  if (rows.length > 2500) throw new Error('This file has more than 2,500 usable rows. Split it into smaller CSV files.');
  return { rows, skippedBlankRows, warnings };
}

export function parseCsvFile(file: File): Promise<CsvParseSummary> {
  if (!file.name.toLowerCase().endsWith('.csv')) return Promise.reject(new Error('Choose a file ending in .csv.'));
  if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('The CSV is larger than 5 MB. Split it into smaller files.'));
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: false,
      complete: (result) => {
        try { resolve(parseRows(result)); } catch (error) { reject(error); }
      },
      error: (error) => reject(error),
    });
  });
}
