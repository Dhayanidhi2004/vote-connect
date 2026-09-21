"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconIdCard,
  IconLocation,
  IconGradCap,
  IconBriefcase,
  IconDoc,
  IconSkill,
  IconCheck,
  IconArrowRight,
} from "@/components/icons";
import {
  IconTile,
  Spinner,
  cx,
  type Accent,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Constituency, Skill, YouthProfile } from "@/lib/types";

const EDUCATION_LEVELS = [
  "Below 12th",
  "12th Pass",
  "Diploma",
  "Graduate",
  "Post Graduate",
];

interface FormState {
  epic_number: string;
  constituency_id: number | null;
  gender: string;
  age: string;
  education_level: string;
  education_field: string;
  institution: string;
  graduation_year: string;
  experience_years: string;
  experience_title: string;
  experience_company: string;
  resume_filename: string;
  skill_ids: number[];
  consent: boolean;
}

const EMPTY: FormState = {
  epic_number: "",
  constituency_id: null,
  gender: "",
  age: "",
  education_level: "",
  education_field: "",
  institution: "",
  graduation_year: "",
  experience_years: "",
  experience_title: "",
  experience_company: "",
  resume_filename: "",
  skill_ids: [],
  consent: false,
};

const STEPS: { n: number; label: string; icon: React.ReactNode; accent: Accent }[] = [
  { n: 1, label: "Voter ID", icon: <IconIdCard />, accent: "blue" },
  { n: 2, label: "Constituency", icon: <IconLocation />, accent: "teal" },
  { n: 3, label: "Education", icon: <IconGradCap />, accent: "green" },
  { n: 4, label: "Experience", icon: <IconBriefcase />, accent: "navy" },
  { n: 5, label: "Resume", icon: <IconDoc />, accent: "purple" },
  { n: 6, label: "Skills", icon: <IconSkill />, accent: "orange" },
];

