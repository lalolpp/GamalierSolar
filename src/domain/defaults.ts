import type { HistoryRange, HistoryRangeUnit, PlantSettings, SpeedMultiplier } from "./types";
import { PLANT_PROFILE, TOTAL_PLANTED_KW } from "./plant";

export const DEFAULT_SETTINGS: PlantSettings = {
  plantName: PLANT_PROFILE.plantName,
  location: PLANT_PROFILE.country,
  installedKwp: TOTAL_PLANTED_KW,
  priceKwh: 120,
  co2Factor: 0.4,
  commissioned: "2024-06-01",
};

export const SPEED_OPTIONS: readonly SpeedMultiplier[] = [1, 60, 600];

export const HISTORY_WINDOW_DAYS = 45;
export const HISTORY_WINDOW_MONTHS = 18;
export const HISTORY_WINDOW_YEARS = 5;

export function rangeForUnit(unit: HistoryRangeUnit, anchor: Date): HistoryRange {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  if (unit === "year") {
    return {
      unit,
      from: `${y - HISTORY_WINDOW_YEARS + 1}-01-01`,
      to: `${y}-12-31`,
    };
  }
  if (unit === "month") {
    const start = new Date(y, m - (HISTORY_WINDOW_MONTHS - 1), 1);
    return {
      unit,
      from: isoOf(start),
      to: isoOf(new Date(y, m + 1, 0)),
    };
  }
  const start = new Date(y, m, d - (HISTORY_WINDOW_DAYS - 1));
  return { unit, from: isoOf(start), to: isoOf(new Date(y, m, d)) };
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
