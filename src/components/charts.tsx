import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { InverterProductionPoint, PowerCurvePoint } from "../domain/types";
import { formatNumber } from "../lib/format";

const AXIS_STYLE = { fontSize: 11, fill: "#64748b" } as const;
const TOOLTIP_STYLE = {
  backgroundColor: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "0.5rem",
  fontSize: "12px",
  color: "#e2e8f0",
} as const;

export function ChartFrame({ children }: { children: React.ReactElement }) {
  return <div className="h-64 w-full sm:h-72">{children}</div>;
}

function kwFormatter(value: number | string): string {
  return `${formatNumber(Number(value), 1)} kW`;
}

export function PowerCurveChart({ data }: { data: PowerCurvePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500 sm:h-72">
        Sin datos de curva todavía
      </div>
    );
  }
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradToday" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: "#334155" }} minTickGap={32} />
          <YAxis
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => formatNumber(v, 0)}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => kwFormatter(Number(value))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="yesterday"
            name="Ayer"
            stroke="#64748b"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            fill="transparent"
          />
          <Area
            type="monotone"
            dataKey="today"
            name="Hoy"
            stroke="#f59e0b"
            strokeWidth={2}
            fill="url(#gradToday)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function InverterProductionChart({ data }: { data: InverterProductionPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-500">Sin datos</div>
    );
  }
  return (
    <div className="h-56 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ ...AXIS_STYLE, fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#334155" }}
          />
          <YAxis
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => formatNumber(v, 0)}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "#1e293b55" }}
            formatter={(value) => [`${formatNumber(Number(value), 1)} kWh`, "Energía"]}
          />
          <Bar dataKey="kwh" name="Energía hoy" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
