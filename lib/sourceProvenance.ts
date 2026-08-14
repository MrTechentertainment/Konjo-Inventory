export interface SourceLocation {
  workbook: string;
  sheet: string;
  row: number | null;
}

interface SourceFallback {
  sourceName?: unknown;
  sourceSheet?: unknown;
  sourceRow?: unknown;
  rawRow?: unknown;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function rowNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function provenanceEntries(rawRow: unknown): unknown[] {
  const object = objectValue(rawRow);
  if (!object) return [];
  const entry = Object.entries(object).find(([key]) => key.toLowerCase().replace(/[^a-z]+/g, ' ').trim() === 'source provenance');
  if (!entry) return [];
  const value = entry[1];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function sourceLocation({ sourceName, sourceSheet, sourceRow, rawRow }: SourceFallback): SourceLocation {
  const exact = objectValue(provenanceEntries(rawRow)[0]);
  return {
    workbook: String(exact?.file ?? sourceName ?? 'Unknown workbook'),
    sheet: String(exact?.sheet ?? sourceSheet ?? 'Unknown sheet'),
    row: rowNumber(exact?.row ?? sourceRow),
  };
}

export function sourceLocationLabel(source: SourceLocation): string {
  return `${source.workbook} › ${source.sheet}${source.row === null ? '' : ` › row ${source.row}`}`;
}
