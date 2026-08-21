export type DataMode = "demo" | "real";

interface AppConfig {
  dataMode: DataMode;
  appVersion: string;
}

function resolveDataMode(): DataMode {
  const raw = String(import.meta.env.VITE_DATA_MODE ?? "demo")
    .trim()
    .toLowerCase();
  return raw === "real" ? "real" : "demo";
}

export const CONFIG: AppConfig = {
  dataMode: resolveDataMode(),
  appVersion: String(import.meta.env.VITE_APP_VERSION ?? "1.1.0"),
};
