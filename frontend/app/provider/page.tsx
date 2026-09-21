"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  IconTile,
  PageHeader,
  StatTile,
  VerifiedBadge,
} from "@/components/ui";
import { Skeleton } from "@/components/skeleton";
import { useToast } from "@/components/toast";
import {
  IconCheck,
  IconDoc,
  IconGradCap,
  IconTarget,
} from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import type { Skill, TrainingProgram } from "@/lib/types";

const PROGRAM_TYPES = [
  { value: "course", label: "Course" },
  { value: "certification", label: "Certification" },
  { value: "apprenticeship", label: "Apprenticeship" },
  { value: "scheme", label: "Scheme" },
] as const;

function statusOf(p: TrainingProgram): "pending" | "verified" | "rejected" {
  const s = (p.verification_status || "pending").toLowerCase();
  if (s === "verified") return "verified";
  if (s === "rejected") return "rejected";
  return "pending";
}

function StatusBadge({ program }: { program: TrainingProgram }) {
  const status = statusOf(program);
  if (status === "verified") return <VerifiedBadge status="verified" />;
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-redTint px-2.5 py-1 text-xs font-semibold text-brand-red">
        Not approved
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-orangeTint px-2.5 py-1 text-xs font-semibold text-brand-orange">
      Pending review
    </span>
  );
}

export default function ProviderConsolePage() {
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api
      .get<TrainingProgram[]>("/api/provider/programs")
      .then((rows) => {
        setPrograms(rows);
        setError(null);
      })
      .catch((e: unknown) =>
        setError(
          e instanceof ApiError ? e.message : "Failed to load your courses.",
        ),
      )
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    let verified = 0;
    let pending = 0;
    for (const p of programs) {
      const s = statusOf(p);
      if (s === "verified") verified++;
      else if (s === "pending") pending++;
    }
    return { total: programs.length, verified, pending };
  }, [programs]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Courses"
        subtitle="Submit courses & certifications for MLA verification"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          label="Total submitted"
          value={stats.total}
          accent="green"
          icon={<IconGradCap width={18} height={18} />}
        />
        <StatTile
          label="Verified"
          value={stats.verified}
          accent="blue"
          icon={<IconCheck width={18} height={18} />}
        />
        <StatTile
          label="Pending"
          value={stats.pending}
          accent="orange"
          icon={<IconTarget width={18} height={18} />}
        />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <SubmitCourseForm onCreated={load} />

        <section className="min-w-0 space-y-4">
          <div className="rounded-xl border border-brand-blueTint bg-brand-blueTint/40 px-4 py-3 text-sm text-navy-700">
            Submitted courses stay in <strong>pending review</strong> until the
            MLA verifies them. Once verified, they become visible to youth as
            recommended training.
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="card space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={<IconDoc width={26} height={26} />}
              title="Could not load your courses"
              body={error}
            />
          ) : programs.length === 0 ? (
            <EmptyState
              icon={<IconGradCap width={26} height={26} />}
              title="No courses submitted yet"
              body="Use the form to submit your first course or certification. It will appear here awaiting MLA verification."
            />
          ) : (
            <div className="max-w-full overflow-x-auto rounded-lg border border-line">
              <table className="grid-table min-w-[620px]">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Type</th>
                    <th>Target skill</th>
                    <th>Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {programs.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.url ? (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-ink hover:text-brand-blue hover:underline"
                          >
                            {p.title}
                          </a>
                        ) : (
                          <span className="font-semibold text-ink">{p.title}</span>
                        )}
                      </td>
                      <td className="capitalize text-ink">{p.program_type}</td>
                      <td className="text-ink">{p.target_skill_name ?? "—"}</td>
                      <td className="text-muted">{p.duration ?? "—"}</td>
                      <td><StatusBadge program={p} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SubmitCourseForm({ onCreated }: { onCreated: () => void }) {
  const toast = useToast();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [title, setTitle] = useState("");
  const [programType, setProgramType] = useState<string>("course");
  const [targetSkillId, setTargetSkillId] = useState<string>("");
  const [duration, setDuration] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<Skill[]>("/api/reference/skills")
      .then(setSkills)
      .catch(() => setSkills([]));
  }, []);

  const reset = () => {
    setTitle("");
    setProgramType("course");
    setTargetSkillId("");
    setDuration("");
    setUrl("");
    setDescription("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        program_type: programType,
      };
      if (targetSkillId) body.target_skill_id = Number(targetSkillId);
      if (duration.trim()) body.duration = duration.trim();
      if (url.trim()) body.url = url.trim();
      if (description.trim()) body.description = description.trim();

      await api.post("/api/provider/programs", body);
      toast("Course submitted for verification");
      reset();
      onCreated();
    } catch (e: unknown) {
      toast(
        e instanceof ApiError ? e.message : "Could not submit the course.",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="card min-w-0 max-w-full h-fit space-y-4 p-5 lg:sticky lg:top-20">
      <div className="flex items-center gap-3">
        <IconTile icon={<IconGradCap width={20} height={20} />} accent="green" />
        <div>
          <h2 className="font-display text-base font-bold text-navy-800">
            Submit a course
          </h2>
          <p className="text-xs text-muted">Sent to the MLA for verification</p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="p-title">
          Title
        </label>
        <input
          id="p-title"
          className="input"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Full-Stack Web Development"
        />
      </div>

      <div>
        <label className="label" htmlFor="p-type">
          Program type
        </label>
        <select
          id="p-type"
          className="input"
          value={programType}
          onChange={(e) => setProgramType(e.target.value)}
        >
          {PROGRAM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="p-skill">
          Target skill
        </label>
        <select
          id="p-skill"
          className="input"
          value={targetSkillId}
          onChange={(e) => setTargetSkillId(e.target.value)}
        >
          <option value="">No specific skill</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="p-duration">
          Duration
        </label>
        <input
          id="p-duration"
          className="input"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="e.g. 6 weeks"
        />
      </div>

      <div>
        <label className="label" htmlFor="p-url">
          Link / URL
        </label>
        <input
          id="p-url"
          type="url"
          className="input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>

      <div>
        <label className="label" htmlFor="p-desc">
          Description
        </label>
        <textarea
          id="p-desc"
          className="input min-h-[80px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What youth will learn, eligibility, outcomes…"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !title.trim()}
        className="btn-primary w-full"
      >
        {submitting ? "Submitting…" : "Submit for verification"}
      </button>
    </form>
  );
}
