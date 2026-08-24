import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type {
  Alarm,
  HistoryRange,
  HistoryRangeUnit,
  HistoryRecord,
  Inverter,
  LiveTelemetry,
  PlantSettings,
  PowerCurvePoint,
  ProviderStatus,
  SpeedMultiplier,
  TelemetryPoint,
} from "./domain/types";
import { DEFAULT_SETTINGS, rangeForUnit } from "./domain/defaults";
import { readStorage, writeStorage } from "./lib/storage";
import { CONFIG } from "./lib/config";
import {
  asSimulationControls,
  getActiveProvider,
  getProviderStatus,
  isDemoActive,
} from "./data";
import type { SimulationControls } from "./data";
import { telemetryService } from "./services/telemetry";
import { historyService } from "./services/history";
import { devicesService } from "./services/devices";
import { alarmsService } from "./services/alarms";
import { hasErrors, validateSettings, type SettingsErrors } from "./lib/validation";

export interface Toast {
  id: number;
  tone: "success" | "error" | "info";
  message: string;
}

interface SavedSimState {
  nowIso?: string;
  speed?: number;
  paused?: boolean;
}

interface AppState {
  settings: PlantSettings;
  live: LiveTelemetry | null;
  curveToday: TelemetryPoint[];
  curveYesterday: TelemetryPoint[];
  inverters: Inverter[];
  alarms: Alarm[];
  history: HistoryRecord[];
  historyLoading: boolean;
  loading: boolean;
  error: string | null;
  speed: SpeedMultiplier;
  paused: boolean;
  toasts: Toast[];
  lastUpdated: Date | null;
}

type Action =
  | { type: "settings"; settings: PlantSettings }
  | { type: "loaded"; live: LiveTelemetry; inverters: Inverter[]; curveToday: TelemetryPoint[]; curveYesterday: TelemetryPoint[] }
  | { type: "live"; live: LiveTelemetry; curveToday?: TelemetryPoint[] }
  | { type: "inverters"; inverters: Inverter[] }
  | { type: "alarms"; alarms: Alarm[] }
  | { type: "historyLoading" }
  | { type: "history"; records: HistoryRecord[] }
  | { type: "error"; message: string | null }
  | { type: "speed"; speed: SpeedMultiplier }
  | { type: "paused"; paused: boolean }
  | { type: "toastAdd"; toast: Toast }
  | { type: "toastRemove"; id: number }
  | { type: "updatedAt"; at: Date };

function initialSpeed(): SpeedMultiplier {
  const saved = readStorage<SavedSimState>("sim", {});
  return saved.speed === 60 || saved.speed === 600 ? saved.speed : 1;
}

function initialPaused(): boolean {
  return Boolean(readStorage<SavedSimState>("sim", {}).paused);
}

interface LastGoodState {
  live: LiveTelemetry;
  inverters: Inverter[];
  curveToday: TelemetryPoint[];
}

const lastGood = readStorage<LastGoodState | null>("lastgood", null);

const initialState: AppState = {
  settings: readStorage<PlantSettings>("settings", DEFAULT_SETTINGS),
  live: lastGood?.live ?? null,
  curveToday: lastGood?.curveToday ?? [],
  curveYesterday: [],
  inverters: lastGood?.inverters ?? [],
  alarms: [],
  history: [],
  historyLoading: true,
  loading: true,
  error: null,
  speed: initialSpeed(),
  paused: initialPaused(),
  toasts: [],
  lastUpdated: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "settings":
      return { ...state, settings: action.settings };
    case "loaded":
      return {
        ...state,
        live: action.live,
        inverters: action.inverters,
        curveToday: action.curveToday,
        curveYesterday: action.curveYesterday,
        loading: false,
        error: null,
      };
    case "live":
      return {
        ...state,
        live: action.live,
        curveToday: action.curveToday ?? state.curveToday,
      };
    case "inverters":
      return { ...state, inverters: action.inverters };
    case "alarms":
      return { ...state, alarms: action.alarms };
    case "historyLoading":
      return { ...state, historyLoading: true };
    case "history":
      return { ...state, history: action.records, historyLoading: false };
    case "error":
      return { ...state, error: action.message };
    case "speed":
      return { ...state, speed: action.speed };
    case "paused":
      return { ...state, paused: action.paused };
    case "toastAdd":
      return { ...state, toasts: [...state.toasts.slice(-3), action.toast] };
    case "toastRemove":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case "updatedAt":
      return { ...state, lastUpdated: action.at };
    default:
      return state;
  }
}

