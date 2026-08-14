import Papa, { type ParseResult } from 'papaparse';
import readXlsxFile, { type CellValue } from 'read-excel-file/browser';

export type ImportKind = 'INVENTORY' | 'CREDIT_SALES';

export interface CreditImportItem {
  sku: string;
  quantity: number;
}

export interface CreditImportRow {
  source_workbook: string;
  external_key: string;
  legacy_reference: string | null;
  supermarket: string | null;
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
  source_sheet: string;
  source_row: number;
  record_status: 'DRAFT' | 'COMPLETE';
  quality_notes: string[];
  items: CreditImportItem[];
  raw_row: Record<string, string>;
}

export interface InventoryImportRow {
  source_workbook: string;
  product_sku: string | null;
  product_name: string | null;
  target_quantity: number | null;
  location_type: 'FACTORY' | 'OUTLET';
  outlet_name: string | null;
  address: string | null;
  subcity: string | null;
  source_sheet: string;
  source_row: number;
  raw_row: Record<string, string>;
}

export interface ImportParseSummary {
  kind: ImportKind;
  inventoryRows: InventoryImportRow[];
  creditRows: CreditImportRow[];
  sheetNames: string[];
  warnings: string[];
  draftRows: number;
  issues: ImportParseIssue[];
}

export interface ImportParseIssue {
  workbook: string;
  sheet: string;
  row: number;
  messages: string[];
}

interface SourceMatrix {
  workbookName: string;
  sheetName: string;
  rows: unknown[][];
}

const PRODUCT_COLUMNS = [
  { sku: 'KDR-380', aliases: ['KDR-380', 'Konjo Datta Red 380'] },
  { sku: 'KDG-380', aliases: ['KDG-380', 'Konjo Datta Green 380'] },
  { sku: 'KHSK-380', aliases: ['KHSK-380', 'KHS-380', 'Konjo Hot & Sweet Ketchup 380'] },
  { sku: 'KDR-160', aliases: ['KDR-160', 'Konjo Datta Red 160'] },
  { sku: 'KDG-160', aliases: ['KDG-160', 'Konjo Datta Green 160'] },
  { sku: 'KM-250', aliases: ['KM-250', 'Konjo Mayonnaise 250'] },
  { sku: 'KM-100', aliases: ['KM-100', 'Konjo Mayonnaise 100'] },
  { sku: 'KGP-400', aliases: ['Garlic paste (KGP-400)', '(Garlic Paste KGP-400)', 'KGP-400', 'Konjo Garlic Paste 400'] },
  { sku: 'KS-150', aliases: ['Senafich (KS-150)', 'KS-150', 'Konjo Senafich 150'] },
  { sku: 'KDR-2000', aliases: ['KDR-2000', 'Konjo Datta Red 2000'] },
  { sku: 'KDG-2000', aliases: ['KDG-2000', 'Konjo Datta Green 2000'] },
  { sku: 'KHSK-2000', aliases: ['KHSK-2000', 'Konjo Hot & Sweet Ketchup 2000'] },
  { sku: 'AWAZE', aliases: ['AWAZE', 'Awaze', 'አዋዜ', 'Konjo Awaze'] },
] as const;

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_ROWS = 5000;

