import { getActiveProvider } from "../data";
import type { Alarm } from "../domain/types";

export const alarmsService = {
  async list(): Promise<Alarm[]> {
    return getActiveProvider().getAlarms();
  },
  async acknowledge(id: string): Promise<void> {
    return getActiveProvider().acknowledgeAlarm(id);
  },
  async acknowledgeAll(): Promise<void> {
    return getActiveProvider().acknowledgeAllAlarms();
  },
};
