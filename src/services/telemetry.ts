import { getActiveProvider } from "../data";
import type { LiveTelemetry, PowerCurve } from "../domain/types";

export const telemetryService = {
  async getLive(): Promise<LiveTelemetry> {
    return getActiveProvider().getLiveTelemetry();
  },
  async getCurve(): Promise<PowerCurve> {
    return getActiveProvider().getPowerCurve();
  },
};
