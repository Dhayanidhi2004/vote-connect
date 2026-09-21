"use client";

import { useEffect, useState } from "react";
import {
  EmptyState,
  PageHeader,
  Spinner,
  cx,
} from "@/components/ui";
import { IconArrowRight, IconCalendar, IconUsers } from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import { PIPELINE_STAGES, type Application, type Job } from "@/lib/types";
import { Avatar, Modal } from "../_components";

type Stage = (typeof PIPELINE_STAGES)[number];

const STAGE_META: Record<Stage, { label: string; accent: string }> = {
  applied: { label: "Applied", accent: "text-brand-blue" },
  shortlisted: { label: "Shortlisted", accent: "text-brand-orange" },
  interview: { label: "Interview", accent: "text-brand-purple" },
  selected: { label: "Selected", accent: "text-brand-teal" },
  joined: { label: "Joined", accent: "text-brand-green" },
};

const NEXT_STAGE: Partial<Record<Stage, Stage>> = {
  applied: "shortlisted",
  shortlisted: "interview",
  interview: "selected",
  selected: "joined",
};

export default function PipelinePage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Application | null>(null);
  const [outcomeFor, setOutcomeFor] = useState<Application | null>(null);

  useEffect(() => {
    api
      .get<Job[]>("/api/recruiter/jobs")
      .then(setJobs)
      .catch(() => setJobs([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get<Application[]>(
        `/api/recruiter/applications${jobId ? `?job_id=${jobId}` : ""}`,
      )
      .then(setApps)
      .catch((e: unknown) =>
        setError(e instanceof ApiError ? e.message : "Failed to load pipeline."),
      )
      .finally(() => setLoading(false));
  }, [jobId]);

  const setStage = async (app: Application, stage: Stage | "rejected") => {
    setBusyId(app.id);
    const prev = apps;
    // optimistic
    setApps((list) =>
      stage === "rejected"
        ? list.filter((a) => a.id !== app.id)
        : list.map((a) => (a.id === app.id ? { ...a, stage } : a)),
    );
    try {
      await api.patch(`/api/recruiter/applications/${app.id}/stage`, { stage });
    } catch {
      setApps(prev); // rollback
    } finally {
      setBusyId(null);
    }
  };

  const byStage = (stage: Stage) => apps.filter((a) => a.stage === stage);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hiring Pipeline"
        subtitle="Track candidates at every stage"
        right={
          <div>
            <label className="sr-only" htmlFor="pipe-job">
              Filter by job
            </label>
            <select
              id="pipe-job"
              className="input !py-2"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
            >
              <option value="">All jobs</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {loading ? (
        <Spinner label="Loading pipeline…" />
      ) : error ? (
        <EmptyState
          icon={<IconUsers width={26} height={26} />}
          title="Could not load pipeline"
          body={error}
        />
      ) : apps.length === 0 ? (
        <EmptyState
          icon={<IconUsers width={26} height={26} />}
          title="No applications yet"
          body="Applications will appear here as candidates apply to your jobs."
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((stage) => {
            const items = byStage(stage);
            const meta = STAGE_META[stage];
            return (
              <div key={stage} className="flex w-72 shrink-0 flex-col">
                <div className="mb-3 flex items-center justify-between rounded-xl border border-line bg-white px-3 py-2">
                  <span className={cx("font-display text-sm font-bold uppercase tracking-wide", meta.accent)}>
                    {meta.label}
                  </span>
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-bold text-navy-700">
                    {items.length}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3">
                  {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
                      No candidates
                    </div>
                  ) : (
                    items.map((app) => {
                      const next = NEXT_STAGE[stage];
                      return (
                        <div key={app.id} className="card p-3">
                          <div className="flex items-center gap-2">
                            <Avatar name={app.youth_name} size="sm" />
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-navy-800">
                                {app.youth_name}
                              </div>
                              <div className="truncate text-xs text-muted">
                                {app.job_title}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span className="text-muted">Match</span>
                            <span className="font-bold text-navy-800">
                              {app.match_score}%
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {stage === "shortlisted" || stage === "interview" ? (
                              <button
                                onClick={() => setScheduleFor(app)}
                                className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold text-navy-800 hover:border-brand-blue"
                              >
                                <IconCalendar width={13} height={13} />
                                Schedule
                              </button>
                            ) : null}
                            {next && (
                              <button
                                onClick={() => setStage(app, next)}
                                disabled={busyId === app.id}
                                className="inline-flex items-center gap-1 rounded-lg bg-brand-blue px-2 py-1 text-xs font-semibold text-white hover:bg-brand-blueLight disabled:opacity-50"
                              >
                                Advance
                                <IconArrowRight width={13} height={13} />
                              </button>
                            )}
                            {stage === "joined" && (
                              <button
                                onClick={() => setOutcomeFor(app)}
                                className="rounded-lg border border-brand-green/40 px-2 py-1 text-xs font-semibold text-brand-greenDark hover:bg-brand-greenTint"
                              >
                                Outcome
                              </button>
                            )}
                            <button
                              onClick={() => setStage(app, "rejected")}
                              disabled={busyId === app.id}
                              className="rounded-lg border border-line px-2 py-1 text-xs font-semibold text-brand-red hover:border-brand-red disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ScheduleInterviewModal
        app={scheduleFor}
        onClose={() => setScheduleFor(null)}
      />
      <PlacementOutcomeModal
        app={outcomeFor}
        onClose={() => setOutcomeFor(null)}
        onSaved={(updated) => {
          setApps((current) => current.map((app) => (
            app.id === updated.id ? updated : app
          )));
          setOutcomeFor(null);
        }}
      />
    </div>
  );
}

function PlacementOutcomeModal({
  app,
  onClose,
  onSaved,
}: {
  app: Application | null;
  onClose: () => void;
  onSaved: (app: Application) => void;
}) {
  const [startingSalary, setStartingSalary] = useState("");
  const [currentSalary, setCurrentSalary] = useState("");
  const [employmentType, setEmploymentType] = useState("permanent");
  const [benefits, setBenefits] = useState("yes");
  const [satisfaction, setSatisfaction] = useState("4");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!app) return;
    setStartingSalary(app.placement_outcome?.starting_salary?.toString() ?? "");
    setCurrentSalary(app.placement_outcome?.current_salary?.toString() ?? "");
    setEmploymentType(app.placement_outcome?.employment_type ?? "permanent");
    setBenefits(app.placement_outcome?.has_formal_benefits === false ? "no" : "yes");
    setSatisfaction(app.placement_outcome?.employer_satisfaction?.toString() ?? "4");
    setError("");
  }, [app]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!app) return;
    setSubmitting(true);
    setError("");
    try {
      const placement = await api.put<Application["placement_outcome"]>(
        `/api/recruiter/applications/${app.id}/placement-outcome`,
        {
          starting_salary: startingSalary ? Number(startingSalary) : null,
          current_salary: currentSalary ? Number(currentSalary) : null,
          employment_type: employmentType,
          has_formal_benefits: benefits === "yes",
          employer_satisfaction: Number(satisfaction),
        },
      );
      onSaved({ ...app, placement_outcome: placement });
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Could not save placement outcome.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={app !== null} onClose={onClose} title="Placement outcome">
      {app && (
        <form onSubmit={save} className="space-y-4">
          <p className="text-sm text-muted">{app.youth_name} · {app.job_title}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="outcome-start">Starting monthly salary</label>
              <input id="outcome-start" type="number" min="0" className="input" value={startingSalary} onChange={(e) => setStartingSalary(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="outcome-current">Current monthly salary</label>
              <input id="outcome-current" type="number" min="0" className="input" value={currentSalary} onChange={(e) => setCurrentSalary(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="outcome-type">Employment type</label>
              <select id="outcome-type" className="input" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
                <option value="permanent">Permanent</option>
                <option value="contract">Contract</option>
                <option value="apprenticeship">Apprenticeship</option>
                <option value="self_employed">Self-employed</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="outcome-benefits">Formal benefits</label>
              <select id="outcome-benefits" className="input" value={benefits} onChange={(e) => setBenefits(e.target.value)}>
                <option value="yes">PF / ESI / insurance provided</option>
                <option value="no">No formal benefits</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="outcome-satisfaction">Employer satisfaction (1-5)</label>
            <input id="outcome-satisfaction" type="number" min="1" max="5" className="input" value={satisfaction} onChange={(e) => setSatisfaction(e.target.value)} />
          </div>
          {error && <p className="text-sm font-medium text-brand-red">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Saving..." : "Save outcome"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ScheduleInterviewModal({
  app,
  onClose,
}: {
  app: Application | null;
  onClose: () => void;
}) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [mode, setMode] = useState("In-person");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (app) {
      setScheduledAt("");
      setMode("In-person");
      setNotes("");
      setErr(null);
      setDone(false);
    }
  }, [app]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app) return;
    setSubmitting(true);
    setErr(null);
    try {
      await api.post(`/api/recruiter/applications/${app.id}/interview`, {
        scheduled_at: scheduledAt || null,
        mode,
        notes: notes.trim() || null,
      });
      setDone(true);
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.message : "Could not schedule interview.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={app !== null} onClose={onClose} title="Schedule interview">
      {app && (
        <>
          <p className="mb-4 text-sm text-muted">
            {app.youth_name} · {app.job_title}
          </p>
          {done ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-brand-green/12 px-4 py-3 text-sm font-semibold text-brand-greenDark">
                Interview scheduled.
              </div>
              <div className="flex justify-end">
                <button onClick={onClose} className="btn-primary">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label" htmlFor="iv-when">
                  Date &amp; time
                </label>
                <input
                  id="iv-when"
                  type="datetime-local"
                  className="input"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="iv-mode">
                  Mode
                </label>
                <select
                  id="iv-mode"
                  className="input"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                >
                  <option value="In-person">In-person</option>
                  <option value="Phone">Phone</option>
                  <option value="Video">Video</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="iv-notes">
                  Notes
                </label>
                <textarea
                  id="iv-notes"
                  className="input min-h-[70px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Venue, panel, instructions…"
                />
              </div>
              {err && <p className="text-sm font-medium text-brand-red">{err}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Scheduling…" : "Schedule"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}
