import { Component, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import {
  Bell,
  Clock,
  Cpu,
  LayoutDashboard,
  Pause,
  Play,
  RefreshCw,
  Settings as SettingsIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, Button, Toaster } from "./components/ui";
import { Dashboard } from "./views/Dashboard";
import { History } from "./views/History";
import { Devices } from "./views/Devices";
import { Alarms } from "./views/Alarms";
import { Settings } from "./views/Settings";
import { useApp } from "./store";
import type { SpeedMultiplier } from "./domain/types";
import { formatClock, formatPower } from "./lib/format";

type ViewKey = "dashboard" | "history" | "devices" | "alarms" | "settings";

const TABS: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "history", label: "Historial", icon: Clock },
  { key: "devices", label: "Dispositivos", icon: Cpu },
  { key: "alarms", label: "Alarmas", icon: Bell },
  { key: "settings", label: "Ajustes", icon: SettingsIcon },
];

const SPEED_OPTIONS: SpeedMultiplier[] = [1, 60, 600];

export function App() {
  const [view, setView] = useState<ViewKey>("dashboard");
  const { state, demoEnabled } = useApp();
  const alarmCount = state.alarms.filter((a) => !a.acked).length;

  return (
    <div className="min-h-dvh text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <img
            src="/icons/icon-192.png"
            alt="Logo GamalierSolar"
            className="size-[90px] shrink-0 rounded-xl object-cover ring-1 ring-slate-700"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold leading-tight">{state.settings.plantName}</h1>
            <p className="truncate text-xs text-slate-500">{state.settings.location}</p>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {state.live && (
              <>
                <Badge tone="brand">{formatPower(state.live.powerKw)}</Badge>
                {demoEnabled && (
                  <Badge tone="neutral">
                    <Clock className="size-3" aria-hidden /> {formatClock(state.live.now)}
                  </Badge>
                )}
              </>
            )}
            {demoEnabled && <SimControls compact={false} />}
            <Badge tone={demoEnabled ? "info" : "success"}>{demoEnabled ? "DEMO" : "REAL"}</Badge>
          </div>

          <nav className="hidden items-center gap-1 lg:flex">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                aria-current={view === tab.key ? "page" : undefined}
                className={`flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  view === tab.key
                    ? "bg-slate-800 text-amber-400"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <tab.icon className="size-4" aria-hidden />
                {tab.label}
                {tab.key === "alarms" && alarmCount > 0 && (
                  <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                    {alarmCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center justify-between gap-2 overflow-x-auto px-4 pb-2 md:hidden">
          {state.live && (
            <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-slate-400">
              {formatPower(state.live.powerKw)}
              {demoEnabled && ` · ${formatClock(state.live.now)}`}
            </span>
          )}
          {demoEnabled && <SimControls compact />}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-4 lg:pb-8">
        {view === "dashboard" && <Dashboard />}
        {view === "history" && <History />}
        {view === "devices" && <Devices />}
        {view === "alarms" && <Alarms />}
        {view === "settings" && <Settings />}
      </main>

      <MobileNav current={view} onSelect={setView} alarmCount={alarmCount} />
      <ToastHost />
    </div>
  );
}

function SimControls({ compact }: { compact: boolean }) {
  const { state, setSpeed, togglePaused } = useApp();
  const sizeClass = compact ? "min-h-7 px-1.5" : "min-h-8 px-2";
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 p-1 ring-1 ring-slate-800">
      {SPEED_OPTIONS.map((mult) => (
        <button
          key={mult}
          onClick={() => setSpeed(mult)}
          aria-pressed={state.speed === mult}
          className={`rounded-md font-semibold transition-colors ${sizeClass} text-xs ${
            state.speed === mult ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          ×{mult}
        </button>
      ))}
      <button
        onClick={togglePaused}
        aria-label={state.paused ? "Reanudar simulación" : "Pausar simulación"}
        className={`grid place-items-center rounded-md text-slate-400 transition-colors hover:text-slate-200 ${compact ? "size-7" : "size-8"}`}
      >
        {state.paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
      </button>
    </span>
  );
}

function ToastHost() {
  const { state, dismissToast } = useApp();
  return <Toaster toasts={state.toasts} onDismiss={dismissToast} />;
}

function MobileNav({
  current,
  onSelect,
  alarmCount,
}: {
  current: ViewKey;
  onSelect: (v: ViewKey) => void;
  alarmCount: number;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            aria-current={current === tab.key ? "page" : undefined}
            className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              current === tab.key ? "text-amber-400" : "text-slate-500"
            }`}
          >
            <tab.icon className="size-5" aria-hidden />
            {tab.label}
            {tab.key === "alarms" && alarmCount > 0 && (
              <span className="absolute right-[18%] top-1.5 rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
                {alarmCount > 99 ? "99+" : alarmCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}

interface BoundaryProps {
  children: ReactNode;
}

export class ErrorBoundary extends Component<BoundaryProps, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Error de interfaz:", error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="grid min-h-dvh place-items-center p-6">
          <div className="max-w-md space-y-3 rounded-xl border border-red-900/70 bg-red-950/40 p-6 text-center">
            <RefreshCw className="mx-auto size-8 text-red-400" aria-hidden />
            <h1 className="text-lg font-semibold text-red-200">Se ha producido un error inesperado</h1>
            <p className="text-sm text-red-300/80">{this.state.error.message}</p>
            <Button onClick={() => window.location.reload()}>Recargar aplicación</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
