"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState, PageHeader, cx } from "@/components/ui";
import { Skeleton } from "@/components/skeleton";
import { IconFilter, IconTarget, IconTrendingUp } from "@/components/icons";
import { api } from "@/lib/api";
import type { CompanyHireRow, PlacementRow, Skill, YouthVoterLink } from "@/lib/types";

const nf = new Intl.NumberFormat("en-IN");

const EDUCATION_LEVELS = [
  "Below 12th",
  "12th Pass",
  "Diploma",
  "Graduate",
  "Post Graduate",
] as const;

const STAGE_OPTIONS = ["all", "selected", "joined"] as const;
type StageFilter = (typeof STAGE_OPTIONS)[number];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StageBadge({ stage }: { stage: string }) {
  const cls =
    stage === "joined"
      ? "bg-brand-greenTint text-brand-greenDark"
      : stage === "selected"
        ? "bg-brand-blueTint text-brand-blue"
        : "bg-navy-50 text-muted";
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        cls,
      )}
    >
      {stage}
    </span>
  );
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
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
        {accent === "green" ? (
          <IconTrendingUp width={18} height={18} />
        ) : (
          <IconTarget width={18} height={18} />
        )}
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

export default function PlacementsPage() {
  const [rows, setRows] = useState<PlacementRow[] | null>(null);
  const [companies, setCompanies] = useState<CompanyHireRow[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selected, setSelected] = useState<YouthVoterLink | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [orgId, setOrgId] = useState("");
  const [education, setEducation] = useState("");
  const [skillId, setSkillId] = useState("");
  const [stage, setStage] = useState<StageFilter>("all");

  // Filter option sources (companies + skills) loaded once.
  useEffect(() => {
    let alive = true;
    api
      .get<CompanyHireRow[]>("/api/admin/employers")
      .then((d) => alive && setCompanies(d))
      .catch(() => alive && setCompanies([]));
    api
      .get<Skill[]>("/api/reference/skills")
      .then((d) => alive && setSkills(d))
      .catch(() => alive && setSkills([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setRows(null);
    const params = new URLSearchParams();
    if (orgId) params.set("org_id", orgId);
    if (education) params.set("education_level", education);
    if (skillId) params.set("skill_id", skillId);
    if (stage !== "all") params.set("stage", stage);
    const qs = params.toString();
    api
      .get<PlacementRow[]>(`/api/admin/placements${qs ? `?${qs}` : ""}`)
      .then((d) => alive && setRows(d))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [orgId, education, skillId, stage]);

  const totals = useMemo(() => {
    const list = rows ?? [];
    return {
      count: list.length,
      joined: list.filter((r) => r.stage === "joined").length,
      selected: list.filter((r) => r.stage === "selected").length,
    };
  }, [rows]);

  async function openDetails(row: PlacementRow) {
    setDetailLoading(true);
    try {
      const detail = await api.get<YouthVoterLink>(`/api/admin/youth/${row.youth_id}/voter-details`);
      setSelected(detail);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Placements"
        subtitle="Which youth were selected or joined which jobs."
      />

      {/* Summary strip */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatChip
          label="Total placements"
          value={nf.format(totals.count)}
          accent="orange"
        />
        <StatChip
          label="Joined"
          value={nf.format(totals.joined)}
          accent="green"
        />
        <StatChip
          label="Selected"
          value={nf.format(totals.selected)}
          accent="blue"
        />
      </div>

      {/* Filter bar */}
      <div className="card mb-5 flex flex-wrap items-end gap-4 p-4">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-muted">
          <IconFilter width={16} height={16} />
          Filters
        </span>
        <div className="flex flex-col gap-1">
          <label htmlFor="company" className="label">
            Company
          </label>
          <select
            id="company"
            className="input py-2"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.org_id} value={c.org_id}>
                {c.company}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="education" className="label">
            Education
          </label>
          <select
            id="education"
            className="input py-2"
            value={education}
            onChange={(e) => setEducation(e.target.value)}
          >
            <option value="">All levels</option>
            {EDUCATION_LEVELS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="skill" className="label">
            Skill
          </label>
          <select
            id="skill"
            className="input py-2"
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
          >
            <option value="">All skills</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="stage" className="label">
            Stage
          </label>
          <select
            id="stage"
            className="input py-2"
            value={stage}
            onChange={(e) => setStage(e.target.value as StageFilter)}
          >
            {STAGE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o === "all" ? "All stages" : o[0].toUpperCase() + o.slice(1)}
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
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<IconTarget />}
          title="No placements found"
          body="Try adjusting the filters to see selected and joined candidates."
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="grid-table">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    Youth
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    Education
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    Job
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                    Stage
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    Match
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r, i) => (
                  <tr
                    key={`${r.youth_id}-${r.job_title}-${i}`}
                    className="cursor-pointer hover:bg-canvas/60"
                    onClick={() => openDetails(r)}
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-ink">
                      <button className="font-semibold text-brand-blue hover:underline">
                        {r.youth_name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink">
                      {r.education_level ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink">
                      {r.job_title}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink">{r.company}</td>
                    <td className="px-4 py-3">
                      <StageBadge stage={r.stage} />
                    </td>
                    <td className="tnum px-4 py-3 text-right text-sm font-semibold text-ink">
                      {Math.round(r.match_score)}%
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-muted">
                      {formatDate(r.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <div className="card px-5 py-4 text-sm text-muted">Loading voter details...</div>
        </div>
      )}

      {selected && (
        <VoterDetailModal detail={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function VoterDetailModal({
  detail,
  onClose,
}: {
  detail: YouthVoterLink;
  onClose: () => void;
}) {
  const voter = detail.voter;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/40 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div className="card my-4 w-full max-w-3xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="section-title text-xl">Youth + Voter Details</h2>
            <p className="mt-1 text-sm text-muted">
              Official voter-register details linked using EPIC / voter ID.
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost !px-3 !py-1.5 text-sm">
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <InfoCard title="Youth Name" value={detail.youth_name} />
          <InfoCard title="Youth Phone" value={detail.youth_phone} />
          <InfoCard title="Linked Voter ID" value={detail.epic_number ?? "-"} />
          <InfoCard title="Verification" value={detail.verification_status} />
        </div>

        {voter ? (
          <div className="mt-6 overflow-x-auto">
            <table className="grid-table">
              <tbody>
                <DetailRow label="Voter Name" value={voter.name} />
                <DetailRow label="Relation" value={voter.relation_type ?? "-"} />
                <DetailRow label="Relative Name" value={voter.relative_name ?? "-"} />
                <DetailRow label="House No" value={voter.house_no ?? "-"} />
                <DetailRow label="Age" value={voter.age?.toString() ?? "-"} />
                <DetailRow label="Gender" value={voter.gender ?? "-"} />
                <DetailRow label="Constituency" value={voter.constituency ?? "-"} />
                <DetailRow label="Division" value={voter.division ?? "-"} />
                <DetailRow label="Village" value={voter.village ?? "-"} />
                <DetailRow label="Ward" value={voter.ward ?? "-"} />
                <DetailRow label="Part" value={voter.part?.toString() ?? "-"} />
                <DetailRow label="Booth Number" value={voter.booth_number ?? "-"} />
                <DetailRow label="Confirmed" value={voter.confirmed ? "Yes" : "No"} />
                <DetailRow label="Party" value={voter.party ?? "-"} />
                <DetailRow label="Agent" value={voter.agent ?? "-"} />
                <DetailRow label="Notes" value={voter.notes ?? "-"} />
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-line bg-canvas px-4 py-4 text-sm text-muted">
            No voter record found for this youth's linked voter ID.
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-canvas p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{title}</div>
      <div className="mt-1 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th className="w-48">{label}</th>
      <td>{value}</td>
    </tr>
  );
}
