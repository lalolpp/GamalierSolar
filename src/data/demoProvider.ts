import type {
  Alarm,
  DeviceStatus,
  HistoryRange,
  HistoryRecord,
  Inverter,
  LiveTelemetry,
  PlantSettings,
  PowerCurve,
  Severity,
  StringTelemetry,
  TelemetryPoint,
} from "../domain/types";
import { DEFAULT_SETTINGS } from "../domain/defaults";
import {
  clamp,
  daySeedOf,
  eachDayIso,
  hourOfDay,
  isoDate,
  monthKey,
  mulberry32,
  performanceRatio,
  powerForIrradiance,
  simulateDay,
  solarWindow,
  weatherAt,
  yearKey,
} from "../lib/sim";
import type { DataProvider, SimulationControls } from "./DataProvider";

export interface SavedDemoState {
  nowIso?: string;
  speed?: number;
  paused?: boolean;
}

interface InverterDef {
  id: string;
  name: string;
  model: string;
}

const INVERTER_DEFS: readonly InverterDef[] = [
  { id: "INV-01", name: "Inversor 1", model: "SUN2000-60KTL-M0" },
  { id: "INV-02", name: "Inversor 2", model: "SUN2000-60KTL-M0" },
  { id: "INV-03", name: "Inversor 3", model: "SUN2000-60KTL-M0" },
  { id: "INV-04", name: "Inversor 4", model: "SUN2000-100KTL-M1" },
  { id: "INV-05", name: "Inversor 5", model: "SUN2000-100KTL-M1" },
];

const STRINGS_PER_INVERTER = 6;
const CURVE_START_HOUR = 6;
const CURVE_END_HOUR = 21;
const CURVE_STEP_MIN = 10;
const BASE_SEED = 20260801;

interface AlarmTemplate {
  code: string;
  severity: Severity;
  title: string;
  message: string;
}

const ALARM_TEMPLATES: readonly AlarmTemplate[] = [
  {
    code: "F101",
    severity: "critical",
    title: "Pérdida de comunicación con inversor",
    message: "El inversor no responde a las sondas de telemetría desde hace más de 5 minutos.",
  },
  {
    code: "C031",
    severity: "critical",
    title: "Fallo en string DC",
    message: "Corriente de string por debajo del umbral mínimo; posible fusible abierto.",
  },
  {
    code: "W010",
    severity: "warning",
    title: "Eficiencia por debajo del objetivo",
    message: "El rendimiento del inversor está un 3 % por debajo de la media de la planta.",
  },
  {
    code: "W044",
    severity: "warning",
    title: "Temperatura elevada",
    message: "Temperatura de disipador por encima de 75 °C durante más de 10 minutos.",
  },
  {
    code: "I002",
    severity: "info",
    title: "Reinicio programado completado",
    message: "El inversor se ha reiniciado correctamente tras la ventana de mantenimiento.",
  },
  {
    code: "I007",
    severity: "info",
    title: "Curva de potencia ajustada",
    message: "Se ha aplicado la curva de limitación activa configurada al 100 %.",
  },
];

