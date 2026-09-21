"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  DonutChart,
  HBarChart,
  MiniPie,
  VBarChart,
} from "@/components/charts";
import { ScoreGauge } from "@/components/gauge";
import {
  EmptyState,
  IconTile,
  PageHeader,
  SectionBadge,
  Spinner,
  StatTile,
  cx,
} from "@/components/ui";
import {
  IconArrowRight,
  IconBriefcase,
  IconChart,
  IconGradCap,
  IconIdCard,
  IconTarget,
  IconTrendingUp,
  IconUserCheck,
  IconUsers,
} from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import type { Accent } from "@/components/ui";
import type {
  CompanyHireRow,
  MlaDashboard,
  PlacementRow,
} from "@/lib/types";

const nf = new Intl.NumberFormat("en-IN");

function PanelHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-3">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"
      >
        View more <IconArrowRight width={13} height={13} />
      </Link>
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, string> = {
    joined: "bg-brand-greenTint text-brand-greenDark",
    selected: "bg-brand-blueTint text-brand-blue",
  };
  return (
    <span
      className={cx(
        "inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
        map[stage] ?? "bg-canvas text-muted",
      )}
    >
      {stage}
    </span>
  );
}

function SectionTitle({ title }: { n?: number; title: string }) {
  return (
    <div className="mb-4">
      <h2 className="section-title text-lg sm:text-xl">{title}</h2>
    </div>
  );
}

function PipelineStep({
  value,
  label,
  icon,
  accent,
}: {
  value: number;
  label: string;
  icon: ReactNode;
  accent: Accent;
}) {
  return (
    <div className="flex w-24 flex-col items-center gap-2 text-center">
      <IconTile icon={icon} accent={accent} size="lg" />
      <div className="tnum text-xl font-bold leading-none text-navy-800">
        {nf.format(value)}
      </div>
      <span className="text-xs font-semibold uppercase leading-tight text-navy-700">
        {label}
      </span>
    </div>
  );
}

