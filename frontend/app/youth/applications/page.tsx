"use client";

import { useEffect, useState } from "react";
import {
  IconBriefcase,
  IconCheck,
  IconCalendar,
  IconDoc,
} from "@/components/icons";
import {
  IconTile,
  MatchBar,
  EmptyState,
  PageHeader,
  CtaLink,
  cx,
} from "@/components/ui";
import { SkeletonList } from "@/components/skeleton";
import { useToast } from "@/components/toast";
import { api, ApiError } from "@/lib/api";
import { PIPELINE_STAGES, type Application } from "@/lib/types";

const STAGE_LABELS: Record<string, string> = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  interview: "Interview",
  selected: "Selected",
  joined: "Joined",
};

export default function YouthApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [stageFilter, setStageFilter] = useState("all");
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    api
      .get<Application[]>("/api/youth/applications")
      .then((d) => alive && setApps(d))
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  async function respond(app: Application, accept: boolean) {
    setBusyId(app.id);
    try {
      const updated = await api.post<Application>(
        `/api/youth/applications/${app.id}/respond`,
        { accept },
      );
      setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, stage: updated.stage } : a)));
      toast(
        accept ? `Offer accepted — ${app.job_title}` : "Offer declined",
        accept ? "success" : "info",
      );
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not respond", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function checkIn(app: Application, body: Record<string, unknown>) {
    setBusyId(app.id);
    try {
      const outcome = await api.post<Application["placement_outcome"]>(
        `/api/youth/applications/${app.id}/retention-checkin`,
        body,
      );
      setApps((current) =>
        current.map((item) => (item.id === app.id ? { ...item, placement_outcome: outcome } : item)),
      );
      toast("Employment check-in saved", "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not save check-in", "error");
    } finally {
      setBusyId(null);
    }
  }

  const offers = apps.filter((a) => a.stage === "selected");
  const visible = stageFilter === "all" ? apps : apps.filter((a) => a.stage === stageFilter);

  if (loading)
    return (
      <div className="space-y-6">
        <PageHeader title="My Applications" subtitle="Track every application" />
        <SkeletonList count={3} lines={2} />
      </div>
    );
  if (error)
    return (
      <div className="rounded-xl bg-brand-redTint px-4 py-3 text-sm text-brand-red">
        {error}
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Applications"
        subtitle="Track every application through the hiring pipeline"
      />

      {offers.length > 0 && (
        <div className="rounded-lg border border-brand-green/30 bg-brand-greenTint/50 p-4">
          <p className="text-sm font-semibold text-brand-greenDark">
            You have {offers.length} job offer{offers.length > 1 ? "s" : ""} to respond to below.
          </p>
        </div>
      )}

      {apps.length === 0 ? (
        <EmptyState
          icon={<IconDoc width={22} height={22} />}
          title="You haven't applied yet"
          body="Browse jobs matched to your profile and apply in one click. Your applications will show up here."
          action={<CtaLink href="/youth/jobs">Browse matched jobs</CtaLink>}
        />
      ) : (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-2">
            {[
              ["all", "All"],
              ["applied", "Applied"],
              ["shortlisted", "Shortlisted"],
              ["interview", "Interview"],
              ["selected", "Offer"],
              ["joined", "Joined"],
              ["declined", "Declined"],
              ["rejected", "Rejected"],
            ].map(([key, label]) => {
              const count = key === "all" ? apps.length : apps.filter((a) => a.stage === key).length;
              if (key !== "all" && count === 0) return null;
              return (
                <button
                  key={key}
                  onClick={() => setStageFilter(key)}
                  className={cx(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    stageFilter === key
                      ? "bg-brand-blue text-white"
                      : "text-muted hover:bg-canvas hover:text-ink",
                  )}
                >
                  {label} <span className="tnum">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4">
            {visible.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                busy={busyId === app.id}
                onRespond={respond}
                onCheckIn={checkIn}
              />
            ))}
            {visible.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">
                No applications in this stage.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ApplicationCard({
  app,
  busy,
  onRespond,
  onCheckIn,
}: {
  app: Application;
  busy: boolean;
  onRespond: (app: Application, accept: boolean) => void;
  onCheckIn: (app: Application, body: Record<string, unknown>) => void;
}) {
  const rejected = app.stage === "rejected" || app.stage === "declined";
  const isOffer = app.stage === "selected";
  const currentIndex = PIPELINE_STAGES.indexOf(
    app.stage as (typeof PIPELINE_STAGES)[number],
  );

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <IconTile icon={<IconBriefcase />} accent="teal" />
          <div>
            <h3 className="font-display text-lg font-bold text-navy-800">
              {app.job_title}
            </h3>
            <p className="text-sm font-medium text-muted">{app.org_name}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Match
          </div>
          <MatchBar score={Math.round(app.match_score)} />
        </div>
      </div>

      {rejected ? (
        <div className="mt-5 rounded-lg bg-brand-redTint px-4 py-3 text-sm font-semibold text-brand-red">
          {app.stage === "declined"
            ? "You declined this offer."
            : "This application was not selected to proceed."}
        </div>
      ) : (
        <ol className="mt-6 flex items-center">
          {PIPELINE_STAGES.map((stage, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex;
            return (
              <li key={stage} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    className={cx(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition",
                      done
                        ? "bg-brand-green text-white"
                        : active
                          ? "bg-brand-blue text-white ring-4 ring-brand-blue/15"
                          : "bg-line text-muted",
                    )}
                  >
                    {done ? <IconCheck width={15} height={15} /> : i + 1}
                  </span>
                  <span
                    className={cx(
                      "text-[11px] font-semibold",
                      active
                        ? "text-brand-blue"
                        : done
                          ? "text-brand-greenDark"
                          : "text-muted",
                    )}
                  >
                    {STAGE_LABELS[stage]}
                  </span>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <span
                    className={cx(
                      "mx-1 mb-5 h-0.5 flex-1 rounded-full",
                      i < currentIndex ? "bg-brand-green" : "bg-line",
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}

      {isOffer && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-green/30 bg-brand-greenTint/50 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <IconTile icon={<IconCheck width={18} height={18} />} accent="green" size="sm" />
            <div className="text-sm">
              <div className="font-semibold text-brand-greenDark">You've got an offer!</div>
              <p className="text-muted">{app.org_name} selected you for {app.job_title}.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-primary !py-1.5"
              disabled={busy}
              onClick={() => onRespond(app, true)}
            >
              {busy ? "…" : "Accept offer"}
            </button>
            <button
              className="btn-ghost !border-brand-red !py-1.5 !text-brand-red hover:!bg-brand-redTint"
              disabled={busy}
              onClick={() => onRespond(app, false)}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {app.interview && !rejected && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-brand-blueTint bg-brand-blueTint/50 px-4 py-3">
          <IconTile icon={<IconCalendar width={18} height={18} />} accent="blue" size="sm" />
          <div className="text-sm">
            <div className="font-semibold text-ink">Interview scheduled</div>
            <p className="text-muted">
              {app.interview.scheduled_at
                ? new Date(app.interview.scheduled_at).toLocaleString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Date to be confirmed"}
              {" · "}
              {app.interview.mode}
            </p>
            {app.interview.notes && (
              <p className="mt-1 text-muted">{app.interview.notes}</p>
            )}
          </div>
        </div>
      )}

      {app.stage === "joined" && (
        <RetentionPanel app={app} busy={busy} onSubmit={onCheckIn} />
      )}
    </div>
  );
}

function RetentionPanel({
  app,
  busy,
  onSubmit,
}: {
  app: Application;
  busy: boolean;
  onSubmit: (app: Application, body: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState("3");
  const [stillEmployed, setStillEmployed] = useState(true);
  const [salary, setSalary] = useState(app.placement_outcome?.current_salary?.toString() ?? "");
  const [roleMatch, setRoleMatch] = useState("4");
  const [satisfaction, setSatisfaction] = useState("4");
  const [exitReason, setExitReason] = useState("");
  const outcome = app.placement_outcome;

  return (
    <div className="mt-5 rounded-xl border border-brand-teal/30 bg-brand-teal/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-ink">Sustainable employment tracking</div>
          <p className="text-xs text-muted">
            Record your 3, 6, or 12-month status, salary progression, and job fit.
          </p>
          <div className="mt-2 flex gap-2 text-xs font-semibold">
            {[3, 6, 12].map((milestone) => {
              const value = outcome?.[`retained_${milestone}m` as keyof typeof outcome];
              return (
                <span key={milestone} className="rounded-full bg-white px-2 py-1 text-muted">
                  {milestone}m: {value === true ? "Retained" : value === false ? "Exited" : "Due"}
                </span>
              );
            })}
          </div>
        </div>
        <button type="button" className="btn-ghost !py-2" onClick={() => setOpen(!open)}>
          {open ? "Close" : "Add check-in"}
        </button>
      </div>

      {open && (
        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="label" htmlFor={`months-${app.id}`}>Milestone</label>
            <select id={`months-${app.id}`} className="input !py-2" value={months} onChange={(e) => setMonths(e.target.value)}>
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="12">12 months</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`employed-${app.id}`}>Current status</label>
            <select id={`employed-${app.id}`} className="input !py-2" value={stillEmployed ? "yes" : "no"} onChange={(e) => setStillEmployed(e.target.value === "yes")}>
              <option value="yes">Still employed</option>
              <option value="no">Exited role</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`salary-${app.id}`}>Monthly salary</label>
            <input id={`salary-${app.id}`} type="number" min="0" className="input !py-2" value={salary} onChange={(e) => setSalary(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor={`fit-${app.id}`}>Role fit (1-5)</label>
            <input id={`fit-${app.id}`} type="number" min="1" max="5" className="input !py-2" value={roleMatch} onChange={(e) => setRoleMatch(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor={`sat-${app.id}`}>Satisfaction (1-5)</label>
            <input id={`sat-${app.id}`} type="number" min="1" max="5" className="input !py-2" value={satisfaction} onChange={(e) => setSatisfaction(e.target.value)} />
          </div>
          {!stillEmployed && (
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="label" htmlFor={`exit-${app.id}`}>Reason for exit</label>
              <input id={`exit-${app.id}`} className="input !py-2" value={exitReason} onChange={(e) => setExitReason(e.target.value)} placeholder="Role mismatch, relocation, wages, personal reason..." />
            </div>
          )}
          <div className="flex items-end">
            <button
              type="button"
              className="btn-primary w-full !py-2"
              disabled={busy || !roleMatch || !satisfaction}
              onClick={() => onSubmit(app, {
                retention_months: Number(months),
                still_employed: stillEmployed,
                current_salary: salary ? Number(salary) : null,
                role_skill_match: Number(roleMatch),
                candidate_satisfaction: Number(satisfaction),
                exit_reason: stillEmployed ? null : exitReason,
              })}
            >
              {busy ? "Saving..." : "Save check-in"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
