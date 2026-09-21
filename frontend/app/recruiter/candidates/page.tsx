"use client";

import { useEffect, useState } from "react";
import {
  EmptyState,
  MatchBar,
  PageHeader,
  Spinner,
  cx,
} from "@/components/ui";
import { IconFilter, IconSearch, IconUsers } from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import type { Candidate, Job, Skill } from "@/lib/types";
import { Avatar, CandidateProfile, Modal } from "../_components";

const EDUCATION_LEVELS = [
  "10th Pass",
  "12th Pass",
  "ITI",
  "Diploma",
  "Graduate",
  "Post Graduate",
];

export default function CandidateSearchPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  const [selectedSkills, setSelectedSkills] = useState<number[]>([]);
  const [education, setEducation] = useState("");
  const [minExperience, setMinExperience] = useState("");
  const [jobId, setJobId] = useState("");

  const [results, setResults] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);

  useEffect(() => {
    api
      .get<Skill[]>("/api/reference/skills")
      .then(setSkills)
      .catch(() => setSkills([]));
    api
      .get<Job[]>("/api/recruiter/jobs")
      .then(setJobs)
      .catch(() => setJobs([]));
  }, []);

  const toggleSkill = (id: number) =>
    setSelectedSkills((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const hasFilters =
    selectedSkills.length > 0 ||
    education !== "" ||
    minExperience !== "" ||
    jobId !== "";

  const search = async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    selectedSkills.forEach((id) => params.append("skill_id", String(id)));
    if (education) params.set("education_level", education);
    if (minExperience) params.set("min_experience", minExperience);
    if (jobId) params.set("job_id", jobId);
    const qs = params.toString();
    try {
      const data = await api.get<Candidate[]>(
        `/api/recruiter/candidates${qs ? `?${qs}` : ""}`,
      );
      setResults(data);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Search failed.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSelectedSkills([]);
    setEducation("");
    setMinExperience("");
    setJobId("");
    setResults(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search Candidates"
        subtitle="AI matching engine · Advanced filters"
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Filter panel */}
        <aside className="card h-fit p-5">
          <div className="mb-4 flex items-center gap-2 text-navy-800">
            <IconFilter width={18} height={18} />
            <h2 className="font-display text-base font-bold">Filters</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="flt-job">
                Match against job
              </label>
              <select
                id="flt-job"
                className="input"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
              >
                <option value="">No job (rank by profile)</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="flt-edu">
                Education level
              </label>
              <select
                id="flt-edu"
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
              <label className="label" htmlFor="flt-exp">
                Min experience (yrs)
              </label>
              <input
                id="flt-exp"
                type="number"
                min={0}
                className="input"
                value={minExperience}
                onChange={(e) => setMinExperience(e.target.value)}
                placeholder="Any"
              />
            </div>

            <div>
              <span className="label">Skills</span>
              {skills.length === 0 ? (
                <p className="text-sm text-muted">Loading skills…</p>
              ) : (
                <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-line bg-canvas p-3">
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

            <div className="flex gap-2 pt-1">
              <button onClick={search} disabled={loading} className="btn-primary flex-1">
                <IconSearch width={16} height={16} />
                {loading ? "Searching…" : "Search"}
              </button>
              <button onClick={reset} className="btn-ghost">
                Reset
              </button>
            </div>
          </div>
        </aside>

        {/* Results */}
        <section>
          {loading ? (
            <Spinner label="Finding candidates…" />
          ) : error ? (
            <EmptyState
              icon={<IconUsers width={26} height={26} />}
              title="Search failed"
              body={error}
            />
          ) : results === null ? (
            <EmptyState
              icon={<IconSearch width={26} height={26} />}
              title="Search local talent"
              body="Add filters on the left and search to see AI-matched candidates from your constituency."
            />
          ) : results.length === 0 ? (
            <EmptyState
              icon={<IconUsers width={26} height={26} />}
              title="No candidates found"
              body={
                hasFilters
                  ? "Try loosening your filters for more results."
                  : "No candidates matched your search."
              }
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                {results.length} candidate{results.length === 1 ? "" : "s"} found
              </p>
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="grid-table min-w-[760px]">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Education</th>
                      <th className="num">Exp</th>
                      <th>Skills</th>
                      <th className="num">Score</th>
                      <th className="num">Match</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((c) => (
                      <tr key={c.youth_id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={c.name} />
                            <div>
                              <div className="font-semibold text-ink">{c.name}</div>
                              <div className="text-xs text-muted">{c.constituency_name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-ink">{c.education_level ?? "—"}</td>
                        <td className="num text-ink">{c.experience_years} yr</td>
                        <td>
                          <div className="flex max-w-[220px] flex-wrap gap-1">
                            {c.skills.slice(0, 3).map((s) => (
                              <span key={s} className="chip">{s}</span>
                            ))}
                            {c.skills.length > 3 && (
                              <span className="chip">+{c.skills.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="num font-semibold text-ink">{c.employability_score}</td>
                        <td className="num">
                          <MatchBar score={c.match_score} />
                        </td>
                        <td className="num">
                          <button
                            onClick={() => setSelected(c)}
                            className="font-semibold text-brand-blue hover:underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Candidate profile"
      >
        {selected && <CandidateProfile candidate={selected} />}
      </Modal>
    </div>
  );
}
