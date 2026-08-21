import type {
  Alarm,
  HistoryRange,
  HistoryRecord,
  Inverter,
  LiveTelemetry,
  PlantSettings,
  PowerCurve,
} from "../domain/types";

export interface DataProvider {
  readonly id: string;
  readonly label: string;
  getLiveTelemetry(): Promise<LiveTelemetry>;
  getInverters(): Promise<Inverter[]>;
  getHistory(range: HistoryRange): Promise<HistoryRecord[]>;
  getPowerCurve(): Promise<PowerCurve>;
  getAlarms(): Promise<Alarm[]>;
  acknowledgeAlarm(id: string): Promise<void>;
  acknowledgeAllAlarms(): Promise<void>;
  reconnectDevice(id: string): Promise<void>;
  applySettings?(settings: PlantSettings): void;
}

export interface SimulationControls {
  tick(deltaRealMs: number): void;
  setSpeed(multiplier: number): void;
  setPaused(paused: boolean): void;
  reset(): void;
}

export function asSimulationControls(provider: DataProvider): SimulationControls | null {
  if ("tick" in provider && typeof provider.tick === "function") {
    return provider as unknown as SimulationControls;
  }
  return null;
}