function aggregateRecords(
  records: HistoryRecord[],
  unit: HistoryRange["unit"],
): HistoryRecord[] {
  if (unit === "day") return records;
  const groups = new Map<string, HistoryRecord[]>();
  for (const r of records) {
    const key = unit === "month" ? monthKey(r.date) : yearKey(r.date);
    const bucket = groups.get(key);
    if (bucket) bucket.push(r);
    else groups.set(key, [r]);
  }
  return [...groups.entries()]
    .map(([date, rs]) => ({
      date,
      energyKwh: rs.reduce((s, r) => s + r.energyKwh, 0),
      averageKw: rs.reduce((s, r) => s + r.averageKw, 0) / rs.length,
      peakKw: rs.reduce((m, r) => Math.max(m, r.peakKw), 0),
      pr: rs.reduce((s, r) => s + r.pr, 0) / rs.length,
      irradiance: rs.reduce((s, r) => s + (r.irradiance ?? 0), 0) / rs.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export class DemoProvider implements DataProvider, SimulationControls {
  readonly id = "demo";
  readonly label = "Simulador local";

  private settings: PlantSettings;
  private simNow: Date;
  private speed = 1;
  private paused = false;
  private readonly perfByInverter = new Map<string, number>();
  private readonly deviceOverrides = new Map<string, DeviceStatus>();
  private readonly historyCache = new Map<string, HistoryRecord>();
  private alarms: Alarm[] = [];
  private eventCheckAccumulatorMs = 0;

  constructor(saved?: SavedDemoState) {
    this.settings = { ...DEFAULT_SETTINGS };
    const parsed = saved?.nowIso ? new Date(saved.nowIso) : new Date();
    this.simNow = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    if (saved?.speed === 60 || saved?.speed === 600) this.speed = saved.speed;
    this.paused = Boolean(saved?.paused);
    const rng = mulberry32(BASE_SEED);
    for (const def of INVERTER_DEFS) {
      this.perfByInverter.set(def.id, 0.94 + rng() * 0.045);
    }
    this.regenerateAlarms();
  }

  applySettings(settings: PlantSettings): void {
    this.settings = { ...settings };
    this.historyCache.clear();
  }

  tick(deltaRealMs: number): void {
    if (this.paused) return;
    const deltaSimMs = deltaRealMs * this.speed;
    this.simNow = new Date(this.simNow.getTime() + deltaSimMs);
    this.eventCheckAccumulatorMs += deltaRealMs;
    if (this.eventCheckAccumulatorMs >= 15_000) {
      this.eventCheckAccumulatorMs = 0;
      const simHours = deltaSimMs / 3_600_000;
      const probability = clamp(simHours * 0.35, 0, 0.85);
      if (Math.random() < probability) {
        this.pushEventAlarm();
      }
    }
  }

  setSpeed(multiplier: number): void {
    this.speed = multiplier === 60 || multiplier === 600 ? multiplier : 1;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  reset(): void {
    this.simNow = new Date();
    this.speed = 1;
    this.paused = false;
    this.deviceOverrides.clear();
    this.historyCache.clear();
    this.regenerateAlarms();
  }

  async getLiveTelemetry(): Promise<LiveTelemetry> {
    const now = new Date(this.simNow);
    const seed = daySeedOf(isoDate(now));
    const wx = weatherAt(now, seed);
    const inverters = this.buildInverters(now, wx.moduleTemp);
    const onlineInverters = inverters.filter((i) => i.status === "online");
    const powerKw = onlineInverters.reduce((s, i) => s + i.powerKw, 0);
    const integration = this.integrateToday(now);
    const installed = this.installedKwp();
    return {
      now,
      powerKw,
      kwhToday: integration.kwhToday,
      irradiance: wx.irradiance,
      moduleTemp: wx.moduleTemp,
      ambientTemp: wx.ambientTemp,
      pr: performanceRatio(powerKw, installed, wx.irradiance),
      peakKw: Math.max(integration.peakKw, powerKw),
      inverterCount: inverters.length,
      onlineInverters: onlineInverters.length,
    };
  }

  async getInverters(): Promise<Inverter[]> {
    const now = new Date(this.simNow);
    const seed = daySeedOf(isoDate(now));
    const wx = weatherAt(now, seed);
    return this.buildInverters(now, wx.moduleTemp);
  }

  async getHistory(range: HistoryRange): Promise<HistoryRecord[]> {
    const days = eachDayIso(range.from, range.to);
    const records = days.map((iso) => this.recordForDay(iso));
    return aggregateRecords(records, range.unit);
  }

  async getPowerCurve(): Promise<PowerCurve> {
    const now = new Date(this.simNow);
    const totalPerf = this.avgPerf();
    const installed = this.installedKwp();
    const today: TelemetryPoint[] = [];
    const yesterday: TelemetryPoint[] = [];
    const yStart = new Date(now);
    yStart.setDate(yStart.getDate() - 1);
    for (let minutes = CURVE_START_HOUR * 60; minutes <= CURVE_END_HOUR * 60; minutes += CURVE_STEP_MIN) {
      const label = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      yesterday.push({ time: label, powerKw: this.samplePower(yStart, minutes, installed, totalPerf) });
      if (hourOfDay(now) * 60 >= minutes) {
        today.push({ time: label, powerKw: this.samplePower(now, minutes, installed, totalPerf) });
      }
    }
    return { today, yesterday };
  }

  async getAlarms(): Promise<Alarm[]> {
    return structuredClone(this.alarms);
  }

  async acknowledgeAlarm(id: string): Promise<void> {
    const alarm = this.alarms.find((a) => a.id === id);
    if (alarm) alarm.acked = true;
  }

  async acknowledgeAllAlarms(): Promise<void> {
    for (const a of this.alarms) a.acked = true;
  }

  async reconnectDevice(id: string): Promise<void> {
    this.deviceOverrides.set(id, "online");
    this.pushAlarm({
      template: ALARM_TEMPLATES[5] as AlarmTemplate,
      inverterId: id,
      overrideTitle: "Reconexión manual completada",
      overrideMessage: `Se ha solicitado reconexión manual de ${id}; el dispositivo vuelve a estar operativo.`,
      severityOverride: "info",
    });
  }

  private installedKwp(): number {
    return this.settings.installedKwp > 0 ? this.settings.installedKwp : DEFAULT_SETTINGS.installedKwp;
  }

  private avgPerf(): number {
    const values = [...this.perfByInverter.values()];
    if (values.length === 0) return 0.95;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }

  private capacityPerInverter(): number {
    return this.installedKwp() / INVERTER_DEFS.length;
  }

  private samplePower(anchor: Date, minutes: number, installed: number, totalPerf: number): number {
    const probe = new Date(anchor);
    probe.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    const wx = weatherAt(probe, daySeedOf(isoDate(probe)));
    return powerForIrradiance(installed, totalPerf, wx.irradiance, wx.moduleTemp);
  }

  private integrateToday(now: Date): { kwhToday: number; peakKw: number } {
    const w = solarWindow(now);
    const installed = this.installedKwp();
    const totalPerf = this.avgPerf();
    const startMinutes = Math.max(CURVE_START_HOUR * 60, Math.floor((w.rise - 0.5) * 60));
    const nowMinutes = hourOfDay(now) * 60;
    let kwhToday = 0;
    let peakKw = 0;
    for (let m = startMinutes; m <= nowMinutes; m += CURVE_STEP_MIN) {
      const p = this.samplePower(now, m, installed, totalPerf);
      kwhToday += p / (60 / CURVE_STEP_MIN);
      peakKw = Math.max(peakKw, p);
    }
    return { kwhToday, peakKw };
  }

  private dailyOfflineIndex(seed: number): number {
    const r = mulberry32(seed + 5)();
    return r < 0.38 ? Math.floor(mulberry32(seed + 9)() * INVERTER_DEFS.length) : -1;
  }

  private buildInverters(now: Date, moduleTemp: number): Inverter[] {
    const seed = daySeedOf(isoDate(now));
    const offlineIndex = this.dailyOfflineIndex(seed);
    const nightMode = weatherAt(now, seed).irradiance < 3;
    const minuteBucket = Math.floor(hourOfDay(now) * 12);
    return INVERTER_DEFS.map((def, invIdx) => {
      const override = this.deviceOverrides.get(def.id);
      let status: DeviceStatus;
      if (override) status = override;
      else if (invIdx === offlineIndex) status = "offline";
      else status = nightMode ? "standby" : "online";

      const perf = this.perfByInverter.get(def.id) ?? 0.95;
      const capacity = this.capacityPerInverter();
      const wx = weatherAt(now, seed);
      const powerKw =
        status === "online"
          ? powerForIrradiance(capacity, perf, wx.irradiance, wx.moduleTemp)
          : 0;

      const strings: StringTelemetry[] = Array.from({ length: STRINGS_PER_INVERTER }, (_, sIdx) => {
        const strRng = mulberry32(BASE_SEED + invIdx * 131 + sIdx * 17 + minuteBucket);
        const jitter = strRng();
        const nominalCurrent = (wx.irradiance / 1000) * (10.4 + strRng() * 2.4);
        const current = status === "online" ? nominalCurrent : 0;
        const voltage = status === "online" ? 640 + wx.irradiance * 0.14 : 0;
        const strStatus: StringTelemetry["status"] =
          status === "offline" ? "fault" : jitter < 0.05 && status === "online" ? "warning" : "ok";
        return {
          id: `${def.id}-S${sIdx + 1}`,
          inverterId: def.id,
          current,
          voltage,
          powerKw: (current * voltage) / 1000,
          status: strStatus,
        };
      });

      const dcVoltage = strings.reduce((s, st) => s + st.voltage, 0) / strings.length;
      const dcCurrent = strings.reduce((s, st) => s + st.current, 0);
      const lastSeenMs =
        status === "online" ? 5_000 : status === "standby" ? 45_000 : 300_000 + invIdx * 420_000;

      return {
        id: def.id,
        name: def.name,
        model: def.model,
        status,
        powerKw,
        efficiency: 97.4 + ((perf - 0.94) / 0.045) * 1.2,
        temperature: moduleTemp + 11 + mulberry32(BASE_SEED + invIdx)() * 6,
        dcVoltage,
        dcCurrent,
        acVoltage: status === "offline" ? 0 : 398 + mulberry32(minuteBucket + invIdx)() * 4,
        strings,
        lastSeen: new Date(now.getTime() - lastSeenMs),
      };
    });
  }

  private recordForDay(iso: string): HistoryRecord {
    const cached = this.historyCache.get(iso);
    if (cached) return cached;
    const sim = simulateDay(this.installedKwp(), this.avgPerf(), iso);
    const record: HistoryRecord = { date: iso, ...sim };
    this.historyCache.set(iso, record);
    return record;
  }

  private regenerateAlarms(): void {
    const defs = INVERTER_DEFS;
    this.alarms = [];
    for (let i = 0; i < 12; i++) {
      const template = ALARM_TEMPLATES[i % ALARM_TEMPLATES.length] as AlarmTemplate;
      const inv = defs[i % defs.length] as InverterDef;
      const ageMs = (i * 19 + 3) * 3_600_000 + mulberry32(i * 977)() * 5_400_000;
      this.pushAlarm({
        template,
        inverterId: inv.id,
        ageMs,
        acked: i > 4 || i === 2,
      });
    }
    this.alarms.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private pushEventAlarm(): void {
    const pool = [1, 2, 3] as const;
    const idx = pool[Math.floor(Math.random() * pool.length)] ?? 2;
    const template = ALARM_TEMPLATES[idx] as AlarmTemplate;
    const def = INVERTER_DEFS[Math.floor(Math.random() * INVERTER_DEFS.length)] as InverterDef;
    this.pushAlarm({ template, inverterId: def.id });
    this.alarms.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private pushAlarm(options: {
    template: AlarmTemplate;
    inverterId?: string;
    ageMs?: number;
    acked?: boolean;
    overrideTitle?: string;
    overrideMessage?: string;
    severityOverride?: Severity;
  }): void {
    const { template, inverterId, ageMs, acked } = options;
    const idNumber = this.alarms.length + 1;
    const id = `ALM-${String(Date.now() % 100000).padStart(5, "0")}-${idNumber}`;
    this.alarms.push({
      id,
      timestamp: new Date(this.simNow.getTime() - (ageMs ?? 0)),
      inverterId,
      code: template.code,
      severity: options.severityOverride ?? template.severity,
      title: options.overrideTitle ?? template.title,
      message: options.overrideMessage ?? template.message,
      acked: Boolean(acked),
      source: "demo",
    });
    if (this.alarms.length > 80) this.alarms.shift();
  }
}
