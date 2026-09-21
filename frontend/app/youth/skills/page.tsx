"use client";

import { useEffect, useState } from "react";
import {
  IconSkill,
  IconChart,
  IconTarget,
  IconGradCap,
  IconSpark,
} from "@/components/icons";
import {
  IconTile,
  SkillChip,
  Spinner,
  EmptyState,
  PageHeader,
  StatTile,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { api, ApiError } from "@/lib/api";
import type {
  AICareerPlan,
  Job,
  SkillGap,
  TrainingEnrollment,
  TrainingProgram,
} from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  course: "Course",
  certification: "Certification",
  apprenticeship: "Apprenticeship",
  scheme: "Government Scheme",
};

export default function YouthSkillsPage() {
  const [data, setData] = useState<SkillGap | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [busyProgram, setBusyProgram] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [careerPlan, setCareerPlan] = useState<AICareerPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get<SkillGap>("/api/youth/skill-gap"),
      api.get<Job[]>("/api/youth/jobs"),
      api.get<TrainingEnrollment[]>("/api/youth/training-enrollments"),
    ])
      .then(([gap, matchedJobs, learning]) => {
        if (!alive) return;
        setData(gap);
        setJobs(matchedJobs);
        setEnrollments(learning);
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  async function generatePlan() {
    setLoadingPlan(true);
    try {
      const plan = await api.post<AICareerPlan>("/api/ai/youth/coach");
      setCareerPlan(plan);
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : "AI plan could not be generated right now.",
        "error",
      );
    } finally {
      setLoadingPlan(false);
    }
  }

  async function enroll(program: TrainingProgram) {
    setBusyProgram(program.id);
    try {
      const row = await api.post<TrainingEnrollment>("/api/youth/training-enrollments", {
        program_id: program.id,
      });
      setEnrollments((current) => [row, ...current]);
      toast(`Enrolled in ${program.title}`, "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not enroll", "error");
    } finally {
      setBusyProgram(null);
    }
  }

  async function updateProgress(
    enrollment: TrainingEnrollment,
    body: Record<string, unknown>,
  ) {
    setBusyProgram(enrollment.program_id);
    try {
      const updated = await api.patch<TrainingEnrollment>(
        `/api/youth/training-enrollments/${enrollment.id}`,
        body,
      );
      setEnrollments((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      toast(updated.status === "completed" ? "Learning outcome recorded" : "Progress updated", "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not update progress", "error");
    } finally {
      setBusyProgram(null);
    }
  }

  if (loading) return <Spinner label="Analyzing your skills..." />;
  if (error) {
    return (
      <div className="rounded-xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const topGap = data.gap_skills[0]?.name ?? "No major gap";
  const currentSkillNames = new Set(data.current_skills.map((skill) => skill.name));
  const recommendationsBySkill = new Map(
    data.recommendations.map((rec) => [rec.skill_name ?? "", rec.programs]),
  );
  const recommendedPrograms = uniquePrograms(
    data.recommendations.flatMap((recommendation) => recommendation.programs),
  );
  const enrollmentByProgram = new Map(
    enrollments.map((enrollment) => [enrollment.program_id, enrollment]),
  );
  const targetRoles = jobs
    .filter((job) => (job.match_score ?? 0) >= 45)
    .slice(0, 5)
    .map((job) => {
      const missingSkills = job.skills
        .map((skill) => skill.name)
        .filter((name) => !currentSkillNames.has(name));
      const suggestedPrograms = uniquePrograms(
        missingSkills.flatMap((skillName) => recommendationsBySkill.get(skillName) ?? []),
      );
      return {
        id: job.id,
        title: job.title,
        company: job.org_name,
        matchScore: Math.round(job.match_score ?? 0),
        missingSkills,
        suggestedPrograms,
      };
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skill Development & AI Recommendations"
        subtitle="Review your current skills, demand gap, and mapped learning options."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatTile
          label="Current Skills"
          value={data.current_skills.length}
          icon={<IconSkill />}
          accent="blue"
        />
        <StatTile
          label="Demand Skills"
          value={data.demand_skills.length}
          icon={<IconChart />}
          accent="green"
        />
        <StatTile
          label="Gap Skills"
          value={data.gap_skills.length}
          icon={<IconTarget />}
          accent="orange"
        />
        <StatTile
          label="Top Gap"
          value={topGap}
          icon={<IconGradCap />}
          accent="purple"
        />
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <IconTile icon={<IconSpark width={18} height={18} />} accent="purple" size="sm" />
              <h2 className="section-title text-xl">Gemini Career Coach</h2>
            </div>
            <p className="text-sm text-muted">
              Generate a short action plan based on your skill gaps and available programs.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={generatePlan}
            disabled={loadingPlan}
          >
            {loadingPlan ? "Generating..." : careerPlan ? "Refresh AI plan" : "Generate AI plan"}
          </button>
        </div>

        {careerPlan ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <SimpleInfoCard title="Summary" value={careerPlan.summary} />
            <SimpleListCard title="Suggested Roles" items={careerPlan.suggested_roles} />
            <SimpleListCard title="Strengths" items={careerPlan.strengths} />
            <SimpleListCard title="Priority Gaps" items={careerPlan.gap_priorities} />
            <SimpleListCard title="Next Steps" items={careerPlan.next_steps} className="lg:col-span-2" />
            {careerPlan.caution && (
              <div className="rounded-lg border border-brand-orange/30 bg-brand-orange/5 px-4 py-3 text-sm text-brand-orange lg:col-span-2">
                {careerPlan.caution}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-line px-4 py-4 text-sm text-muted">
            No AI plan generated yet.
          </div>
        )}
      </section>

      <section className="card p-5">
        <div className="mb-1 flex items-center gap-2">
          <IconTile icon={<IconGradCap width={18} height={18} />} accent="green" size="sm" />
          <h2 className="section-title text-xl">My Learning &amp; Work-Experience Journey</h2>
        </div>
        <p className="mb-5 text-sm text-muted">
          Move from a recommendation to assessed learning, practical experience, and a verified skill.
        </p>

        {enrollments.length > 0 && (
          <div className="mb-6 grid gap-3 lg:grid-cols-2">
            {enrollments.map((enrollment) => (
              <LearningCard
                key={enrollment.id}
                enrollment={enrollment}
                busy={busyProgram === enrollment.program_id}
                onUpdate={updateProgress}
              />
            ))}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recommendedPrograms.slice(0, 6).map((program) => {
            const enrollment = enrollmentByProgram.get(program.id);
            return (
              <div key={program.id} className="rounded-xl border border-line bg-canvas p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                  {TYPE_LABEL[program.program_type] ?? program.program_type}
                </div>
                <h3 className="mt-1 font-semibold text-ink">{program.title}</h3>
                <p className="mt-1 text-xs text-muted">
                  {[program.provider, program.duration].filter(Boolean).join(" · ")}
                </p>
                <button
                  type="button"
                  className="btn-primary mt-4 w-full !py-2"
                  disabled={Boolean(enrollment) || busyProgram === program.id}
                  onClick={() => enroll(program)}
                >
                  {enrollment ? `Status: ${enrollment.status.replace("_", " ")}` : "Enroll"}
                </button>
              </div>
            );
          })}
        </div>
        {recommendedPrograms.length === 0 && enrollments.length === 0 && (
          <EmptyState
            icon={<IconGradCap />}
            title="No verified program mapped yet"
            body="Your district skill gaps are ready; a verified provider program will appear here when mapped."
          />
        )}
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <IconTile icon={<IconTarget width={18} height={18} />} accent="orange" size="sm" />
          <h2 className="section-title text-xl">Role-Based Learning Path</h2>
        </div>

        <p className="mb-4 text-sm text-muted">
          Recommendations below are not for the whole market. They are narrowed to the roles and
          companies you are currently closest to, based on the skills each role still needs.
        </p>

        {targetRoles.length === 0 ? (
          <EmptyState
            icon={<IconTarget />}
            title="No target roles available yet"
            body="Once job matches are available, this section will show company-wise missing skills and the relevant programs only."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Target Role</th>
                  <th>Company</th>
                  <th className="num">Match</th>
                  <th>Missing Skills for This Role</th>
                  <th>Recommended Courses for This Role</th>
                </tr>
              </thead>
              <tbody>
                {targetRoles.map((role) => (
                  <tr key={role.id}>
                    <td>{role.title}</td>
                    <td>{role.company}</td>
                    <td className="num">{role.matchScore}%</td>
                    <td>
                      {role.missingSkills.length ? (
                        <div className="flex flex-wrap gap-2">
                          {role.missingSkills.map((skill) => (
                            <SkillChip key={`${role.id}-${skill}`}>{skill}</SkillChip>
                          ))}
                        </div>
                      ) : (
                        "No major gap"
                      )}
                    </td>
                    <td>
                      {role.suggestedPrograms.length ? (
                        <div className="space-y-2">
                          {role.suggestedPrograms.slice(0, 3).map((program) => (
                            <div key={`${role.id}-${program.id}`} className="text-sm">
                              <div className="font-semibold text-ink">{program.title}</div>
                              <div className="text-xs text-muted">
                                {(TYPE_LABEL[program.program_type] ?? program.program_type)}
                                {program.provider ? ` · ${program.provider}` : ""}
                                {program.duration ? ` · ${program.duration}` : ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        "No mapped course yet"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SimpleInfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-canvas p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      <p className="text-sm leading-6 text-body">{value}</p>
    </div>
  );
}

function SimpleListCard({
  title,
  items,
  className,
}: {
  title: string;
  items: string[];
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-line bg-canvas p-4 ${className ?? ""}`}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-body">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-blue" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function uniquePrograms(programs: TrainingProgram[]) {
  const seen = new Set<number>();
  return programs.filter((program) => {
    if (seen.has(program.id)) return false;
    seen.add(program.id);
    return true;
  });
}

function LearningCard({
  enrollment,
  busy,
  onUpdate,
}: {
  enrollment: TrainingEnrollment;
  busy: boolean;
  onUpdate: (enrollment: TrainingEnrollment, body: Record<string, unknown>) => void;
}) {
  const [score, setScore] = useState(enrollment.assessment_score?.toString() ?? "");
  const [experience, setExperience] = useState(
    enrollment.work_experience_kind ?? (enrollment.program_type === "apprenticeship" ? "apprenticeship" : "project"),
  );
  const completed = enrollment.status === "completed";

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-greenDark">
            {TYPE_LABEL[enrollment.program_type] ?? enrollment.program_type}
          </div>
          <h3 className="mt-1 font-semibold text-ink">{enrollment.program_title}</h3>
          <p className="text-xs text-muted">{enrollment.provider ?? "Verified training provider"}</p>
        </div>
        <span className="rounded-full bg-brand-blueTint px-2.5 py-1 text-xs font-semibold capitalize text-brand-blue">
          {enrollment.status.replace("_", " ")}
        </span>
      </div>

      {completed ? (
        <div className="mt-4 rounded-lg bg-brand-greenTint px-3 py-2 text-sm text-brand-greenDark">
          Assessment: <strong>{enrollment.assessment_score ?? "Recorded"}</strong>
          {enrollment.practical_component && ` · ${enrollment.work_experience_kind ?? "Practical work"}`}
        </div>
      ) : enrollment.status === "enrolled" ? (
        <button
          type="button"
          className="btn-primary mt-4 !py-2"
          disabled={busy}
          onClick={() => onUpdate(enrollment, { status: "in_progress" })}
        >
          Start learning
        </button>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor={`score-${enrollment.id}`}>Assessment %</label>
            <input
              id={`score-${enrollment.id}`}
              type="number"
              min="0"
              max="100"
              className="input !py-2"
              value={score}
              onChange={(event) => setScore(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor={`experience-${enrollment.id}`}>Practical component</label>
            <select
              id={`experience-${enrollment.id}`}
              className="input !py-2"
              value={experience}
              onChange={(event) => setExperience(event.target.value)}
            >
              <option value="project">Employer project</option>
              <option value="internship">Internship</option>
              <option value="apprenticeship">Apprenticeship</option>
              <option value="simulation">Work simulation</option>
            </select>
          </div>
          <button
            type="button"
            className="btn-primary !py-2"
            disabled={busy || score === ""}
            onClick={() => onUpdate(enrollment, {
              status: "completed",
              assessment_score: Number(score),
              practical_component: true,
              work_experience_kind: experience,
            })}
          >
            Complete
          </button>
        </div>
      )}
    </div>
  );
}
