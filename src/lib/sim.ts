const PEAK_IRRADIANCE = 1000;
const MS_PER_DAY = 86_400_000;

export interface SolarWindow {
  rise: number;
  set: number;
}

export interface WeatherSnapshot {
  irradiance: number;
  ambientTemp: number;
  moduleTemp: number;
  cloudFactor: number;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function daySeedOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return ((y ?? 2026) * 372 + (m ?? 1) * 31 + (d ?? 1)) >>> 0;
}

export function hourOfDay(d: Date): number {
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

export function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getFullYear(), 0, 1);
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - start) / MS_PER_DAY);
}

export function solarWindow(d: Date): SolarWindow {
  const shift = 0.7 * Math.cos(((dayOfYear(d) - 172) / 365) * 2 * Math.PI);
  return { rise: 7.6 - shift, set: 19.1 + shift };
}

export function daylightProgress(hour: number, w: SolarWindow): number {
  if (hour <= w.rise || hour >= w.set) return 0;
  return (hour - w.rise) / (w.set - w.rise);
}

export function seasonFactor(d: Date): number {
  return 0.82 + 0.18 * Math.sin(((dayOfYear(d) - 81) / 365) * 2 * Math.PI);
}

function cloudNoise(daySeed: number, minuteOfDay: number): number {
  const r1 = Math.sin((minuteOfDay / 53 + daySeed % 97) * 1.7);
  const r2 = Math.sin((minuteOfDay / 17 + (daySeed % 53) * 2.3) * 2.1);
  const r3 = Math.sin((minuteOfDay / 6.5 + (daySeed % 31) * 5.1) * 3.3);
  const raw = 0.66 + 0.24 * r1 + 0.12 * r2 + 0.06 * r3;
  return clamp(smoothstep((raw - 0.25) / 0.75) * 0.85 + 0.15, 0.18, 1);
}

export function weatherAt(d: Date, seed: number): WeatherSnapshot {
  const hour = hourOfDay(d);
  const w = solarWindow(d);
  const p = daylightProgress(hour, w);
  const bell = p <= 0 ? 0 : Math.pow(Math.sin(p * Math.PI), 1.35);
  const cloud = cloudNoise(seed, Math.floor(hour * 60));
  const irradiance = PEAK_IRRADIANCE * bell * seasonFactor(d) * cloud;
  const seasonalMean = 9 + 10 * seasonFactor(d);
  const ambientTemp =
    seasonalMean + 6 * Math.cos(((hour - 15) / 24) * 2 * Math.PI) - p * 1.5;
  const moduleTemp = ambientTemp + irradiance * 0.032;
  return { irradiance, ambientTemp, moduleTemp, cloudFactor: cloud };
}

export function powerForIrradiance(
  installedKwp: number,
  perf: number,
  irradiance: number,
  moduleTemp: number,
): number {
  if (installedKwp <= 0) return 0;
  const raw = installedKwp * (irradiance / PEAK_IRRADIANCE) * perf;
  const thermalLoss = 1 - clamp(moduleTemp - 25, 0, 40) * 0.004;
  return Math.max(0, raw * thermalLoss);
}

export function performanceRatio(
  powerKw: number,
  installedKwp: number,
  irradiance: number,
): number {
  if (irradiance < 5 || installedKwp <= 0) return 0;
  return clamp((powerKw / (installedKwp * (irradiance / PEAK_IRRADIANCE))) * 100, 0, 105);
}

export const MONTHLY_SUN_HOURS: readonly number[] = [
  3.2, 4.0, 5.1, 5.9, 6.7, 7.5, 7.9, 7.2, 5.8, 4.4, 3.3, 2.8,
];

export interface DaySimulation {
  energyKwh: number;
  averageKw: number;
  peakKw: number;
  pr: number;
  irradiance: number;
}

export function simulateDay(installedKwp: number, perf: number, iso: string): DaySimulation {
  const seed = daySeedOf(iso);
  const month = new Date(`${iso}T12:00:00`).getMonth();
  const sunHours = MONTHLY_SUN_HOURS[month] ?? 4.5;
  const rand = mulberry32(seed);
  const cloudAvg = 0.78 + rand() * 0.25;
  const degradation = 0.985 + mulberry32(seed + 77)() * 0.02;
  const energyKwh = installedKwp * sunHours * perf * cloudAvg * degradation;
  const peakKw = (energyKwh / sunHours) * 1.32;
  return {
    energyKwh,
    averageKw: energyKwh / 24,
    peakKw,
    pr: 80 + rand() * 8,
    irradiance: Math.round(sunHours * 185),
  };
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function yearKey(iso: string): string {
  return iso.slice(0, 4);
}

export function eachDayIso(fromIso: string, toIso: string, cap = 550): string[] {
  const out: string[] = [];
  let cur = fromIso;
  while (cur <= toIso && out.length < cap) {
    out.push(cur);
    cur = addDaysIso(cur, 1);
  }
  return out;
}
