import { getActiveProvider } from "../data";
import type { Inverter } from "../domain/types";

export const devicesService = {
  async list(): Promise<Inverter[]> {
    return getActiveProvider().getInverters();
  },
  async reconnect(id: string): Promise<void> {
    return getActiveProvider().reconnectDevice(id);
  },
};
