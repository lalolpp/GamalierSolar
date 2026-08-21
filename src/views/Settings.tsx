import { useState } from "react";
import { Activity, Bell, Cpu, Database, PlugZap, RotateCcw, Router, Save, ServerCog, Share2, SunMedium } from "lucide-react";
import { Badge, Button, Card, Field, TextInput } from "../components/ui";
import { QrShare } from "../components/QrShare";
import type { PlantSettings } from "../domain/types";
import { PLANT_PROFILE } from "../domain/plant";
import { formatClock, formatDateTime, formatNumber } from "../lib/format";
import { useApp } from "../store";

export function Settings() {
  const {
    state,
    saveSettings,
    providerLabel,
    providerStatus,
    demoEnabled,
    appVersion,
    resetDemo,
    pushToast,
  } = useApp();
  const [draft, setDraft] = useState<PlantSettings>(state.settings);
  const [errors, setErrors] = useState<Partial<Record<keyof PlantSettings, string>>>({});

  const update = <K extends keyof PlantSettings>(key: K, value: PlantSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const onSave = () => {
    const result = saveSettings(draft);
    if (!result.ok) setErrors(result.errors);
    else setErrors({});
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-4">
      <Card title="Datos de la planta">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre de la planta" error={errors.plantName}>
            <TextInput value={draft.plantName} onChange={(e) => update("plantName", e.target.value)} />
          </Field>
          <Field label="Ubicación" error={errors.location}>
            <TextInput value={draft.location} onChange={(e) => update("location", e.target.value)} />
          </Field>
          <Field label="Potencia instalada (kWp)" error={errors.installedKwp}>
            <TextInput
              type="number"
              min={0}
              step={0.1}
              value={draft.installedKwp}
              onChange={(e) => update("installedKwp", Number(e.target.value))}
            />
          </Field>
          <Field label="Precio energía (CLP/kWh)" error={errors.priceKwh}>
            <TextInput
              type="number"
              min={0}
              step={0.01}
              value={draft.priceKwh}
              onChange={(e) => update("priceKwh", Number(e.target.value))}
            />
          </Field>
          <Field label="Factor CO₂ (kg/kWh)" error={errors.co2Factor} hint="Emisiones evitadas por kWh generado">
            <TextInput
              type="number"
              min={0}
              step={0.01}
              value={draft.co2Factor}
              onChange={(e) => update("co2Factor", Number(e.target.value))}
            />
          </Field>
          <Field label="Puesta en marcha" error={errors.commissioned}>
            <TextInput
              type="date"
              value={draft.commissioned}
              onChange={(e) => update("commissioned", e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={onSave}>
            <Save className="size-4" aria-hidden /> Guardar ajustes
          </Button>
        </div>
      </Card>

      <Card
        title="Compartir acceso"
        subtitle="Escanea el QR desde el móvil para abrir la aplicación"
      >
        <QrShare onToast={pushToast} />
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <Share2 className="size-3.5" aria-hidden /> El móvil debe estar en la misma red que este equipo.
        </p>
      </Card>
      </div>

      <div className="space-y-4">
        <Card title="Origen de datos" subtitle="Configurado mediante VITE_DATA_MODE en tiempo de compilación">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <span className="flex items-center gap-2 text-sm text-slate-300">
              <Database className="size-4 text-slate-500" aria-hidden /> Modo actual
            </span>
            <Badge tone={providerStatus === "real" ? "success" : "brand"}>
              {providerStatus === "real" ? "REAL" : "DEMO"}
            </Badge>
          </div>
          <p className="mt-3 flex items-start gap-2 text-sm text-slate-400">
            {providerStatus === "real" ? (
              <>
                <ServerCog className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
                Conectado al proveedor real ({providerLabel}) a través del backend.
              </>
            ) : (
              <>
                <SunMedium className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
                Simulador local activo.
                {providerStatus === "real-unconfigured"
                  ? " Proveedor real no configurado: se están usando datos simulados."
                  : ""}
              </>
            )}
          </p>
          {!demoEnabled && providerStatus !== "real" && (
            <p className="mt-2 rounded-lg border border-amber-900/70 bg-amber-950/40 p-2.5 text-xs text-amber-200">
              Proveedor real no configurado. Define VITE_HUAWEI_ENDPOINT y despliega el backend para activarlo.
            </p>
          )}
        </Card>

        <Card title="Diagnóstico">
          <dl className="space-y-2.5 text-sm">
            <DiagRow icon={ServerCog} label="Proveedor activo" value={providerLabel} />
            <DiagRow
              icon={Router}
              label="SmartLogger"
              value={PLANT_PROFILE.smartlogger.serialNumber}
            />
            <DiagRow icon={PlugZap} label="Medidor de energía" value={PLANT_PROFILE.meter.serialNumber} />
            <DiagRow
              icon={Activity}
              label="Última actualización"
              value={state.live ? formatClock(state.live.now) : "—"}
            />
            <DiagRow icon={Cpu} label="Inversores" value={`${state.inverters.length} × 100 kW`} />
            <DiagRow
              icon={Bell}
              label="Alarmas cargadas"
              value={`${state.alarms.filter((a) => !a.acked).length} activas / ${state.alarms.length} totales`}
            />
            <DiagRow icon={Database} label="Versión de aplicación" value={`v${appVersion}`} />
          </dl>
          {state.lastUpdated && (
            <p className="mt-3 text-xs text-slate-600">
              Última sincronización completa: {formatDateTime(state.lastUpdated)}
            </p>
          )}
        </Card>

        <Card title="Mantenimiento">
          <p className="text-sm text-slate-400">
            Reinicia el reloj virtual, la velocidad y las alarmas del simulador a su estado inicial.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Potencia configurada actualmente: {formatNumber(state.settings.installedKwp, 1)} kWp.
          </p>
          <div className="mt-4 flex justify-end">
            <Button variant="danger" disabled={!demoEnabled} onClick={resetDemo}>
              <RotateCcw className="size-4" aria-hidden /> Reiniciar modo demo
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DiagRow({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800/60 pb-2 last:border-0 last:pb-0">
      <dt className="flex items-center gap-2 text-slate-400">
        <Icon className="size-4 text-slate-500" aria-hidden /> {label}
      </dt>
      <dd className="font-medium tabular-nums text-slate-200">{value}</dd>
    </div>
  );
}