export default function MlaDashboardPage() {
  const [data, setData] = useState<MlaDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [placements, setPlacements] = useState<PlacementRow[]>([]);
  const [employers, setEmployers] = useState<CompanyHireRow[]>([]);
  const [pending, setPending] = useState({ companies: 0, courses: 0, youth: 0 });

  useEffect(() => {
    let alive = true;
    api
      .get<MlaDashboard>("/api/admin/dashboard")
      .then((d) => alive && setData(d))
      .catch(
        (e) =>
          alive &&
          setError(e instanceof ApiError ? e.message : "Failed to load dashboard"),
      )
      .finally(() => alive && setLoading(false));

    // Preview data for the overview tables (non-blocking).
    api.get<PlacementRow[]>("/api/admin/placements")
      .then((p) => alive && setPlacements(p)).catch(() => {});
    api.get<CompanyHireRow[]>("/api/admin/employers")
      .then((e) => alive && setEmployers(e)).catch(() => {});
    Promise.all([
      api.get<unknown[]>("/api/admin/companies?status_filter=pending").catch(() => []),
      api.get<unknown[]>("/api/admin/training?status_filter=pending").catch(() => []),
      api.get<unknown[]>("/api/admin/verification-queue").catch(() => []),
    ]).then(([c, t, y]) => {
      if (alive) setPending({ companies: c.length, courses: t.length, youth: y.length });
    });

    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <Spinner label="Loading constituency dashboard…" />;
  if (error || !data)
    return (
      <EmptyState
        icon={<IconChart />}
        title="Dashboard unavailable"
        body={error ?? "No dashboard data was returned."}
      />
    );

  const { kpis, pipeline, comparison } = data;

  const kpiTiles: {
    label: string;
    value: string;
    icon: ReactNode;
    accent: Accent;
  }[] = [
    { label: "Total Youth", value: nf.format(kpis.total_youth), icon: <IconUsers />, accent: "blue" },
    { label: "Registered Job Seekers", value: nf.format(kpis.registered_seekers), icon: <IconUserCheck />, accent: "teal" },
    { label: "Active Recruiters", value: nf.format(kpis.active_recruiters), icon: <IconBriefcase />, accent: "purple" },
    { label: "Training Enrolled", value: nf.format(kpis.training_enrolled), icon: <IconGradCap />, accent: "orange" },
    { label: "Placed Candidates", value: nf.format(kpis.placed_candidates), icon: <IconTrendingUp />, accent: "green" },
    { label: "Placement Rate", value: `${kpis.placement_rate}%`, icon: <IconChart />, accent: "blue" },
  ];

  const pipelineSteps: {
    value: number;
    label: string;
    icon: ReactNode;
    accent: Accent;
  }[] = [
    { value: pipeline.registered, label: "Registered", icon: <IconIdCard />, accent: "blue" },
    { value: pipeline.shortlisted, label: "Shortlisted", icon: <IconUserCheck />, accent: "teal" },
    { value: pipeline.interviews, label: "Interviews", icon: <IconUsers />, accent: "orange" },
    { value: pipeline.selected, label: "Selected", icon: <IconTarget />, accent: "purple" },
    { value: pipeline.joined, label: "Joined", icon: <IconTrendingUp />, accent: "green" },
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        n={7}
        title="Constituency Dashboard"
        subtitle="Real-time insights · Data-driven decisions"
      />

      {/* KPI row */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {kpiTiles.map((t) => (
            <StatTile
              key={t.label}
              label={t.label}
              value={t.value}
              icon={t.icon}
              accent={t.accent}
            />
          ))}
        </div>
      </section>

      {/* Overview tables */}
      <section>
        <SectionTitle n={1} title="Overview" />

        {/* Pending verifications strip */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-4">
          <span className="text-sm font-semibold text-ink">Needs your verification:</span>
          <Link href="/mla/verifications" className="chip hover:bg-brand-blueTint">
            <span className="tnum font-bold text-brand-blue">{pending.companies}</span> companies
          </Link>
          <Link href="/mla/verifications" className="chip hover:bg-brand-blueTint">
            <span className="tnum font-bold text-brand-orange">{pending.courses}</span> courses
          </Link>
          <Link href="/mla/verifications" className="chip hover:bg-brand-blueTint">
            <span className="tnum font-bold text-brand-green">{pending.youth}</span> youth
          </Link>
          <Link
            href="/mla/verifications"
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"
          >
            Open verifications <IconArrowRight width={13} height={13} />
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent placements */}
          <div className="card overflow-hidden p-0">
            <PanelHeader title="Recent placements" href="/mla/placements" />
            <div className="overflow-x-auto">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>Youth</th>
                    <th>Job</th>
                    <th>Company</th>
                    <th>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {placements.slice(0, 5).map((p, i) => (
                    <tr key={`${p.youth_id}-${i}`}>
                      <td className="font-semibold text-ink">{p.youth_name}</td>
                      <td className="text-ink">{p.job_title}</td>
                      <td className="text-muted">{p.company}</td>
                      <td><StageBadge stage={p.stage} /></td>
                    </tr>
                  ))}
                  {placements.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-muted">No placements yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top employers */}
          <div className="card overflow-hidden p-0">
            <PanelHeader title="Top employers by hires" href="/mla/employers" />
            <div className="overflow-x-auto">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Industry</th>
                    <th className="num">Jobs</th>
                    <th className="num">Hired</th>
                  </tr>
                </thead>
                <tbody>
                  {employers.slice(0, 5).map((e) => (
                    <tr key={e.org_id}>
                      <td className="font-semibold text-ink">{e.company}</td>
                      <td className="text-muted">{e.industry ?? "—"}</td>
                      <td className="num text-ink">{e.active_jobs}</td>
                      <td className="num font-semibold text-ink">{e.hired}</td>
                    </tr>
                  ))}
                  {employers.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-muted">No employers yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Employment pipeline */}
      <section>
        <SectionTitle n={2} title="Employment Pipeline" />
        <div className="card p-6 transition-shadow hover:shadow-lift">
          <div className="flex flex-wrap items-start justify-center gap-2">
            {pipelineSteps.map((s, i) => (
              <div key={s.label} className="flex items-start gap-2">
                <PipelineStep {...s} />
                {i < pipelineSteps.length - 1 && (
                  <IconArrowRight
                    className="mt-4 shrink-0 text-brand-blue/40"
                    width={22}
                    height={22}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key metrics */}
      <section>
        <SectionTitle n={3} title="Key Metrics" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-5 transition-shadow hover:shadow-lift">
            <h3 className="eyebrow mb-3 text-brand-blue">Youth Employment Status</h3>
            <DonutChart data={data.employment_status} />
          </div>
          <div className="card p-5 transition-shadow hover:shadow-lift">
            <h3 className="eyebrow mb-3 text-brand-green">Monthly Placements Trend</h3>
            <VBarChart data={data.monthly_placements} />
          </div>
          <div className="card p-5 transition-shadow hover:shadow-lift">
            <h3 className="eyebrow mb-4 text-brand-orange">Top Skill Demand</h3>
            <ol className="space-y-2.5">
              {data.top_skill_demand.map((s, i) => (
                <li key={s.name} className="flex items-center gap-3">
                  <span className="tnum inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-orangeTint text-xs font-bold text-brand-orange">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-ink">{s.name}</span>
                  <span className="tnum text-sm font-semibold text-navy-800">
                    {nf.format(s.value)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Demographic insights */}
      <section>
        <SectionTitle n={4} title="Demographic Insights" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-5 transition-shadow hover:shadow-lift">
            <h3 className="eyebrow mb-3 text-brand-blue">Gender Wise</h3>
            <MiniPie data={data.gender} />
          </div>
          <div className="card p-5 transition-shadow hover:shadow-lift">
            <h3 className="eyebrow mb-3 text-brand-teal">Age Group</h3>
            <HBarChart data={data.age_group} />
          </div>
          <div className="card p-5 transition-shadow hover:shadow-lift">
            <h3 className="eyebrow mb-3 text-brand-purple">Education Level</h3>
            <HBarChart data={data.education_level} />
          </div>
        </div>
      </section>

      {/* Comparison + score */}
      <section>
        <SectionTitle n={5} title="Constituency-wise Comparison" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card overflow-hidden p-0 transition-shadow hover:shadow-lift lg:col-span-2">
            <div className="overflow-x-auto">
              <table className="grid-table">
                <thead>
                  <tr className="border-b border-line bg-canvas text-left">
                    <th className="px-4 py-3 font-semibold text-navy-800">Constituency</th>
                    <th className="px-4 py-3 font-semibold text-navy-800">Registered Youth</th>
                    <th className="px-4 py-3 font-semibold text-navy-800">Placed Candidates</th>
                    <th className="px-4 py-3 font-semibold text-navy-800">Placement Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((c) => (
                    <tr
                      key={c.name}
                      className={cx(
                        "border-b border-line last:border-0",
                        c.is_yours
                          ? "bg-navy-800 font-semibold text-white"
                          : "text-ink",
                      )}
                    >
                      <td className="px-4 py-3">{c.is_yours ? "Your Constituency" : c.name}</td>
                      <td className="tnum px-4 py-3">{nf.format(c.registered_youth)}</td>
                      <td className="tnum px-4 py-3">{nf.format(c.placed_candidates)}</td>
                      <td className="tnum px-4 py-3">{c.placement_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line p-5">
              <h3 className="eyebrow mb-3 text-brand-blue">Placement Rate Comparison</h3>
              <HBarChart
                data={comparison.map((c) => ({
                  name: c.is_yours ? "Your Constituency" : c.name,
                  value: c.placement_rate,
                }))}
                highlightName="Your Constituency"
              />
            </div>
          </div>

          <div className="card flex flex-col items-center justify-center gap-3 p-6 text-center transition-shadow hover:shadow-lift">
            <h3 className="eyebrow text-center text-brand-green">
              Constituency Employment Score
            </h3>
            <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-brand-green/25 bg-brand-greenTint px-4 py-6">
              <ScoreGauge
                score={data.employment_score}
                band={data.employment_score_band}
                stars
              />
            </div>
          </div>
        </div>
      </section>

      <div className="footer-band -mx-4 rounded-2xl px-6 py-5 text-center sm:-mx-6">
        <p className="font-display text-sm font-semibold tracking-wide">
          Data-driven Governance · Youth Empowerment · Stronger Constituencies
        </p>
      </div>
    </div>
  );
}
