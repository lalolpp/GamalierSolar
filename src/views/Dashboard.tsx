import { Activity, CloudSun, Coins, Cpu, Gauge, Leaf, Sun, Thermometer, TrendingUp, Zap } from "lucide-react";
import { Card, ErrorBanner, Kpi, LoadingPanel } from "../components/ui";
import { InverterProductionChart, PowerCurveChart } from "../components/charts";
import { mergeCurve, useApp } from "../store";
import {
  formatCo2,
  formatEur,
  formatEnergy,
  formatNumber,
  formatPercent,
  formatPower,
} from "../lib/format";
import type { InverterProductionPoint } from "../domain/types";

export function Dashboard() {
  const { state, retry } = useApp();
  const { live, inverters, settings, loading, error } = state;

  if (error && !live) return <ErrorBanner message={error} onRetry={retry} />;
  if (!live && loading) return <LoadingPanel />;
  if (!live) return <ErrorBanner message="Error al obtener datos" onRetry={retry} />;

  const totalPower = inverters.reduce((s, i) => s + i.powerKw, 0);
  const productionByInverter: InverterProductionPoint[] = inverters.map((inv) => ({
    name: inv.name.replace("Inversor ", "INV "),
    kwh: totalPower > 0 ? (inv.powerKw / totalPower) * live.kwhToday : 0,
  }));

  const income = live.kwhToday * settings.priceKwh;
  const co2Avoided = live.kwhToday * settings.co2Factor;
  const sunHours = settings.installedKwp > 0 ? live.kwhToday / settings.installedKwp : 0;
  const curve = mergeCurve(state.curveToday, state.curveYesterday);

  return (
    <div className="space-y-4">
      <ErrorBanner message={error ?? ""} onRetry={retry} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Zap} label="Potencia actual" value={formatPower(live.powerKw)} tone="brand" hint={`Pico hoy: ${formatPower(live.peakKw)}`} />
        <Kpi icon={Activity} label="Producción hoy" value={formatEnergy(live.kwhToday)} tone="success" />
        <Kpi icon={CloudSun} label="Irradiancia" value={`${formatIntegerSafe(live.irradiance)} W/m²`} />
        <Kpi icon={Thermometer} label="Temperaturas" value={`${formatNumber(live.moduleTemp, 1)} °C`} hint={`Ambiente: ${formatNumber(live.ambientTemp, 1)} °C`} tone="warning" />
        <Kpi icon={Gauge} label="Rendimiento (PR)" value={live.pr > 0 ? formatPercent(live.pr) : "—"} tone="info" />
        <Kpi icon={Cpu} label="Inversores" value={`${live.onlineInverters}/${live.inverterCount}`} hint={live.onlineInverters === live.inverterCount ? "Todos en línea" : "Revisa Dispositivos"} tone={live.onlineInverters === live.inverterCount ? "success" : "danger"} />
      </div>

      <Card title="Curva de potencia" subtitle="Hoy comparada con ayer">
        <PowerCurveChart data={curve} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Producción estimada por inversor" subtitle="Reparto proporcional a la potencia instantánea">
          <InverterProductionChart data={productionByInverter} />
        </Card>

        <Card title="Economía y medio ambiente">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Kpi icon={Coins} label="Ingresos hoy" value={formatEur(income)} tone="success" hint={`Tarifa ${formatNumber(settings.priceKwh, 2)} €/kWh`} />
            <Kpi icon={Leaf} label="CO₂ evitado hoy" value={formatCo2(co2Avoided)} tone="success" />
            <Kpi icon={Sun} label="Horas pico eq." value={`${formatNumber(sunHours, 2)} h`} tone="brand" hint={`Sobre ${formatNumber(settings.installedKwp, 0)} kWp`} />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <TrendingUp className="size-3.5" aria-hidden /> Datos del simulador local en modo demo.
          </p>
        </Card>
      </div>
    </div>
  );
}

function formatIntegerSafe(v: number): string {
  return formatNumber(v, 0);
}
