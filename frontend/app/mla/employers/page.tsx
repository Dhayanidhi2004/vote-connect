"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { EmptyState, PageHeader, VerifiedBadge, cx } from "@/components/ui";
import { Skeleton } from "@/components/skeleton";
import {
  IconBriefcase,
  IconFilter,
  IconTrendingUp,
  IconUsers,
} from "@/components/icons";
import { api } from "@/lib/api";
import type { CompanyHireRow } from "@/lib/types";

const nf = new Intl.NumberFormat("en-IN");

const STATUS_OPTIONS = ["all", "verified", "pending", "unverified"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

function statusOf(s: string): "verified" | "pending" | "unverified" {
  return s === "verified" || s === "pending" ? s : "unverified";
}

function StatChip({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent: "blue" | "green" | "orange";
}) {
  const tint = {
    blue: "bg-brand-blueTint text-brand-blue",
    green: "bg-brand-greenTint text-brand-greenDark",
    orange: "bg-brand-orangeTint text-brand-orange",
  }[accent];
  return (
    <div className="card flex items-center gap-3 px-4 py-3">
      <span
        className={cx(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          tint,
        )}
      >
        {icon}
      </span>
      <div>
        <div className="tnum text-lg font-bold leading-none text-ink">
          {value}
        </div>
        <div className="text-xs text-muted">{label}</div>
      </div>
    </div>
  );
}

export default function EmployersPage() {
  const [rows, setRows] = useState<CompanyHireRow[] | null>(null);
  const [industry, setIndustry] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  // Industry options are derived once from the unfiltered dataset.
  const [industryOptions, setIndustryOptions] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    setRows(null);
    const params = new URLSearchParams();
    if (industry) params.set("industry", industry);
    if (status !== "all") params.set("verification_status", status);
    const qs = params.toString();
    api
      .get<CompanyHireRow[]>(`/api/admin/employers${qs ? `?${qs}` : ""}`)
      .then((d) => {
        if (!alive) return;
        setRows(d);
        // Seed industry options from the first (unfiltered) load.
        setIndustryOptions((prev) => {
          if (prev.length || industry || status !== "all") return prev;
          return Array.from(
            new Set(
              d
                .map((r) => r.industry)
                .filter((x): x is string => Boolean(x)),
            ),
          ).sort();
        });
      })
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [industry, status]);

  const totals = useMemo(() => {
    const list = rows ?? [];
    return {
      count: list.length,
      hired: list.reduce((a, r) => a + r.hired, 0),
      jobs: list.reduce((a, r) => a + r.active_jobs, 0),
    };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Employers"
        subtitle="Hiring activity across employers in your constituency."
      />

      {/* Summary strip */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatChip
          label="Employers"
          value={nf.format(totals.count)}
          icon={<IconBriefcase width={18} height={18} />}
          accent="blue"
        />
        <StatChip
          label="Total hired"
          value={nf.format(totals.hired)}
          icon={<IconTrendingUp width={18} height={18} />}
          accent="green"
        />
        <StatChip
          label="Active jobs"
          value={nf.format(totals.jobs)}
          icon={<IconUsers width={18} height={18} />}
          accent="orange"
        />
      </div>

      {/* Filter bar */}
      <div className="card mb-5 flex flex-wrap items-end gap-4 p-4">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-muted">
          <IconFilter width={16} height={16} />
          Filters
        </span>
        <div className="flex flex-col gap-1">
          <label htmlFor="industry" className="label">
            Industry
          </label>
          <select
            id="industry"
            className="input py-2"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          >
            <option value="">All industries</option>
            {industryOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="label">
            Verification status
          </label>
          <select
            id="status"
            className="input py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o === "all" ? "All statuses" : o[0].toUpperCase() + o.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {rows === null ? (
        <div className="card overflow-hidden p-0">
          <div className="divide-y divide-line">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<IconBriefcase />}
          title="No employers found"
          body="Try clearing the filters to see all employers."
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="grid-table">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    Industry
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    Active jobs
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    Applications
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    Hired
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.org_id} className="hover:bg-canvas/60">
                    <td className="px-4 py-3 text-sm font-semibold text-ink">
                      {r.company}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink">
                      {r.industry ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <VerifiedBadge status={statusOf(r.verification_status)} />
                    </td>
                    <td className="tnum px-4 py-3 text-right text-sm text-ink">
                      {nf.format(r.active_jobs)}
                    </td>
                    <td className="tnum px-4 py-3 text-right text-sm text-ink">
                      {nf.format(r.applications)}
                    </td>
                    <td className="tnum px-4 py-3 text-right text-sm font-semibold text-ink">
                      {nf.format(r.hired)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
