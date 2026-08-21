export type DeviceStatus = "online" | "offline" | "standby";
export type StringStatus = "ok" | "warning" | "fault";
export type Severity = "info" | "warning" | "critical";
export type AlarmSource = "demo" | "api";
export type HistoryRangeUnit = "day" | "month" | "year";

export interface HistoryRange {
  unit: HistoryRangeUnit;
  from: string;
  to: string;
}

export interface PlantSettings {
  plantName: string;
  location: string;
  installedKwp: number;
  priceKwh: number;
  co2Factor: number;
  commissioned: string;
}

export interface LiveTelemetry {
  now: Date;
  powerKw: number;
  kwhToday: number;
  irradiance: number;
  moduleTemp: number;
  ambientTemp: number;
  pr: number;
  peakKw: number;
  inverterCount: number;
  onlineInverters: number;
}

export interface StringTelemetry {
  id: string;
  inverterId: string;
  current: number;
  voltage: number;
  powerKw: number;
  status: StringStatus;
}

export interface Inverter {
  id: string;
  name: string;
  model?: string;
  status: DeviceStatus;
  powerKw: number;
  efficiency: number;
  temperature: number;
  dcVoltage?: number;
  dcCurrent?: number;
  acVoltage?: number;
  strings: StringTelemetry[];
  lastSeen?: Date;
}

export interface HistoryRecord {
  date: string;
  energyKwh: number;
  averageKw: number;
  peakKw: number;
  pr: number;
  irradiance?: number;
}

export interface Alarm {
  id: string;
  timestamp: Date;
  inverterId?: string;
  code?: string;
  severity: Severity;
  title: string;
  message: string;
  acked: boolean;
  source: AlarmSource;
}

export interface TelemetryPoint {
  time: string;
  powerKw: number;
}

export interface PowerCurve {
  today: TelemetryPoint[];
  yesterday: TelemetryPoint[];
}

export interface PowerCurvePoint {
  time: string;
  today: number;
  yesterday: number;
}

export interface InverterProductionPoint {
  name: string;
  kwh: number;
}

export type ProviderStatus = "demo" | "real" | "real-unconfigured";

export type SpeedMultiplier = 1 | 60 | 600;
