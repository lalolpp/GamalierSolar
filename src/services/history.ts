import { getActiveProvider } from "../data";
import type { HistoryRange, HistoryRecord, HistoryRangeUnit } from "../domain/types";
import { rangeForUnit } from "../domain/defaults";
import { formatNumber } from "../lib/format";

export const historyService = {
  async get(range: HistoryRange): Promise<HistoryRecord[]> {
    return getActiveProvider().getHistory(range);
  },
  rangeFor(unit: HistoryRangeUnit, anchor: Date): HistoryRange {
    return rangeForUnit(unit, anchor);
  },
};

const CSV_HEADERS = [
  "Fecha",
  "Energía (kWh)",
  "Media (kW)",
  "Pico (kW)",
  "PR (%)",
  "Irradiancia (W/m²)",
];

function csvEscape(value: string): string {
  return /[";\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function buildHistoryCsv(records: HistoryRecord[]): string {
  const lines = [CSV_HEADERS.join(";")];
  for (const r of records) {
    const cells = [
      r.date,
      formatNumber(r.energyKwh, 2),
      formatNumber(r.averageKw, 2),
      formatNumber(r.peakKw, 2),
      formatNumber(r.pr, 2),
      r.irradiance === undefined ? "" : formatNumber(r.irradiance, 0),
    ];
    lines.push(cells.map(csvEscape).join(";"));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function historyCsvFilename(now: Date): string {
  const iso = now.toISOString().slice(0, 10);
  return `gamaliersolar_historial_${iso}.csv`;
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadHistoryCsv(records: HistoryRecord[]): void {
  if (records.length === 0) return;
  downloadTextFile(
    historyCsvFilename(new Date()),
    buildHistoryCsv(records),
    "text/csv;charset=utf-8",
  );
}