export default function YouthRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cons, sk, profile] = await Promise.all([
          api.get<Constituency[]>("/api/reference/constituencies"),
          api.get<Skill[]>("/api/reference/skills"),
          api.get<YouthProfile>("/api/youth/profile").catch(() => null),
        ]);
        if (!alive) return;
        setConstituencies(cons);
        setSkills(sk);

        const velachery = cons.find((c) => /velachery/i.test(c.name));
        setForm((f) => ({
          ...f,
          epic_number: profile?.epic_number ?? f.epic_number,
          constituency_id:
            profile?.constituency_id ?? velachery?.id ?? f.constituency_id,
          gender: profile?.gender ?? f.gender,
          age: profile?.age != null ? String(profile.age) : f.age,
          education_level: profile?.education_level ?? f.education_level,
          education_field: profile?.education_field ?? f.education_field,
          institution: profile?.institution ?? f.institution,
          graduation_year:
            profile?.graduation_year != null
              ? String(profile.graduation_year)
              : f.graduation_year,
          experience_years:
            profile && profile.experience_years
              ? String(profile.experience_years)
              : f.experience_years,
          experience_title: profile?.experience_title ?? f.experience_title,
          experience_company: profile?.experience_company ?? f.experience_company,
          resume_filename: profile?.resume_filename ?? f.resume_filename,
          skill_ids: profile?.skills?.map((s) => s.skill_id) ?? f.skill_ids,
        }));
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleSkill(id: number) {
    setForm((f) => ({
      ...f,
      skill_ids: f.skill_ids.includes(id)
        ? f.skill_ids.filter((s) => s !== id)
        : [...f.skill_ids, id],
    }));
  }

  const canNext = useMemo(() => {
    switch (step) {
      case 0:
        return form.epic_number.trim().length > 0;
      case 1:
        return form.constituency_id != null;
      case 2:
        return form.education_level.trim().length > 0;
      case 5:
        return form.skill_ids.length > 0 && form.consent;
      default:
        return true;
    }
  }, [step, form]);

  const isLast = step === STEPS.length - 1;

  async function finish() {
    setError("");
    setSaving(true);
    try {
      await api.put<YouthProfile>("/api/youth/profile", {
        epic_number: form.epic_number.trim() || null,
        constituency_id: form.constituency_id,
        gender: form.gender || null,
        age: form.age ? Number(form.age) : null,
        education_level: form.education_level || null,
        education_field: form.education_field || null,
        institution: form.institution || null,
        graduation_year: form.graduation_year ? Number(form.graduation_year) : null,
        experience_years: form.experience_years ? Number(form.experience_years) : 0,
        experience_title: form.experience_title || null,
        experience_company: form.experience_company || null,
        resume_filename: form.resume_filename || null,
        skills: form.skill_ids.map((skill_id) => ({ skill_id, level: 3 })),
        consent: true,
        complete_onboarding: true,
      });
      router.push("/youth/profile");
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not save your profile. Please try again.",
      );
      setSaving(false);
    }
  }

  function next() {
    setError("");
    if (isLast) finish();
    else setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  if (loading) return <Spinner label="Loading registration…" />;

  const current = STEPS[step];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-navy-800 font-display text-lg font-bold text-white shadow-tile">
          4
        </span>
        <div>
          <h1 className="section-title text-2xl sm:text-3xl">Youth Registration</h1>
          <p className="eyebrow mt-1 text-brand-blue">
            AI-powered, secure &amp; verified registration
          </p>
        </div>
      </div>
      <p className="mb-6 max-w-xl text-sm text-muted">
        Using Voter ID as your claimed identity to create a job-seeker profile and map
        you to your constituency.
      </p>

      {/* Step indicator */}
      <ol className="mb-6 flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={s.n} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => i <= step && setStep(i)}
                className={cx(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  active
                    ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                    : done
                      ? "border-brand-green/40 bg-brand-green/10 text-brand-greenDark"
                      : "border-line text-muted",
                )}
              >
                <span
                  className={cx(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                    active
                      ? "bg-brand-blue text-white"
                      : done
                        ? "bg-brand-green text-white"
                        : "bg-line text-muted",
                  )}
                >
                  {done ? <IconCheck width={12} height={12} /> : s.n}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <span className="hidden h-px w-3 bg-line sm:block" />
              )}
            </li>
          );
        })}
      </ol>

      {/* Progress bar */}
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-brand-blue transition-all"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="card p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <IconTile icon={current.icon} accent={current.accent} />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Step {step + 1} of {STEPS.length}
            </div>
            <h2 className="font-display text-lg font-bold text-navy-800">
              {current.label}
            </h2>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
            {error}
          </div>
        )}

        {/* Step 1: Voter ID */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="epic">
                Voter ID (EPIC number)
              </label>
              <input
                id="epic"
                className="input uppercase"
                placeholder="e.g. TNXX1234567"
                value={form.epic_number}
                onChange={(e) => set("epic_number", e.target.value.toUpperCase())}
              />
            </div>
            <p className="rounded-xl border border-dashed border-brand-blue/40 bg-brand-blue/5 px-4 py-3 text-xs text-muted">
              Captured as a claimed attribute; verification is separate. We do not
              validate this against the electoral roll at registration.
            </p>
          </div>
        )}

        {/* Step 2: Constituency + gender + age */}
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="constituency">
                Constituency
              </label>
              <select
                id="constituency"
                className="input"
                value={form.constituency_id ?? ""}
                onChange={(e) =>
                  set("constituency_id", e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Select constituency…</option>
                {constituencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.district}, {c.state}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="gender">
                Gender
              </label>
              <select
                id="gender"
                className="input"
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
              >
                <option value="">Select…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="age">
                Age
              </label>
              <input
                id="age"
                type="number"
                min={16}
                max={60}
                className="input"
                placeholder="e.g. 24"
                value={form.age}
                onChange={(e) => set("age", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step 3: Education */}
        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="edu-level">
                Education level
              </label>
              <select
                id="edu-level"
                className="input"
                value={form.education_level}
                onChange={(e) => set("education_level", e.target.value)}
              >
                <option value="">Select…</option>
                {EDUCATION_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="edu-field">
                Field of study
              </label>
              <input
                id="edu-field"
                className="input"
                placeholder="e.g. B.Com (General)"
                value={form.education_field}
                onChange={(e) => set("education_field", e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="institution">
                Institution
              </label>
              <input
                id="institution"
                className="input"
                placeholder="e.g. University of Madras"
                value={form.institution}
                onChange={(e) => set("institution", e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="grad-year">
                Graduation year
              </label>
              <input
                id="grad-year"
                type="number"
                min={1970}
                max={2035}
                className="input"
                placeholder="e.g. 2021"
                value={form.graduation_year}
                onChange={(e) => set("graduation_year", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step 4: Experience */}
        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="exp-years">
                Years of experience
              </label>
              <input
                id="exp-years"
                type="number"
                min={0}
                max={40}
                step={0.5}
                className="input"
                placeholder="e.g. 1.5"
                value={form.experience_years}
                onChange={(e) => set("experience_years", e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="exp-title">
                Most recent role
              </label>
              <input
                id="exp-title"
                className="input"
                placeholder="e.g. Sales Executive"
                value={form.experience_title}
                onChange={(e) => set("experience_title", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="exp-company">
                Company / employer
              </label>
              <input
                id="exp-company"
                className="input"
                placeholder="e.g. ABC Pvt Ltd"
                value={form.experience_company}
                onChange={(e) => set("experience_company", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step 5: Resume (mock upload) */}
        {step === 4 && (
          <div className="space-y-4">
            <label
              htmlFor="resume"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-canvas px-6 py-10 text-center transition hover:border-brand-blue/50"
            >
              <IconTile icon={<IconDoc />} accent="purple" size="lg" />
              <span className="font-display text-sm font-bold text-navy-800">
                Upload your resume
              </span>
              <span className="text-xs text-muted">
                PDF or DOCX. Click to choose a file.
              </span>
              <input
                id="resume"
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) set("resume_filename", file.name);
                }}
              />
            </label>
            {form.resume_filename && (
              <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
                <IconTile icon={<IconDoc />} accent="green" size="sm" />
                <span className="flex-1 truncate text-sm font-medium text-navy-800">
                  {form.resume_filename}
                </span>
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-red"
                  onClick={() => set("resume_filename", "")}
                >
                  Remove
                </button>
              </div>
            )}
            <p className="text-xs text-muted">
              Demo prototype: the file is not uploaded — only the filename is stored on
              your profile.
            </p>
          </div>
        )}

        {/* Step 6: Skills + consent */}
        {step === 5 && (
          <div className="space-y-5">
            <div>
              <label className="label">Select your skills</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {skills.map((s) => {
                  const active = form.skill_ids.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSkill(s.id)}
                      className={cx(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                        active
                          ? "border-brand-orange bg-brand-orange/10 text-brand-orange"
                          : "border-line text-muted hover:border-brand-orange/50",
                      )}
                    >
                      {active && <IconCheck width={13} height={13} />}
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted">
                {form.skill_ids.length} selected · AI uses these for your employability
                score and skill-gap analysis.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-brand-blue"
                checked={form.consent}
                onChange={(e) => set("consent", e.target.checked)}
              />
              <span className="text-sm text-navy-700">
                I consent to the processing of my personal data for job matching and
                skill-development recommendations, in line with the Digital Personal Data
                Protection (DPDP) Act. I can withdraw consent at any time.
              </span>
            </label>
          </div>
        )}

        {/* Nav buttons */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            className="btn-ghost"
            disabled={step === 0 || saving}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </button>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            disabled={!canNext || saving}
            onClick={next}
          >
            {saving
              ? "Saving…"
              : isLast
                ? "Finish & view profile"
                : "Continue"}
            {!saving && <IconArrowRight width={16} height={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
