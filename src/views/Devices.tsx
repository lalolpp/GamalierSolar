import { Cable, Cpu, Gauge, Thermometer, Zap } from "lucide-react";
import { Badge, Button, Card, EmptyState, StatusDot } from "../components/ui";
import type { Inverter } from "../domain/types";
import { formatNumber, formatPower, formatRelativeSeconds } from "../lib/format";
import { useApp } from "../store";

const STATUS_TONE = {
  online: "success",
  standby: "warning",
  offline: "danger",
} as const;

export function Devices() {
  const { state, reconnectDevice } = useApp();
  const { inverters, live, loading } = state;

  if (inverters.length === 0 && loading) {
    return <Card title="Dispositivos"><EmptyState icon={Cpu} title="Cargando dispositivos…" /></Card>;
  }
  if (inverters.length === 0) {
    return <Card title="Dispositivos"><EmptyState icon={Cpu} title="Sin inversores" message="El proveedor no ha devuelto ningún dispositivo." /></Card>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {inverters.map((inv) => (
        <InverterCard key={inv.id} inverter={inv} now={live?.now ?? new Date()} onReconnect={() => void reconnectDevice(inv.id)} />
      ))}
    </div>
  );
}

function InverterCard({
  inverter: inv,
  now,
  onReconnect,
}: {
  inverter: Inverter;
  now: Date;
  onReconnect: () => void;
}) {
  const lastSeenSec = inv.lastSeen ? Math.max(0, (now.getTime() - inv.lastSeen.getTime()) / 1000) : null;
  const isOnline = inv.status === "online";

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <StatusDot status={inv.status} />
          {inv.name}
        </span>
      }
      subtitle={inv.model}
      actions={<Badge tone={STATUS_TONE[inv.status]}>{inv.status === "online" ? "En línea" : inv.status === "standby" ? "En espera" : "Desconectado"}</Badge>}
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <Metric icon={Zap} label="Potencia" value={formatPower(inv.powerKw)} />
        <Metric icon={Gauge} label="Eficiencia" value={`${formatNumber(inv.efficiency, 1)} %`} />
        <Metric icon={Thermometer} label="Temperatura" value={`${formatNumber(inv.temperature, 1)} °C`} />
        <Metric icon={Cable} label="AC" value={`${formatNumber(inv.acVoltage ?? 0, 0)} V`} />
      </div>

      {(isOnline || inv.dcVoltage !== undefined) && (
        <p className="mt-3 text-xs text-slate-500">
          DC: {formatNumber(inv.dcVoltage ?? 0, 0)} V · {formatNumber(inv.dcCurrent ?? 0, 1)} A totales
          {lastSeenSec !== null && ` · Última comunicación ${formatRelativeSeconds(lastSeenSec)}`}
        </p>
      )}

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Strings</p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {inv.strings.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-2.5 py-2"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <StatusDot status={s.status} />
                {s.id.split("-").slice(-1)[0]}
              </span>
              <span className="text-right text-xs tabular-nums text-slate-400">
                {isOnline ? `${formatNumber(s.current, 1)} A · ${formatNumber(s.powerKw, 2)} kW` : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant={inv.status === "offline" ? "primary" : "ghost"} disabled={inv.status === "online"} onClick={onReconnect}>
          Reconectar
        </Button>
      </div>
    </Card>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-2">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500">
        <Icon className="size-3.5" aria-hidden /> {label}
      </p>
      <p className="mt-0.5 tabular-nums font-semibold text-slate-100">{value}</p>
    </div>
  );
}
