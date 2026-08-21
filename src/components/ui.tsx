import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { AlertTriangle, Inbox, Loader2, RefreshCw, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DeviceStatus, StringStatus } from "../domain/types";
import type { Toast } from "../store";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

const TONE_BADGE: Record<Tone, string> = {
  neutral: "bg-slate-800 text-slate-300 ring-slate-700",
  info: "bg-sky-950 text-sky-300 ring-sky-800",
  success: "bg-emerald-950 text-emerald-300 ring-emerald-800",
  warning: "bg-amber-950 text-amber-300 ring-amber-800",
  danger: "bg-red-950 text-red-300 ring-red-800",
  brand: "bg-amber-500/15 text-amber-400 ring-amber-600/40",
};

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-800 bg-slate-900/70 shadow-sm backdrop-blur-sm ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-200">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <span
        className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg ring-1 ${TONE_BADGE[tone]}`}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-slate-100">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${TONE_BADGE[tone]}`}
    >
      {children}
    </span>
  );
}

const STATUS_DOT: Record<DeviceStatus | StringStatus, string> = {
  online: "bg-emerald-400",
  ok: "bg-emerald-400",
  offline: "bg-red-400",
  fault: "bg-red-400",
  standby: "bg-amber-400",
  warning: "bg-amber-400",
};

export function StatusDot({ status }: { status: DeviceStatus | StringStatus }) {
  return <span className={`inline-block size-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} />;
}

export const STATUS_LABELS: Record<DeviceStatus, string> = {
  online: "En línea",
  offline: "Desconectado",
  standby: "En espera",
};

type ButtonVariant = "primary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500",
  ghost:
    "bg-slate-800/60 text-slate-200 hover:bg-slate-700/70 disabled:text-slate-600 ring-1 ring-slate-700",
  danger: "bg-red-600/90 text-white hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 flex items-center gap-1 text-xs text-red-400">
          <AlertTriangle className="size-3" aria-hidden /> {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

const INPUT_CLASS =
  "w-full min-h-11 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

export function TextInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${INPUT_CLASS} ${className}`} />;
}

export function SelectInput({ className = "", ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...rest} className={`${INPUT_CLASS} ${className}`} />;
}

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`size-5 animate-spin text-amber-400 ${className}`} aria-label="Cargando" />;
}

export function LoadingPanel({ message = "Cargando datos…" }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-10 text-slate-400">
      <Spinner />
      <span className="text-sm">{message}</span>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-900/70 bg-red-950/40 p-4">
      <AlertTriangle className="size-5 shrink-0 text-red-400" aria-hidden />
      <p className="flex-1 text-sm font-medium text-red-200">{message}</p>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden /> Reintentar
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
}: {
  icon?: LucideIcon;
  title: string;
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
      <Icon className="size-8 text-slate-600" aria-hidden />
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {message && <p className="max-w-xs text-xs text-slate-500">{message}</p>}
    </div>
  );
}

const TOAST_TONE: Record<Toast["tone"], string> = {
  success: "border-emerald-800 bg-emerald-950/90 text-emerald-200",
  error: "border-red-800 bg-red-950/90 text-red-200",
  info: "border-slate-700 bg-slate-900/95 text-slate-200",
};

export function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-4 top-16 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:top-20">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg ${TOAST_TONE[t.tone]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
            aria-label="Cerrar aviso"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
