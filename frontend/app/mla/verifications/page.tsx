"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  EmptyState,
  PageHeader,
  cx,
} from "@/components/ui";
import { Skeleton } from "@/components/skeleton";
import { useToast } from "@/components/toast";
import {
  IconBriefcase,
  IconCheck,
  IconGradCap,
  IconShieldCheck,
  IconUsers,
} from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import type { CompanyOrg, TrainingProgram, YouthProfile } from "@/lib/types";

const nf = new Intl.NumberFormat("en-IN");

type TabKey = "youth" | "companies" | "training";

/* ---------- shared table primitives ---------- */

function Th({
  children,
  right,
}: {
  children: ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={cx(
        "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  className,
}: {
  children: ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cx(
        "px-4 py-3 text-sm text-ink align-middle",
        right && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}

function ActionButtons({
  onApprove,
  onReject,
  busy,
}: {
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onApprove}
        disabled={busy}
        className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
      >
        <IconCheck width={14} height={14} />
        Approve
      </button>
      <button
        type="button"
        onClick={onReject}
        disabled={busy}
        className="btn-ghost px-3 py-1.5 text-xs text-brand-red disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: 5 }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cx("h-4", c === 0 ? "w-40" : "flex-1")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------- page ---------- */

export default function VerificationsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>("youth");

  const [youth, setYouth] = useState<YouthProfile[] | null>(null);
  const [companies, setCompanies] = useState<CompanyOrg[] | null>(null);
  const [training, setTraining] = useState<TrainingProgram[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<YouthProfile[]>("/api/admin/verification-queue")
      .then((d) => alive && setYouth(d))
      .catch(() => alive && setYouth([]));
    api
      .get<CompanyOrg[]>("/api/admin/companies?status_filter=pending")
      .then((d) => alive && setCompanies(d))
      .catch(() => alive && setCompanies([]));
    api
      .get<TrainingProgram[]>("/api/admin/training?status_filter=pending")
      .then((d) => alive && setTraining(d))
      .catch(() => alive && setTraining([]));
    return () => {
      alive = false;
    };
  }, []);

  async function act(
    kind: TabKey,
    id: number,
    approve: boolean,
    label: string,
  ) {
    setBusyId(id);
    const path =
      kind === "youth"
        ? `/api/admin/youth/${id}/verify?approve=${approve}`
        : kind === "companies"
          ? `/api/admin/companies/${id}/verify?approve=${approve}`
          : `/api/admin/training/${id}/verify?approve=${approve}`;
    try {
      await api.patch(path);
      if (kind === "youth")
        setYouth((rows) => (rows ?? []).filter((r) => r.id !== id));
      if (kind === "companies")
        setCompanies((rows) => (rows ?? []).filter((r) => r.id !== id));
      if (kind === "training")
        setTraining((rows) => (rows ?? []).filter((r) => r.id !== id));
      toast(
        `${label} ${approve ? "approved" : "rejected"}`,
        approve ? "success" : "info",
      );
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Action failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { key: TabKey; label: string; icon: ReactNode; count?: number }[] =
    [
      { key: "youth", label: "Youth", icon: <IconUsers width={16} height={16} />, count: youth?.length },
      { key: "companies", label: "Companies", icon: <IconBriefcase width={16} height={16} />, count: companies?.length },
      { key: "training", label: "Training", icon: <IconGradCap width={16} height={16} />, count: training?.length },
    ];

  return (
    <div>
      <PageHeader
        title="Verification console"
        subtitle="Review and approve youth, employers and training before they go live."
      />

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cx(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-brand-blue text-white"
                  : "bg-white text-muted border border-line hover:text-ink",
              )}
            >
              {t.icon}
              {t.label}
              {t.count !== undefined && (
                <span
                  className={cx(
                    "tnum inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-brand-blueTint text-brand-blue",
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "youth" && (
        <YouthTab
          rows={youth}
          busyId={busyId}
          onApprove={(r) => act("youth", r.id, true, r.name)}
          onReject={(r) => act("youth", r.id, false, r.name)}
        />
      )}
      {tab === "companies" && (
        <CompaniesTab
          rows={companies}
          busyId={busyId}
          onApprove={(r) => act("companies", r.id, true, r.name)}
          onReject={(r) => act("companies", r.id, false, r.name)}
        />
      )}
      {tab === "training" && (
        <TrainingTab
          rows={training}
          busyId={busyId}
          onApprove={(r) => act("training", r.id, true, r.title)}
          onReject={(r) => act("training", r.id, false, r.title)}
        />
      )}
    </div>
  );
}

/* ---------- Youth ---------- */

function YouthTab({
  rows,
  busyId,
  onApprove,
  onReject,
}: {
  rows: YouthProfile[] | null;
  busyId: number | null;
  onApprove: (r: YouthProfile) => void;
  onReject: (r: YouthProfile) => void;
}) {
  if (rows === null)
    return (
      <div className="card overflow-hidden p-0">
        <TableSkeleton cols={6} />
      </div>
    );
  if (rows.length === 0)
    return (
      <EmptyState
        icon={<IconShieldCheck />}
        title="No youth pending verification"
        body="New voter-verified profiles will appear here for review."
      />
    );

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="grid-table">
          <thead>
            <tr className="border-b border-line">
              <Th>Name</Th>
              <Th>Voter ID</Th>
              <Th>Constituency</Th>
              <Th>Education</Th>
              <Th right>Score</Th>
              <Th right>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-canvas/60">
                <Td className="font-semibold">{r.name}</Td>
                <Td className="tnum text-muted">{r.epic_number ?? "—"}</Td>
                <Td>{r.constituency_name ?? "—"}</Td>
                <Td>{r.education_level ?? "—"}</Td>
                <Td right className="tnum font-semibold">
                  {nf.format(r.employability_score)}
                </Td>
                <Td right>
                  <ActionButtons
                    busy={busyId === r.id}
                    onApprove={() => onApprove(r)}
                    onReject={() => onReject(r)}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Companies ---------- */

function CompaniesTab({
  rows,
  busyId,
  onApprove,
  onReject,
}: {
  rows: CompanyOrg[] | null;
  busyId: number | null;
  onApprove: (r: CompanyOrg) => void;
  onReject: (r: CompanyOrg) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Verify employers before their jobs are trusted.
      </p>
      {rows === null ? (
        <div className="card overflow-hidden p-0">
          <TableSkeleton cols={5} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<IconBriefcase />}
          title="No companies pending verification"
          body="New employer registrations will appear here."
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="grid-table">
              <thead>
                <tr className="border-b border-line">
                  <Th>Company</Th>
                  <Th>Industry</Th>
                  <Th right>Jobs</Th>
                  <Th right>Hired</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-canvas/60">
                    <Td className="font-semibold">{r.name}</Td>
                    <Td>{r.industry ?? "—"}</Td>
                    <Td right className="tnum">
                      {nf.format(r.job_count)}
                    </Td>
                    <Td right className="tnum">
                      {nf.format(r.hired_count)}
                    </Td>
                    <Td right>
                      <ActionButtons
                        busy={busyId === r.id}
                        onApprove={() => onApprove(r)}
                        onReject={() => onReject(r)}
                      />
                    </Td>
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

/* ---------- Training ---------- */

function TrainingTab({
  rows,
  busyId,
  onApprove,
  onReject,
}: {
  rows: TrainingProgram[] | null;
  busyId: number | null;
  onApprove: (r: TrainingProgram) => void;
  onReject: (r: TrainingProgram) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Courses are submitted by training providers; you only verify them.
      </p>
      {rows === null ? (
        <div className="card overflow-hidden p-0">
          <TableSkeleton cols={6} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<IconGradCap />}
          title="No training programs pending"
          body="Programs submitted by providers will appear here for review."
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="grid-table">
              <thead>
                <tr className="border-b border-line">
                  <Th>Title</Th>
                  <Th>Type</Th>
                  <Th>Provider</Th>
                  <Th>Target skill</Th>
                  <Th>Duration</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-canvas/60">
                    <Td className="font-semibold">{r.title}</Td>
                    <Td>
                      <span className="chip">{r.program_type}</span>
                    </Td>
                    <Td>{r.provider ?? "—"}</Td>
                    <Td>{r.target_skill_name ?? "—"}</Td>
                    <Td className="text-muted">{r.duration ?? "—"}</Td>
                    <Td right>
                      <ActionButtons
                        busy={busyId === r.id}
                        onApprove={() => onApprove(r)}
                        onReject={() => onReject(r)}
                      />
                    </Td>
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