export function mergeCurve(
  today: TelemetryPoint[],
  yesterday: TelemetryPoint[],
): PowerCurvePoint[] {
  const len = Math.max(today.length, yesterday.length);
  const out: PowerCurvePoint[] = [];
  for (let i = 0; i < len; i++) {
    const t = today[i];
    const y = yesterday[i];
    if (!t && !y) continue;
    out.push({
      time: (t ?? y).time,
      today: t ? t.powerKw : 0,
      yesterday: y ? y.powerKw : 0,
    });
  }
  return out;
}

interface StoreValue {
  state: AppState;
  providerLabel: string;
  providerStatus: ProviderStatus;
  demoEnabled: boolean;
  appVersion: string;
  saveSettings(draft: PlantSettings): { ok: boolean; errors: SettingsErrors };
  setSpeed(speed: SpeedMultiplier): void;
  togglePaused(): void;
  setHistoryUnit(unit: HistoryRangeUnit): void;
  acknowledgeAlarm(id: string): Promise<void>;
  acknowledgeAllAlarms(): Promise<void>;
  reconnectDevice(id: string): Promise<void>;
  resetDemo(): void;
  retry(): void;
  refresh(): Promise<void>;
  refreshing: boolean;
  dismissToast(id: number): void;
  pushToast(message: string, tone?: Toast["tone"]): void;
}

const StoreContext = createContext<StoreValue | null>(null);

