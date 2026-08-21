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

export class HuaweiProvider implements DataProvider {
  readonly id = "huawei";
  readonly label = "Huawei FusionSolar (vía backend)";

  constructor(private readonly config?: HuaweiProviderConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config?.endpoint);
  }

  private ensureReady(): void {
    if (!this.isConfigured()) {
      throw new Error("Proveedor real no configurado");
    }
  }

  private request<T>(): Promise<T> {
    this.ensureReady();
    return Promise.reject(new Error("Proveedor real no configurado"));
  }

  getLiveTelemetry(): Promise<LiveTelemetry> {
    return this.request<LiveTelemetry>();
  }

  getInverters(): Promise<Inverter[]> {
    return this.request<Inverter[]>();
  }

  getHistory(_range: HistoryRange): Promise<HistoryRecord[]> {
    return this.request<HistoryRecord[]>();
  }

  getPowerCurve(): Promise<PowerCurve> {
    return this.request<PowerCurve>();
  }

  getAlarms(): Promise<Alarm[]> {
    return this.request<Alarm[]>();
  }

  async acknowledgeAlarm(_id: string): Promise<void> {
    this.ensureReady();
  }

  async acknowledgeAllAlarms(): Promise<void> {
    this.ensureReady();
  }

  async reconnectDevice(_id: string): Promise<void> {
    this.ensureReady();
  }
}
