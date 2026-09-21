"use client";

import { useEffect, useState } from "react";
import {
  EmptyState,
  PageHeader,
  Spinner,
  VerifiedBadge,
  cx,
} from "@/components/ui";
import {
  IconBriefcase,
  IconLocation,
  IconRupee,
  IconUsers,
} from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import type { Job, Skill } from "@/lib/types";
import { Modal } from "../_components";

const EDUCATION_LEVELS = [
  "10th Pass",
  "12th Pass",
  "ITI",
  "Diploma",
  "Graduate",
  "Post Graduate",
];

function formatSalary(job: Job): string | null {
  const fmt = (n: number) => `₹${(n / 1000).toFixed(0)}k`;
  if (job.salary_min && job.salary_max)
    return `${fmt(job.salary_min)} – ${fmt(job.salary_max)}`;
  if (job.salary_min) return `from ${fmt(job.salary_min)}`;
  if (job.salary_max) return `up to ${fmt(job.salary_max)}`;
  return null;
}

export default function RecruiterJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);

  const load = () =>
    api
      .get<Job[]>("/api/recruiter/jobs")
      .then(setJobs)
      .catch((e: unknown) =>
        setError(e instanceof ApiError ? e.message : "Failed to load jobs."),
      )
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const closeJob = async (id: number) => {
    setClosingId(id);
    try {
      await api.patch(`/api/recruiter/jobs/${id}/close`);
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, status: "closed" } : j)),
      );
    } catch {
      /* ignore */
    } finally {
      setClosingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Jobs"
        subtitle="Post openings · Track applicants"
        right={
          <button onClick={() => setShowForm(true)} className="btn-primary">
            Post a job
          </button>
        }
      />

      {loading ? (
        <Spinner label="Loading jobs…" />
      ) : error ? (
        <EmptyState
          icon={<IconBriefcase width={26} height={26} />}
          title="Could not load jobs"
          body={error}
        />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<IconBriefcase width={26} height={26} />}
          title="No jobs posted yet"
          body="Create your first opening to start receiving matched candidates."
          action={
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Post a job
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const salary = formatSalary(job);
            const open = job.status === "open" || job.status === "active";
            return (
              <div key={job.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-display text-lg font-bold text-navy-800">
                        {job.title}
                      </h3>
                      <span
                        className={cx(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                          open
                            ? "bg-brand-green/12 text-brand-greenDark"
                            : "bg-line text-muted",
                        )}
                      >
                        {job.status}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                      {job.location && (
                        <span className="inline-flex items-center gap-1">
                          <IconLocation width={15} height={15} />
                          {job.location}
                        </span>
                      )}
                      {salary && (
                        <span className="inline-flex items-center gap-1">
                          <IconRupee width={15} height={15} />
                          {salary}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <IconUsers width={15} height={15} />
                        {job.applicant_count} applicant
                        {job.applicant_count === 1 ? "" : "s"}
                      </span>
                      <span>Min {job.min_experience} yr exp</span>
                    </div>
                    {job.skills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {job.skills.map((s) => (
                          <span key={s.id} className="chip">
                            {s.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {open && (
                    <button
                      onClick={() => closeJob(job.id)}
                      disabled={closingId === job.id}
                      className="btn-ghost !py-2 text-sm"
                    >
                      {closingId === job.id ? "Closing…" : "Close"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PostJobForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreated={() => {
          setShowForm(false);
          load();
        }}
      />
    </div>
  );
}

function PostJobForm({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [minExperience, setMinExperience] = useState("0");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [education, setEducation] = useState("");
  const [jdFilename, setJdFilename] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    api
      .get<Skill[]>("/api/reference/skills")
      .then(setSkills)
      .catch(() => setSkills([]));
  }, [open]);

  const toggleSkill = (id: number) =>
    setSelectedSkills((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await api.post("/api/recruiter/jobs", {
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        min_experience: Number(minExperience) || 0,
        salary_min: salaryMin ? Number(salaryMin) : null,
        salary_max: salaryMax ? Number(salaryMax) : null,
        education_required: education || null,
        jd_filename: jdFilename || null,
        skills: selectedSkills.map((skill_id) => ({ skill_id, weight: 1 })),
      });
      // reset
      setTitle("");
      setDescription("");
      setLocation("");
      setMinExperience("0");
      setSalaryMin("");
      setSalaryMax("");
      setEducation("");
      setSelectedSkills([]);
      onCreated();
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.message : "Could not post the job.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Post a job" wide>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="job-title">
            Job title
          </label>
          <input
            id="job-title"
            className="input"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Accounts Executive"
          />
        </div>

        <div>
          <label className="label" htmlFor="job-desc">
            Description
          </label>
          <textarea
            id="job-desc"
            className="input min-h-[80px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Role responsibilities, requirements…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="job-location">
              Location
            </label>
            <input
              id="job-location"
              className="input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Chennai"
            />
          </div>
          <div>
            <label className="label" htmlFor="job-exp">
              Min experience (yrs)
            </label>
            <input
              id="job-exp"
              type="number"
              min={0}
              className="input"
              value={minExperience}
              onChange={(e) => setMinExperience(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="job-smin">
              Salary min (₹)
            </label>
            <input
              id="job-smin"
              type="number"
              min={0}
              className="input"
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              placeholder="20000"
            />
          </div>
          <div>
            <label className="label" htmlFor="job-smax">
              Salary max (₹)
            </label>
            <input
              id="job-smax"
              type="number"
              min={0}
              className="input"
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              placeholder="35000"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="job-edu">
            Education required
          </label>
          <select
            id="job-edu"
            className="input"
            value={education}
            onChange={(e) => setEducation(e.target.value)}
          >
            <option value="">Any</option>
            {EDUCATION_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="label">Job description (PDF)</span>
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-line bg-canvas px-3.5 py-2.5 text-sm transition hover:border-brand-blue">
            <span className={jdFilename ? "font-medium text-ink" : "text-muted"}>
              {jdFilename || "Upload a JD PDF — youth can view it"}
            </span>
            <span className="font-semibold text-brand-blue">Browse</span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setJdFilename(e.target.files?.[0]?.name ?? "")}
            />
          </label>
        </div>

        <div>
          <span className="label">Required skills</span>
          {skills.length === 0 ? (
            <p className="text-sm text-muted">Loading skills…</p>
          ) : (
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-line bg-canvas p-3">
              {skills.map((s) => {
                const on = selectedSkills.includes(s.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => toggleSkill(s.id)}
                    aria-pressed={on}
                    className={cx(
                      "rounded-full border px-3 py-1 text-xs font-medium transition",
                      on
                        ? "border-brand-blue bg-brand-blue text-white"
                        : "border-line bg-white text-navy-700 hover:border-brand-blue",
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {err && <p className="text-sm font-medium text-brand-red">{err}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="btn-primary"
          >
            {submitting ? "Posting…" : "Post job"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
