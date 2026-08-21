const nf = (min: number, max: number): Intl.NumberFormat =>
  new Intl.NumberFormat("es-ES", { minimumFractionDigits: min, maximumFractionDigits: max });

export function formatNumber(value: number, decimals = 1): string {
  return nf(decimals, decimals).format(value);
}

export function formatInteger(value: number): string {
  return nf(0, 0).format(Math.round(value));
}

export function formatEur(value: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${nf(decimals, decimals).format(value)} %`;
}

export function formatPower(kw: number): string {
  const abs = Math.abs(kw);
  if (abs < 1) return `${formatNumber(kw * 1000, 0)} W`;
  if (abs >= 1000) return `${formatNumber(kw / 1000, 2)} MW`;
  return `${formatNumber(kw, 1)} kW`;
}

export function formatEnergy(kwh: number): string {
  const abs = Math.abs(kwh);
  if (abs >= 1000) return `${formatNumber(kwh / 1000, 2)} MWh`;
  return `${formatNumber(kwh, 1)} kWh`;
}

export function formatCo2(kg: number): string {
  if (Math.abs(kg) >= 1000) return `${formatNumber(kg / 1000, 2)} t`;
  return `${formatNumber(kg, 1)} kg`;
}

export function formatDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export function formatMonthKey(key: string): string {
  const [y, m] = key.split("-");
  if (!y || !m) return key;
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("es-ES", { month: "short", year: "numeric" });
}

export function formatClock(d: Date): string {
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDateTime(d: Date): string {
  return d.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeSeconds(seconds: number): string {
  if (seconds < 5) return "ahora mismo";
  if (seconds < 60) return `hace ${Math.floor(seconds)} s`;
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h`;
  return `hace ${Math.floor(seconds / 86400)} d`;
}