const SIM_TICK_MS = 1000;
const DATA_REFRESH_MS = 60_000;
const DATA_REFRESH_FAST_MS = 3_000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const provider = getActiveProvider();
  const controls: SimulationControls | null = useMemo(() => asSimulationControls(provider), [provider]);
  const providerStatus = useMemo(() => getProviderStatus(), []);
  const demoEnabled = useMemo(() => isDemoActive(), []);

  const lastTs = useRef<number>(Date.now());
  const rangeRef = useRef<HistoryRange>(rangeForUnit("day", new Date()));

  const pushToast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    dispatch({ type: "toastAdd", toast: { id, tone, message } });
    window.setTimeout(() => dispatch({ type: "toastRemove", id }), 3600);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [live, curve, inverters, alarms] = await Promise.all([
        telemetryService.getLive(),
        telemetryService.getCurve(),
        devicesService.list(),
        alarmsService.list(),
      ]);
      dispatch({ type: "loaded", live, inverters, curveToday: curve.today, curveYesterday: curve.yesterday });
      writeStorage("lastgood", { live, inverters, curveToday: curve.today });
      dispatch({ type: "alarms", alarms });
      dispatch({ type: "updatedAt", at: new Date(live.now) });
      dispatch({ type: "error", message: null });
    } catch {
      dispatch({ type: "error", message: "Error al obtener datos" });
    }
  }, []);

  const loadHistory = useCallback(async (range: HistoryRange) => {
    try {
      const records = await historyService.get(range);
      dispatch({ type: "history", records });
    } catch {
      dispatch({ type: "history", records: [] });
      dispatch({ type: "error", message: "Error al obtener datos" });
    }
  }, []);

  useEffect(() => {
    provider.applySettings?.(initialState.settings);
    rangeRef.current = rangeForUnit("day", new Date());
    void loadHistory(rangeRef.current);
    void loadAll();
  }, [provider, loadAll, loadHistory]);

  useEffect(() => {
    if (!controls) return undefined;
    const interval = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTs.current;
      lastTs.current = now;
      controls.tick(elapsed);
      void telemetryService
        .getLive()
        .then((live) => {
          dispatch({ type: "live", live });
          dispatch({ type: "updatedAt", at: new Date(live.now) });
        })
        .catch(() => undefined);
    }, SIM_TICK_MS);
    return () => window.clearInterval(interval);
  }, [controls]);

  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await loadAll();
      await loadHistory(rangeRef.current);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [loadAll, loadHistory]);

  useEffect(() => {
    const ms = demoEnabled && state.speed > 1 ? DATA_REFRESH_FAST_MS : DATA_REFRESH_MS;
    const interval = window.setInterval(() => {
      void refresh();
    }, ms);
    return () => window.clearInterval(interval);
  }, [demoEnabled, state.speed, refresh]);

  useEffect(() => {
    writeStorage<PlantSettings>("settings", state.settings);
  }, [state.settings]);

  useEffect(() => {
    writeStorage("sim", { speed: state.speed, paused: state.paused });
  }, [state.speed, state.paused]);

  useEffect(() => {
    const persist = window.setInterval(() => {
      if (state.live) {
        writeStorage("sim", {
          nowIso: state.live.now.toISOString(),
          speed: state.speed,
          paused: state.paused,
        });
      }
    }, 20_000);
    return () => window.clearInterval(persist);
  }, [state.live, state.speed, state.paused]);

  const saveSettings = useCallback(
    (draft: PlantSettings): { ok: boolean; errors: SettingsErrors } => {
      const errors = validateSettings(draft);
      if (hasErrors(errors)) return { ok: false, errors };
      dispatch({ type: "settings", settings: draft });
      provider.applySettings?.(draft);
      pushToast("Ajustes guardados", "success");
      return { ok: true, errors: {} };
    },
    [provider, pushToast],
  );

  const setSpeed = useCallback(
    (speed: SpeedMultiplier) => {
      controls?.setSpeed(speed);
      dispatch({ type: "speed", speed });
    },
    [controls],
  );

  const togglePaused = useCallback(() => {
    if (!controls) return;
    const next = !state.paused;
    controls.setPaused(next);
    dispatch({ type: "paused", paused: next });
  }, [controls, state.paused]);

  const setHistoryUnit = useCallback(
    (unit: HistoryRangeUnit) => {
      const anchor = state.live?.now ?? new Date();
      const range = rangeForUnit(unit, anchor);
      rangeRef.current = range;
      void loadHistory(range);
    },
    [state.live, loadHistory],
  );

  const acknowledgeAlarm = useCallback(
    async (id: string) => {
      await alarmsService.acknowledge(id);
      dispatch({ type: "alarms", alarms: await alarmsService.list() });
      pushToast("Alarma reconocida", "success");
    },
    [pushToast],
  );

  const acknowledgeAllAlarms = useCallback(async () => {
    await alarmsService.acknowledgeAll();
    dispatch({ type: "alarms", alarms: await alarmsService.list() });
    pushToast("Todas las alarmas reconocidas", "success");
  }, [pushToast]);

  const reconnectDevice = useCallback(
    async (id: string) => {
      await devicesService.reconnect(id);
      dispatch({ type: "inverters", inverters: await devicesService.list() });
      pushToast(`Reconexión enviada a ${id}`, "info");
    },
    [pushToast],
  );

  const resetDemo = useCallback(() => {
    controls?.reset();
    setSpeed(1);
    dispatch({ type: "paused", paused: false });
    writeStorage("sim", { speed: 1, paused: false });
    void loadAll().then(() => loadHistory(rangeRef.current));
    pushToast("Modo demo reiniciado", "info");
  }, [controls, setSpeed, loadAll, loadHistory, pushToast]);

  const retry = useCallback(() => {
    dispatch({ type: "error", message: null });
    void loadAll().then(() => loadHistory(rangeRef.current));
  }, [loadAll, loadHistory]);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      providerLabel: provider.label,
      providerStatus,
      demoEnabled,
      appVersion: CONFIG.appVersion,
      saveSettings,
      setSpeed,
      togglePaused,
      setHistoryUnit,
      acknowledgeAlarm,
      acknowledgeAllAlarms,
      reconnectDevice,
      resetDemo,
      retry,
      refresh,
      refreshing,
      dismissToast: (id: number) => dispatch({ type: "toastRemove", id }),
      pushToast,
    }),
    [
      state,
      provider.label,
      providerStatus,
      demoEnabled,
      saveSettings,
      setSpeed,
      togglePaused,
      setHistoryUnit,
      acknowledgeAlarm,
      acknowledgeAllAlarms,
      reconnectDevice,
      resetDemo,
      retry,
      refresh,
      refreshing,
      pushToast,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useApp(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useApp debe usarse dentro de StoreProvider");
  return ctx;
}
