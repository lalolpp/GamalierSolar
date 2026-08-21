import { useMemo, useState } from "react";
import { CalendarRange, Download, TrendingUp, Trophy } from "lucide-react";
import { Badge, Button, Card, EmptyState, Kpi, SelectInput } from "../components/ui";
import { useApp } from "../store";
import * as historyService from "../services/history";
import type { HistoryRangeUnit, HistoryRecord } from "../domain/types";
import {
  formatDate,
  formatEnergy,
  formatMonthKey,
  formatNumber,
  formatPercent,
} from "../lib/format";

const UNIT_OPTIONS: { value: HistoryRangeUnit; label: string }[] = [
  { value: "day", label: "Por día (últimos 45 días)" },
  { value: "month", label: "Por mes (últimos 18 meses)" },
  { value: "year", label: "Por año (últimos 5 años)" },
];

interface Summary {
  totalKwh: number;
  dailyAvgKwh: number;
  bestDay: HistoryRecord | null;
  avgPr: number;
}

function summarize(records: HistoryRecord[]): Summary {
  if (records.length === 0) return { totalKwh: 0, dailyAvgKwh: 0, bestDay: null, avgPr: 0 };
  const total = records.reduce((s, r) => s + r.energyKwh, 0);
  const best = records.reduce((m, r) => (r.energyKwh > m.energyKwh ? r : m), records[0] as HistoryRecord);
  return {
    totalKwh: total,
    dailyAvgKwh: total / records.length,
    bestDay: best,
    avgPr: records.reduce((s, r) => s + r.pr, 0) / records.length,
  };
}

export function History() {
  const { state, setHistoryUnit, pushToast } = useApp();
  const [unit, setUnit] = useState<HistoryRangeUnit>("day");
  const { history, historyLoading, error } = state;

  const summary = useMemo(() => summarize(history), [history]);
  const dateLabel = (iso: string) => (unit === "day" ? formatDate(iso) : unit === "month" ? formatMonthKey(iso) : iso);

  const onExport = () => {
    if (history.length === 0) {
      pushToast("No hay datos que exportar", "error");
      return;
    }
    historyService.downloadHistoryCsv(history);
    pushToast("CSV exportado", "success");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="w-full sm:w-72">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Agrupación
          </span>
          <SelectInput
            value={unit}
            onChange={(e) => {
              const next = e.target.value as HistoryRangeUnit;
              setUnit(next);
              setHistoryUnit(next);
            }}
          >
            {UNIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectInput>
        </label>
        <Button onClick={onExport} className="w-full sm:w-auto">
          <Download className="size-4" aria-hidden /> Exportar CSV
        </Button>
      </div>

      <ErrorHint message={error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={CalendarRange} label="Energía total" value={formatEnergy(summary.totalKwh)} tone="brand" />
        <Kpi icon={CalendarRange} label="Media diaria" value={formatEnergy(summary.dailyAvgKwh)} />
        <Kpi
          icon={Trophy}
          label="Mejor día"
          value={summary.bestDay ? formatEnergy(summary.bestDay.energyKwh) : "—"}
          hint={summary.bestDay ? formatDate(summary.bestDay.date) : undefined}
          tone="warning"
        />
        <Kpi icon={TrendingUp} label="PR medio" value={formatPercent(summary.avgPr)} tone="info" />
      </div>

      <Card title={`Registros (${history.length})`} subtitle="Datos históricos de producción">
        {historyLoading && history.length === 0 ? (
          <EmptyState icon={CalendarRange} title="Cargando historial…" />
        ) : history.length === 0 ? (
          <EmptyState icon={CalendarRange} title="Sin registros" message="No hay datos para el periodo seleccionado." />
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  <th className="py-2 pr-3 text-right font-medium">Energía</th>
                  <th className="py-2 pr-3 text-right font-medium">Media</th>
                  <th className="py-2 pr-3 text-right font-medium">Pico</th>
                  <th className="py-2 pr-3 text-right font-medium">PR</th>
                  <th className="py-2 text-right font-medium">Irradiancia</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((r) => (
                  <tr key={r.date} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                    <td className="py-2.5 pr-3 whitespace-nowrap text-slate-200">{dateLabel(r.date)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-100">{formatNumber(r.energyKwh, 1)} kWh</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-300">{formatNumber(r.averageKw, 1)} kW</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-slate-300">{formatNumber(r.peakKw, 1)} kW</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      <Badge tone={r.pr >= 80 ? "success" : "warning"}>{formatPercent(r.pr)}</Badge>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-400">
                      {r.irradiance === undefined ? "—" : `${formatNumber(r.irradiance, 0)} W/m²`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ErrorHint({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-400">{message}</p>;
}
