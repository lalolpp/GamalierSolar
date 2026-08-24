import { PLANT_PROFILE } from "../domain/plant";
import type {
  Alarm,
  HistoryRange,
  HistoryRecord,
  Inverter,
  LiveTelemetry,
  PowerCurve,
} from "../domain/types";
import type { DataProvider } from "./DataProvider";

export interface HuaweiProviderConfig {
  endpoint: string;
}

interface SnapshotResponse {
  now: string;
  status: "online" | "offline";
  powerKw: number;
  peakKw: number;
  kwhToday: number;
  kwhMonth: number;
  kwhYear: number;
  kwhTotal: number;
  curve: { time: string; powerKw: number }[];
}

interface InvertersResponse {
  inverters: { dn: string; name?: string; powerKw: number; statusCode: number | null }[];
}

async function getJson<T>(base: string, path: string): Promise<T> {
  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Backend HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export class HuaweiProvider implements DataProvider {
  readonly id = "huawei";
  readonly label = "Huawei FusionSolar (datos reales)";

  constructor(private readonly config?: HuaweiProviderConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config?.endpoint);
  }

  private base(): string {
    if (!this.config?.endpoint) throw new Error("Proveedor real no configurado");
    return this.config.endpoint;
  }

  private async snapshot(): Promise<SnapshotResponse> {
    return getJson<SnapshotResponse>(this.base(), "/api/snapshot");
  }

  async getLiveTelemetry(): Promise<LiveTelemetry> {
    const [s, inv] = await Promise.all([
      this.snapshot(),
      getJson<InvertersResponse>(this.base(), "/api/inverters").catch(() => null),
    ]);
    const total = PLANT_PROFILE.devices.length;
    const online = inv ? inv.inverters.filter((i) => i.statusCode === 1).length : 0;
    return {
      now: new Date(s.now),
      powerKw: s.powerKw,
      kwhToday: s.kwhToday,
      irradiance: 0,
      moduleTemp: 0,
      ambientTemp: 0,
      pr: 0,
      peakKw: Math.max(s.peakKw, s.powerKw),
      inverterCount: total,
      onlineInverters: Math.max(online, s.status === "online" ? 1 : 0),
    };
  }

  async getPowerCurve(): Promise<PowerCurve> {
    const s = await this.snapshot();
    const today = s.curve.map((p) => ({ time: p.time, powerKw: p.powerKw }));
    const last = today.at(-1);
    if (last && s.powerKw > last.powerKw) today.push({ time: s.now, powerKw: s.powerKw });
    return { today, yesterday: [] };
  }

  async getInverters(): Promise<Inverter[]> {
    try {
      const r = await getJson<InvertersResponse>(this.base(), "/api/inverters");
      if (!r.inverters.length) return [];
      return PLANT_PROFILE.devices.map((dev, i) => {
        const raw = r.inverters[i];
        const online = Boolean(raw && raw.statusCode === 1);
        return {
          id: dev.id,
          name: dev.name,
          model: raw?.name ?? dev.serialNumber,
          status: online ? "online" : "offline",
          powerKw: raw ? raw.powerKw : 0,
          efficiency: 0,
          temperature: 0,
          strings: [],
          lastSeen: undefined,
        } satisfies Inverter;
      });
    } catch {
      return [];
    }
  }

  async getHistory(range: HistoryRange): Promise<HistoryRecord[]> {
    const r = await getJson<{ records: HistoryRecord[] }>(
      this.base(),
      `/api/history?unit=${encodeURIComponent(range.unit)}`,
    );
    return r.records;
  }

  async getAlarms(): Promise<Alarm[]> {
    return [];
  }

  async acknowledgeAlarm(): Promise<void> {}
  async acknowledgeAllAlarms(): Promise<void> {}
  async reconnectDevice(): Promise<void> {}
}
