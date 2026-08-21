import { useState } from "react";
import { BellOff, CheckCheck, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, Button, Card, EmptyState, SelectInput } from "../components/ui";
import type { Alarm, Severity } from "../domain/types";
import { formatDateTime } from "../lib/format";
import { useApp } from "../store";

const SEVERITY_META: Record<Severity, { label: string; tone: "info" | "warning" | "danger"; icon: LucideIcon }> = {
  info: { label: "Info", tone: "info", icon: Info },
  warning: { label: "Aviso", tone: "warning", icon: TriangleAlert },
  critical: { label: "Crítica", tone: "danger", icon: OctagonAlert },
};

type StateFilter = "all" | "active" | "acked";

export function Alarms() {
  const { state, acknowledgeAlarm, acknowledgeAllAlarms } = useApp();
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");

  const filtered = state.alarms.filter(
    (a) =>
      (severity === "all" || a.severity === severity) &&
      (stateFilter === "all" || (stateFilter === "active" ? !a.acked : a.acked)),
  );
  const active = filtered.filter((a) => !a.acked);
  const acked = filtered.filter((a) => a.acked);
  const criticalActive = state.alarms.filter((a) => !a.acked && a.severity === "critical").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-52">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Severidad</span>
          <SelectInput value={severity} onChange={(e) => setSeverity(e.target.value as Severity | "all")}>
            <option value="all">Todas</option>
            <option value="critical">Críticas</option>
            <option value="warning">Avisos</option>
            <option value="info">Info</option>
          </SelectInput>
        </label>
        <label className="w-full sm:w-52">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Estado</span>
          <SelectInput value={stateFilter} onChange={(e) => setStateFilter(e.target.value as StateFilter)}>
            <option value="all">Todas</option>
            <option value="active">Activas</option>
            <option value="acked">Reconocidas</option>
          </SelectInput>
        </label>

        <div className="ml-auto flex items-center gap-2">
          {criticalActive > 0 && (
            <Badge tone="danger">
              <OctagonAlert className="size-3" aria-hidden /> {criticalActive} crítica{criticalActive === 1 ? "" : "s"}
            </Badge>
          )}
          <Button variant="ghost" disabled={state.alarms.every((a) => a.acked)} onClick={() => void acknowledgeAllAlarms()}>
            <CheckCheck className="size-4" aria-hidden /> Reconocer todas
          </Button>
        </div>
      </div>

      <AlarmSection
        title={`Activas (${active.length})`}
        alarms={active}
        emptyTitle="Sin alarmas activas"
        emptyMessage="Todo en orden con los filtros actuales."
        onAck={(id) => void acknowledgeAlarm(id)}
      />

      {acked.length > 0 && (
        <AlarmSection
          title={`Reconocidas (${acked.length})`}
          alarms={acked}
          emptyTitle=""
          muted
          onAck={(id) => void acknowledgeAlarm(id)}
        />
      )}
    </div>
  );
}

function AlarmSection({
  title,
  alarms,
  emptyTitle,
  emptyMessage,
  muted = false,
  onAck,
}: {
  title: string;
  alarms: Alarm[];
  emptyTitle: string;
  emptyMessage?: string;
  muted?: boolean;
  onAck: (id: string) => void;
}) {
  return (
    <Card title={title}>
      {alarms.length === 0 ? (
        <EmptyState icon={BellOff} title={emptyTitle} message={emptyMessage} />
      ) : (
        <ul className="space-y-2">
          {alarms.map((alarm) => (
            <AlarmRow key={alarm.id} alarm={alarm} muted={muted} onAck={onAck} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function AlarmRow({ alarm, muted, onAck }: { alarm: Alarm; muted: boolean; onAck: (id: string) => void }) {
  const meta = SEVERITY_META[alarm.severity];
  const Icon = meta.icon;
  return (
    <li
      className={`flex flex-wrap items-start gap-3 rounded-lg border p-3 ${
        muted ? "border-slate-800/60 bg-slate-950/30 opacity-70" : "border-slate-800 bg-slate-950/50"
      }`}
    >
      <span
        className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ring-1 ${
          meta.tone === "danger"
            ? "bg-red-950 text-red-300 ring-red-800"
            : meta.tone === "warning"
              ? "bg-amber-950 text-amber-300 ring-amber-800"
              : "bg-sky-950 text-sky-300 ring-sky-800"
        }`}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-200">
          {alarm.title}
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {alarm.code && <span className="text-xs font-normal text-slate-500">{alarm.code}</span>}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{alarm.message}</p>
        <p className="mt-1 text-xs text-slate-600">
          {formatDateTime(alarm.timestamp)}
          {alarm.inverterId && ` · ${alarm.inverterId}`}
          {` · origen: ${alarm.source}`}
        </p>
      </div>
      {!alarm.acked && (
        <Button variant="ghost" onClick={() => onAck(alarm.id)}>
          Reconocer
        </Button>
      )}
    </li>
  );
}
