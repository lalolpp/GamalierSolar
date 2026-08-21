import type { PlantSettings } from "../domain/types";

export type SettingsErrors = Partial<Record<keyof PlantSettings, string>>;

export function validateSettings(s: PlantSettings): SettingsErrors {
  const errors: SettingsErrors = {};
  if (!s.plantName.trim()) errors.plantName = "El nombre es obligatorio";
  if (!s.location.trim()) errors.location = "La ubicación es obligatoria";
  if (!(Number.isFinite(s.installedKwp) && s.installedKwp > 0))
    errors.installedKwp = "La potencia instalada debe ser mayor que 0";
  if (!(Number.isFinite(s.priceKwh) && s.priceKwh >= 0))
    errors.priceKwh = "El precio no puede ser negativo";
  if (!(Number.isFinite(s.co2Factor) && s.co2Factor >= 0))
    errors.co2Factor = "El factor CO₂ no puede ser negativo";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.commissioned)) errors.commissioned = "Fecha inválida";
  return errors;
}

export function hasErrors(errors: SettingsErrors): boolean {
  return Object.values(errors).some(Boolean);
}
