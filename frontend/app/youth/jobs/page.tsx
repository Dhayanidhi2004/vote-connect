"use client";

import { useEffect, useState } from "react";
import {
  IconBriefcase,
  IconLocation,
  IconRupee,
  IconSearch,
  IconCheck,
  IconDoc,
} from "@/components/icons";
import {
  IconTile,
  SkillChip,
  MatchBar,
  VerifiedBadge,
  EmptyState,
  PageHeader,
  CtaLink,
  cx,
} from "@/components/ui";
import { SkeletonList } from "@/components/skeleton";
import { useToast } from "@/components/toast";
import { api, ApiError } from "@/lib/api";
import type { AIJobInsight, Application, Job } from "@/lib/types";

function formatSalary(min: number | null, max: number | null): string | null {
  const fmt = (n: number) =>
    n >= 100000 ? `${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L` : n.toLocaleString("en-IN");
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

function downloadJD(job: Job) {
  const lines = [
    `JOB DESCRIPTION — ${job.title}`,
    "".padEnd(48, "="),
    `Company : ${job.org_name}${job.org_industry ? ` (${job.org_industry})` : ""}`,
    `Location: ${job.location ?? "-"}`,
    `Salary  : ${formatSalary(job.salary_min, job.salary_max) ?? "Not disclosed"}`,
    `Min exp : ${job.min_experience > 0 ? `${job.min_experience} yr` : "Freshers welcome"}`,
    `Education: ${job.education_required ?? "-"}`,
    "",
    "ABOUT THE ROLE",
    job.description ?? "-",
    "",
    "REQUIRED SKILLS",
    job.skills.map((s) => `  • ${s.name}`).join("\n") || "  -",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (job.jd_filename || `${job.title.replace(/\s+/g, "_")}_JD.pdf`).replace(/\.pdf$/i, "") + ".txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function YouthJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Job | null>(null);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    api
      .get<Job[]>("/api/youth/jobs")
      .then((d) => alive && setJobs(d))
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  async function apply(job: Job) {
    setApplyingId(job.id);
    // Optimistic update
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, already_applied: true } : j)),
    );
    try {
      await api.post<Application>(`/api/youth/jobs/${job.id}/apply`);
      toast(`Applied to ${job.title}`, "success");
    } catch (e) {
      // Roll back
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, already_applied: false } : j)),
      );
      toast(
        e instanceof ApiError ? e.message : "Could not apply. Please try again.",
        "error",
      );
    } finally {
      setApplyingId(null);
    }
  }

  if (loading)
    return (
      <div className="space-y-6">
        <PageHeader title="Matched Jobs" subtitle="Ranked by how well they fit your profile" />
        <SkeletonList count={4} lines={3} />
      </div>
    );
  if (error)
    return (
      <div className="rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
        {error}
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matched Jobs"
        subtitle="Opportunities ranked by how well they fit your profile"
        eyebrowAccent="text-brand-teal"
      />

      {jobs.length === 0 ? (
        <EmptyState
          icon={<IconSearch />}
          title="No matched jobs yet"
          body="Complete your profile and add skills to unlock jobs matched to you. New roles are added regularly."
          action={<CtaLink href="/youth/profile">Review my profile</CtaLink>}
        />
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => {
            const salary = formatSalary(job.salary_min, job.salary_max);
            const applied = !!job.already_applied;
            return (
              <div key={job.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <IconTile icon={<IconBriefcase />} accent="teal" />
                    <div>
                      <h3 className="font-display text-lg font-bold text-navy-800">
                        {job.title}
                      </h3>
                      <p className="text-sm font-medium text-muted">{job.org_name}</p>
                    </div>
                  </div>
                  {job.match_score != null && (
                    <div className="text-right">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                        Match
                      </div>
                      <MatchBar score={Math.round(job.match_score)} />
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-navy-700">
                  {job.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <IconLocation width={15} height={15} className="text-muted" />
                      {job.location}
                    </span>
                  )}
                  {salary && (
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <IconRupee width={15} height={15} className="text-brand-green" />
                      {salary}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <IconBriefcase width={15} height={15} />
                    {job.min_experience > 0
                      ? `${job.min_experience}+ yrs experience`
                      : "Freshers welcome"}
                  </span>
                </div>

                {job.skills.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {job.skills.map((s) => (
                      <SkillChip key={s.id}>{s.name}</SkillChip>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setDetail(job)}
                    className="text-sm font-semibold text-brand-blue hover:underline"
                  >
                    View more
                  </button>
                  {applied ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-greenTint px-4 py-2 text-sm font-semibold text-brand-greenDark">
                      <IconCheck width={15} height={15} /> Applied
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={applyingId === job.id}
                      onClick={() => apply(job)}
                    >
                      {applyingId === job.id ? "Applying…" : "Apply now"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail && (
        <JobDetailModal
          job={detail}
          onClose={() => setDetail(null)}
          onApply={() => {
            apply(detail);
            setDetail(null);
          }}
          applying={applyingId === detail.id}
        />
      )}
    </div>
  );
}

function JobDetailModal({
  job,
  onClose,
  onApply,
  applying,
}: {
  job: Job;
  onClose: () => void;
  onApply: () => void;
  applying: boolean;
}) {
  const salary = formatSalary(job.salary_min, job.salary_max);
  const [insight, setInsight] = useState<AIJobInsight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [insightError, setInsightError] = useState("");
  const verified =
    job.org_verification_status === "verified"
      ? "verified"
      : job.org_verification_status === "pending"
        ? "pending"
        : "unverified";

  async function loadInsight() {
    setLoadingInsight(true);
    setInsightError("");
    try {
      const data = await api.post<AIJobInsight>(`/api/ai/youth/jobs/${job.id}/insight`);
      setInsight(data);
    } catch (e) {
      setInsightError(
        e instanceof ApiError ? e.message : "AI fit analysis is unavailable right now.",
      );
    } finally {
      setLoadingInsight(false);
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/40 p-4 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="card my-4 w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <IconTile icon={<IconBriefcase />} accent="teal" />
            <div>
              <h2 className="section-title text-xl">{job.title}</h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span className="font-medium text-ink">{job.org_name}</span>
                {job.org_industry && <span>· {job.org_industry}</span>}
                <VerifiedBadge status={verified} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost !px-3 !py-1.5 text-sm" aria-label="Close">✕</button>
        </div>

        {/* Company details */}
        {job.org_about && (
          <p className="mt-4 rounded-lg border border-line bg-canvas p-3 text-sm text-body">
            {job.org_about}
          </p>
        )}

        {/* Facts grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Salary (monthly)" value={salary ? `₹ ${salary}` : "—"} />
          <Fact label="Location" value={job.location ?? "—"} />
          <Fact
            label="Experience"
            value={job.min_experience > 0 ? `${job.min_experience}+ yr` : "Freshers"}
          />
          <Fact label="Education" value={job.education_required ?? "Any"} />
        </div>

        {/* Description */}
        {job.description && (
          <div className="mt-4">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              About the role
            </h3>
            <p className="text-sm leading-relaxed text-body">{job.description}</p>
          </div>
        )}

        {/* Skills */}
        {job.skills.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Required skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((s) => (
                <SkillChip key={s.id}>{s.name}</SkillChip>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-line bg-canvas p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Gemini fit analysis</h3>
              <p className="text-xs text-muted">
                Explain why this job fits, what you are missing, and what to improve next.
              </p>
            </div>
            <button type="button" className="btn-ghost" onClick={loadInsight} disabled={loadingInsight}>
              {loadingInsight ? "Analyzing..." : insight ? "Refresh AI analysis" : "Run AI analysis"}
            </button>
          </div>

          {insightError && (
            <div className="mt-3 rounded-lg bg-brand-red/10 px-3 py-2 text-sm text-brand-red">
              {insightError}
            </div>
          )}

          {insight && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <InsightList title="Summary" items={[insight.summary]} />
              <InsightList title="Why you fit" items={insight.fit_reasons} />
              <InsightList title="Missing skills" items={insight.missing_skills} />
              <InsightList title="Next steps" items={insight.next_steps} />
              {insight.caution && (
                <div className="rounded-lg border border-brand-orange/30 bg-brand-orange/5 px-3 py-2 text-sm text-brand-orange md:col-span-2">
                  {insight.caution}
                </div>
              )}
            </div>
          )}
        </div>

        {/* JD + apply */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          {job.jd_filename ? (
            <button
              onClick={() => downloadJD(job)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-blue hover:underline"
            >
              <IconDoc width={16} height={16} /> {job.jd_filename}
            </button>
          ) : (
            <span className="text-sm text-muted">No job description attached.</span>
          )}
          {job.already_applied ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-greenTint px-4 py-2 text-sm font-semibold text-brand-greenDark">
              <IconCheck width={15} height={15} /> Applied
            </span>
          ) : (
            <button className="btn-primary" disabled={applying} onClick={onApply}>
              {applying ? "Applying…" : "Apply now"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-body">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-blue" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-canvas p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={cx("mt-0.5 text-sm font-semibold text-ink")}>{value}</div>
    </div>
  );
}