function normalizeHeader(value: unknown): string {
  return text(value).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${value.getFullYear()}`;
  }
  return String(value).replace(/\s+/g, ' ').trim();
}

function nullable(value: unknown): string | null {
  const clean = text(value);
  return clean && !['-', '?', '–', '—'].includes(clean) ? clean : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const clean = text(value).replace(/,/g, '');
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const parsed = numberValue(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = nonNegativeInteger(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function findHeader(headers: unknown[], aliases: readonly string[]): number {
  const wanted = new Set(aliases.map(normalizeHeader).filter(Boolean));
  return headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return Boolean(normalized) && wanted.has(normalized);
  });
}

function rawRow(headers: unknown[], row: unknown[]): Record<string, string> {
  const result: Record<string, string> = {};
  row.forEach((value, index) => {
    const clean = text(value);
    if (!clean) return;
    const label = text(headers[index]) || `Column ${index + 1}`;
    result[`${index + 1}:${label}`] = clean;
  });
  return result;
}

function rowHasValue(row: unknown[]): boolean {
  return row.some((value) => Boolean(text(value)));
}

function findBestHeaderRow(rows: unknown[][], aliases: readonly string[]): number {
  let bestIndex = -1;
  let bestScore = 0;
  const wanted = new Set(aliases.map(normalizeHeader).filter(Boolean));
  rows.slice(0, 25).forEach((row, index) => {
    const score = row.reduce<number>((sum, cell) => {
      const normalized = normalizeHeader(cell);
      return sum + (normalized && wanted.has(normalized) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore >= 2 ? bestIndex : -1;
}

async function csvMatrices(file: File): Promise<SourceMatrix[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: false,
      complete: (result: ParseResult<string[]>) => {
        const fatal = result.errors.find((error) => error.code === 'MissingQuotes' || error.code === 'UndetectableDelimiter');
        if (fatal) reject(new Error(`CSV parsing failed: ${fatal.message}`));
        else resolve([{ workbookName: file.name, sheetName: file.name.replace(/\.csv$/i, ''), rows: result.data }]);
      },
      error: reject,
    });
  });
}

async function xlsxMatrices(file: File): Promise<SourceMatrix[]> {
  const sheets = await readXlsxFile(file);
  return sheets.map((sheet) => ({ workbookName: file.name, sheetName: sheet.sheet, rows: sheet.data as CellValue[][] }));
}

async function pdfMatrices(file: File): Promise<SourceMatrix[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const document = await loadingTask.promise;
  const matrices: SourceMatrix[] = [];
  let extractedCharacters = 0;

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items
      .filter((item): item is typeof item & { str: string; transform: number[]; width: number } => 'str' in item && Boolean(item.str.trim()) && Array.isArray(item.transform))
      .map((item) => ({ str: item.str.trim(), x: Number(item.transform[4] ?? 0), y: Number(item.transform[5] ?? 0), width: Number(item.width ?? 0) }));
    extractedCharacters += items.reduce((sum, item) => sum + item.str.length, 0);
    items.sort((a, b) => Math.abs(a.y - b.y) > 2.5 ? b.y - a.y : a.x - b.x);

    const lines: typeof items[] = [];
    for (const item of items) {
      let line = lines.find((candidate) => Math.abs(candidate[0].y - item.y) <= 2.5);
      if (!line) {
        line = [];
        lines.push(line);
      }
      line.push(item);
    }

    const rows = lines
      .sort((a, b) => b[0].y - a[0].y)
      .map((line) => {
        line.sort((a, b) => a.x - b.x);
        const cells: string[] = [];
        let current = '';
        let rightEdge = 0;
        line.forEach((item, index) => {
          const gap = index === 0 ? 0 : item.x - rightEdge;
          if (index > 0 && gap > Math.max(12, item.str.length * 0.5)) {
            cells.push(current.trim());
            current = item.str;
          } else {
            current = `${current} ${item.str}`.trim();
          }
          rightEdge = item.x + item.width;
        });
        if (current) cells.push(current.trim());
        return cells;
      })
      .filter(rowHasValue);
    matrices.push({ workbookName: file.name, sheetName: `PDF page ${pageNumber}`, rows });
  }

  if (extractedCharacters < 20) {
    throw new Error('This PDF appears to be scanned images without selectable table text. Export it to XLSX or CSV, or run OCR before importing. Nothing was saved.');
  }
  return matrices;
}

async function fileMatrices(file: File): Promise<SourceMatrix[]> {
  const lower = file.name.toLowerCase();
  if (file.size > MAX_FILE_BYTES) throw new Error('The file is larger than 15 MB. Split it into smaller files.');
  if (lower.endsWith('.csv')) return csvMatrices(file);
  if (lower.endsWith('.xlsx')) return xlsxMatrices(file);
  if (lower.endsWith('.pdf')) return pdfMatrices(file);
  throw new Error('Choose a CSV, XLSX, or PDF file.');
}

function inventoryRowsFromMatrix(matrix: SourceMatrix, warnings: string[]): InventoryImportRow[] {
  const aliases = [
    'sku', 'product sku', 'item code', 'code', 'product', 'product name', 'item',
    'quantity', 'qty', 'stock', 'current stock', 'bottles', 'bottle count', 'balance', 'remaining',
    'outlet', 'location', 'branch', 'supermarket', 'warehouse', 'address', 'subcity',
    ...PRODUCT_COLUMNS.flatMap((product) => product.aliases),
  ];
  const headerIndex = findBestHeaderRow(matrix.rows, aliases);
  if (headerIndex < 0) {
    warnings.push(`${matrix.workbookName} › ${matrix.sheetName}: no recognizable inventory header was found; this sheet/page was not imported.`);
    return [];
  }
  const headers = matrix.rows[headerIndex];
  const columns = {
    sku: findHeader(headers, ['SKU', 'Product SKU', 'Item Code', 'Code']),
    product: findHeader(headers, ['Product', 'Product Name', 'Item', 'Name']),
    quantity: findHeader(headers, ['Quantity', 'Qty', 'Stock', 'Current Stock', 'Bottles', 'Bottle Count', 'Balance', 'Remaining']),
    outlet: findHeader(headers, ['Outlet', 'Location', 'Branch', 'Supermarket', 'Warehouse']),
    locationType: findHeader(headers, ['Location Type', 'Inventory Type']),
    address: findHeader(headers, ['Address', 'Adress']),
    subcity: findHeader(headers, ['Subcity', 'Sub-city']),
  };
  const productColumns = PRODUCT_COLUMNS.map((product) => ({ ...product, index: findHeader(headers, product.aliases) })).filter((product) => product.index >= 0);
  const stockColumns = PRODUCT_COLUMNS.map((product) => ({
    ...product,
    index: findHeader(headers, product.aliases.flatMap((alias) => [`${alias} Stock`, `${alias} Current Stock`, `${alias} Balance`, `${alias} Remaining`])),
  })).filter((product) => product.index >= 0);
  const result: InventoryImportRow[] = [];

  if (stockColumns.length) {
    const candidateRows = matrix.rows.slice(headerIndex + 1)
      .map((row, offset) => ({ row, sourceRow: headerIndex + offset + 2 }))
      .filter(({ row }) => stockColumns.some((product) => text(row[product.index])));
    const latest = candidateRows.at(-1);
    if (!latest) return [];
    warnings.push(`${matrix.workbookName} › ${matrix.sheetName}: recognized a wide stock ledger and selected its last populated stock row (${latest.sourceRow}) as the snapshot. Earlier movement rows were not applied to live stock.`);
    stockColumns.forEach((product) => {
      const cellValue = latest.row[product.index];
      result.push({
        source_workbook: matrix.workbookName,
        product_sku: product.sku,
        product_name: null,
        target_quantity: nonNegativeInteger(cellValue),
        location_type: 'FACTORY',
        outlet_name: null,
        address: null,
        subcity: null,
        source_sheet: matrix.sheetName,
        source_row: latest.sourceRow,
        raw_row: rawRow(headers, latest.row),
      });
    });
    return result;
  }

  matrix.rows.slice(headerIndex + 1).forEach((row, offset) => {
    if (!rowHasValue(row)) return;
    const sourceRow = headerIndex + offset + 2;
    const outletName = columns.outlet >= 0 ? nullable(row[columns.outlet]) : null;
    const typeRaw = columns.locationType >= 0 ? normalizeHeader(row[columns.locationType]) : '';
    const locationType: InventoryImportRow['location_type'] = typeRaw.includes('outlet') || typeRaw.includes('branch') || Boolean(outletName) ? 'OUTLET' : 'FACTORY';
    const base = {
      source_workbook: matrix.workbookName,
      location_type: locationType,
      outlet_name: outletName,
      address: columns.address >= 0 ? nullable(row[columns.address]) : null,
      subcity: columns.subcity >= 0 ? nullable(row[columns.subcity]) : null,
      source_sheet: matrix.sheetName,
      source_row: sourceRow,
      raw_row: rawRow(headers, row),
    };

    if (columns.quantity >= 0 && (columns.sku >= 0 || columns.product >= 0)) {
      result.push({
        product_sku: columns.sku >= 0 ? nullable(row[columns.sku]) : null,
        product_name: columns.product >= 0 ? nullable(row[columns.product]) : null,
        target_quantity: nonNegativeInteger(row[columns.quantity]),
        ...base,
      });
      return;
    }

    if (productColumns.length) {
      let expanded = 0;
      productColumns.forEach((product) => {
        const cellValue = row[product.index];
        if (!text(cellValue)) return;
        result.push({ product_sku: product.sku, product_name: null, target_quantity: nonNegativeInteger(cellValue), ...base });
        expanded += 1;
      });
      if (!expanded) result.push({ product_sku: null, product_name: null, target_quantity: null, ...base });
    }
  });
  return result;
}

function creditRowsFromMatrix(matrix: SourceMatrix, warnings: string[]): CreditImportRow[] {
  const aliases = ['Column 1', 'Reference', 'ID', 'Supermarket', 'Outlet', 'Customer', 'Payment Status', 'Total Price', 'Refilled Date', 'Sale Date', ...PRODUCT_COLUMNS.flatMap((product) => product.aliases)];
  const headerIndex = findBestHeaderRow(matrix.rows, aliases);
  if (headerIndex < 0) {
    warnings.push(`${matrix.workbookName} › ${matrix.sheetName}: no recognizable credit-sales header was found; this sheet/page was not imported.`);
    return [];
  }
  const headers = matrix.rows[headerIndex];
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
  const productColumns = PRODUCT_COLUMNS.map((product) => ({ ...product, index: findHeader(headers, product.aliases) })).filter((product) => product.index >= 0);
  const creditSpecificColumn = findHeader(headers, ['Payment Status', 'Total Price', 'Refilled Date', 'When to be paid', 'Payment date', 'Bottle price', 'Agreement Period', 'Payment Type']);
  if (creditSpecificColumn < 0) return [];
  const rows: CreditImportRow[] = [];

  matrix.rows.slice(headerIndex + 1).forEach((row, offset) => {
    const recordColumns = [columns.reference, columns.supermarket, columns.address, columns.subcity, columns.total, columns.refilledDate, columns.dueDate, columns.paymentDate, columns.extraNote, columns.note, ...productColumns.map((product) => product.index)].filter((index) => index >= 0);
    if (!recordColumns.some((index) => Boolean(text(row[index])))) return;
    const sourceRow = headerIndex + offset + 2;
    const supermarket = columns.supermarket >= 0 ? nullable(row[columns.supermarket]) : null;
    const rawTotal = columns.total >= 0 ? nullable(row[columns.total]) : null;
    const total = rawTotal === null ? null : numberValue(rawTotal);
    const items: CreditImportItem[] = [];
    const quality: string[] = [];
    productColumns.forEach((product) => {
      const value = row[product.index];
      if (!text(value)) return;
      const quantity = positiveInteger(value);
      if (quantity === null) quality.push(`Invalid ${product.sku} quantity: ${text(value)}`);
      else items.push({ sku: product.sku, quantity });
    });
    if (!supermarket) quality.push('Outlet name missing');
    if (columns.refilledDate < 0 || !nullable(row[columns.refilledDate])) quality.push('Sale date missing');
    if (!items.length) quality.push('Product quantities missing');
    if (rawTotal !== null && total === null) quality.push(`Total price is not numeric: ${rawTotal}`);
    const statusRaw = columns.status >= 0 ? normalizeHeader(row[columns.status]) : '';
    const status = statusRaw === 'paid' ? 'PAID' : statusRaw === 'unpaid' ? 'UNPAID' : 'UNKNOWN';
    const typeRaw = columns.paymentType >= 0 ? normalizeHeader(row[columns.paymentType]) : '';
    const type = ({ cash: 'CASH', credit: 'CREDIT', consinment: 'CONSIGNMENT', consignment: 'CONSIGNMENT', check: 'CHEQUE', cheque: 'CHEQUE' } as Record<string, string>)[typeRaw] ?? (typeRaw ? typeRaw.toUpperCase() : null);
    const noteParts = [columns.extraNote >= 0 ? nullable(row[columns.extraNote]) : null, columns.note >= 0 ? nullable(row[columns.note]) : null].filter((value): value is string => Boolean(value));
    rows.push({
      source_workbook: matrix.workbookName,
      external_key: `upload:${matrix.workbookName}:${matrix.sheetName}:${sourceRow}`,
      legacy_reference: columns.reference >= 0 ? nullable(row[columns.reference]) : null,
      supermarket,
      address: columns.address >= 0 ? nullable(row[columns.address]) : null,
      subcity: columns.subcity >= 0 ? nullable(row[columns.subcity]) : null,
      payment_status: status,
      total_price: total,
      total_price_raw: rawTotal,
      refilled_date_raw: columns.refilledDate >= 0 ? nullable(row[columns.refilledDate]) : null,
      due_date_raw: columns.dueDate >= 0 ? nullable(row[columns.dueDate]) : null,
      payment_date_raw: columns.paymentDate >= 0 ? nullable(row[columns.paymentDate]) : null,
      bottle_price_raw: columns.bottlePrice >= 0 ? nullable(row[columns.bottlePrice]) : null,
      agreement_period: columns.agreement >= 0 ? nullable(row[columns.agreement]) : null,
      payment_type: type,
      notes: Array.from(new Set(noteParts)).join(' | ') || null,
      sales_representative: columns.representative >= 0 ? nullable(row[columns.representative]) : columns.representativeFallback >= 0 ? nullable(row[columns.representativeFallback]) : null,
      source_sheet: matrix.sheetName,
      source_row: sourceRow,
      record_status: quality.length ? 'DRAFT' : 'COMPLETE',
      quality_notes: quality,
      items,
      raw_row: rawRow(headers, row),
    });
  });
  return rows;
}

function orderIssuesFromMatrix(matrix: SourceMatrix): ImportParseIssue[] {
  const aliases = [
    'N0', 'NO', 'Reference', 'ID', 'Supermarket', 'Outlet', 'Address', 'Status',
    'Order date', 'Delivery date', 'Remark', 'Notes',
    ...PRODUCT_COLUMNS.flatMap((product) => product.aliases),
  ];
  const headerIndex = findBestHeaderRow(matrix.rows, aliases);
  if (headerIndex < 0) return [];
  const headers = matrix.rows[headerIndex];
  const outlet = findHeader(headers, ['Supermarket', 'Outlet', 'Customer']);
  const orderDate = findHeader(headers, ['Order date', 'Order Date', 'Date ordered']);
  const deliveryDate = findHeader(headers, ['Delivery date', 'Delivery Date', 'Date delivered']);
  const status = findHeader(headers, ['Status', 'Delivery status']);
  if (status < 0 || (orderDate < 0 && deliveryDate < 0)) return [];
  const reference = findHeader(headers, ['N0', 'NO', 'Reference', 'ID']);
  const address = findHeader(headers, ['Address', 'Adress']);
  const notes = findHeader(headers, ['Remark', 'Remarks', 'Note', 'Notes']);
  const productColumns = PRODUCT_COLUMNS
    .map((product) => ({ ...product, index: findHeader(headers, product.aliases) }))
    .filter((product) => product.index >= 0);
  const businessColumns = [reference, outlet, address, orderDate, deliveryDate, notes, ...productColumns.map((product) => product.index)]
    .filter((index) => index >= 0);
  const issues: ImportParseIssue[] = [];

  matrix.rows.slice(headerIndex + 1).forEach((row, offset) => {
    if (!businessColumns.some((index) => Boolean(text(row[index])))) return;
    const messages: string[] = [];
    if (outlet < 0 || !nullable(row[outlet])) messages.push('Outlet name missing');
    if (orderDate < 0 || !nullable(row[orderDate])) messages.push('Order date missing');
    const statusValue = normalizeHeader(row[status]);
    if (statusValue.includes('deliver') && (deliveryDate < 0 || !nullable(row[deliveryDate]))) messages.push('Delivery date missing for delivered order');
    const hasProductQuantity = productColumns.some((product) => positiveInteger(row[product.index]) !== null);
    if (!hasProductQuantity) messages.push('Product quantities missing');
    if (messages.length) {
      issues.push({ workbook: matrix.workbookName, sheet: matrix.sheetName, row: headerIndex + offset + 2, messages });
    }
  });
  return issues;
}

export async function parseImportFile(file: File, kind: ImportKind): Promise<ImportParseSummary> {
  const matrices = await fileMatrices(file);
  const warnings: string[] = [];
  const inventoryRows = kind === 'INVENTORY' ? matrices.flatMap((matrix) => inventoryRowsFromMatrix(matrix, warnings)) : [];
  const creditRows = kind === 'CREDIT_SALES' ? matrices.flatMap((matrix) => creditRowsFromMatrix(matrix, warnings)) : [];
  const rowCount = inventoryRows.length || creditRows.length;
  if (!rowCount) throw new Error('No importable rows were recognized. Check the column headers or export the table as CSV/XLSX. Nothing was saved.');
  if (rowCount > MAX_ROWS) throw new Error(`This file expands to more than ${MAX_ROWS.toLocaleString()} rows. Split it into smaller files.`);
  const draftRows = kind === 'INVENTORY'
    ? inventoryRows.filter((row) => (!row.product_sku && !row.product_name) || row.target_quantity === null || (row.location_type === 'OUTLET' && !row.outlet_name)).length
    : creditRows.filter((row) => row.record_status === 'DRAFT').length;
  const issues: ImportParseIssue[] = kind === 'INVENTORY'
    ? inventoryRows.filter((row) => (!row.product_sku && !row.product_name) || row.target_quantity === null || (row.location_type === 'OUTLET' && !row.outlet_name)).map((row) => ({
      workbook: row.source_workbook,
      sheet: row.source_sheet,
      row: row.source_row,
      messages: [
        ...(!row.product_sku && !row.product_name ? ['Product missing'] : []),
        ...(row.target_quantity === null ? ['Quantity missing or invalid'] : []),
        ...(row.location_type === 'OUTLET' && !row.outlet_name ? ['Outlet name missing'] : []),
      ],
    }))
    : [
      ...creditRows.filter((row) => row.record_status === 'DRAFT').map((row) => ({ workbook: row.source_workbook, sheet: row.source_sheet, row: row.source_row, messages: row.quality_notes })),
      ...matrices.flatMap(orderIssuesFromMatrix),
    ];
  return { kind, inventoryRows, creditRows, sheetNames: matrices.map((matrix) => matrix.sheetName), warnings, draftRows, issues };
}
