import { readStorage } from "../lib/storage";
import { CONFIG } from "../lib/config";
import type { ProviderStatus } from "../domain/types";
import { DemoProvider, type SavedDemoState } from "./demoProvider";
import { HuaweiProvider } from "./huaweiProvider";
import type { DataProvider } from "./DataProvider";

export type { DataProvider, SimulationControls } from "./DataProvider";
export { asSimulationControls } from "./DataProvider";
export type { ProviderStatus } from "../domain/types";

let demoSingleton: DemoProvider | null = null;
let resolved: { provider: DataProvider; status: ProviderStatus } | null = null;

function getDemo(): DemoProvider {
  if (!demoSingleton) {
    const saved = readStorage<SavedDemoState>("sim", {});
    demoSingleton = new DemoProvider(saved);
  }
  return demoSingleton;
}

function resolveProvider(): { provider: DataProvider; status: ProviderStatus } {
  if (CONFIG.dataMode === "real") {
    const endpoint = import.meta.env.VITE_HUAWEI_ENDPOINT;
    const huawei = new HuaweiProvider(endpoint ? { endpoint } : undefined);
    if (huawei.isConfigured()) {
      return { provider: huawei, status: "real" };
    }
    return { provider: getDemo(), status: "real-unconfigured" };
  }
  return { provider: getDemo(), status: "demo" };
}

export function getActiveProvider(): DataProvider {
  if (!resolved) resolved = resolveProvider();
  return resolved.provider;
}

export function getProviderStatus(): ProviderStatus {
  if (!resolved) resolved = resolveProvider();
  return resolved.status;
}

export function isDemoActive(): boolean {
  const provider = getActiveProvider();
  return provider instanceof DemoProvider;
}
