"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NameValue } from "@/lib/types";

// Harmonious enterprise palette — cohesive medium-saturation hues.
const SERIES = ["#0B6BCB", "#0E8C7F", "#6B4EE6", "#1F9254", "#C98A00", "#C0392B"];
const ACCENT = "#0B6BCB";
const GRID = "#E3E8EF";

const tip = {
  contentStyle: {
    borderRadius: 10,
    border: "1px solid #E3E8EF",
    boxShadow: "0 8px 24px rgba(16,24,40,0.10)",
    fontSize: 12,
  },
};

export function DonutChart({
  data,
  height = 200,
  colors = SERIES,
}: {
  data: NameValue[];
  height?: number;
  colors?: string[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div style={{ height }} className="flex items-center gap-5">
      <ResponsiveContainer width="48%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={1.5}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip {...tip} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 space-y-2">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: colors[i % colors.length] }}
            />
            <span className="text-ink">{d.name}</span>
            <span className="tnum ml-auto font-medium text-ink">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VBarChart({
  data,
  height = 210,
  color = ACCENT,
}: {
  data: NameValue[];
  height?: number;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}>
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={{ stroke: GRID }}
          fontSize={11}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={11}
          width={38}
        />
        <Tooltip {...tip} cursor={{ fill: "rgba(48,88,124,0.05)" }} />
        <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} maxBarSize={30} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HBarChart({
  data,
  height = 200,
  highlightName,
  colors = SERIES,
}: {
  data: NameValue[];
  height?: number;
  highlightName?: string;
  colors?: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={130}
          fontSize={12}
        />
        <Tooltip {...tip} cursor={{ fill: "rgba(48,88,124,0.05)" }} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={18}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={
                highlightName && d.name === highlightName
                  ? "#22303F"
                  : colors[i % colors.length]
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MiniPie({
  data,
  colors = SERIES,
  height = 150,
}: {
  data: NameValue[];
  colors?: string[];
  height?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="flex items-center gap-4" style={{ height }}>
      <ResponsiveContainer width="46%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius="92%" stroke="none">
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip {...tip} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: colors[i % colors.length] }}
            />
            {d.name}
            <span className="tnum ml-auto font-medium text-ink">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
