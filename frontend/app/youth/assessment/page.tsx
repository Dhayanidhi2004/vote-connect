"use client";

import { useEffect, useMemo, useState } from "react";
import { IconChart, IconCheck, IconSkill, IconSpark, IconTarget } from "@/components/icons";
import { EmptyState, IconTile, PageHeader, Spinner, StatTile } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api, ApiError } from "@/lib/api";
import type { CandidateAssessment, YouthProfile } from "@/lib/types";

const ROLES: Record<string, string[]> = {
  IT: ["Java Developer", "Backend Developer", "Software Engineer", "Data Analyst", "Full Stack Developer"],
  "Non-IT": ["Accountant", "HR", "Sales", "Electrician", "Machine Operator"],
  "General Workforce": ["Driver", "Housekeeping", "Delivery Person", "Security", "Loader / Helper"],
};

export default function YouthAssessmentPage() {
  const [profile, setProfile] = useState<YouthProfile | null>(null);
  const [assessment, setAssessment] = useState<CandidateAssessment | null>(null);
  const [category, setCategory] = useState("IT");
  const [role, setRole] = useState("Java Developer");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const toast = useToast();

  useEffect(() => {
    Promise.all([
      api.get<YouthProfile>("/api/youth/profile"),
      api.get<CandidateAssessment | null>("/api/assessments/youth/current"),
    ]).then(([currentProfile, current]) => {
      setProfile(currentProfile);
      setSelectedSkillIds(currentProfile.skills.map((item) => item.skill_id));
      setAssessment(current);
      if (current) {
        setCategory(current.category);
        setRole(current.target_role || ROLES[current.category]?.[0] || "");
        setAnswers(Object.fromEntries(current.questions.map((item) => [item.id, item.answer || ""])));
      } else {
        const initialCategory = currentProfile.candidate_category || "IT";
        setCategory(initialCategory);
        setRole(currentProfile.target_role || ROLES[initialCategory]?.[0] || "");
        setShowStart(true);
      }
    }).catch((error: Error) => toast(error.message, "error")).finally(() => setLoading(false));
  }, [toast]);

  async function start() {
    setBusy(true);
    try {
      const row = await api.post<CandidateAssessment>("/api/assessments/youth/start", {
        category, target_role: role, skill_ids: category === "IT" ? selectedSkillIds : [],
      });
      setAssessment(row);
      setAnswers({});
      setShowStart(false);
      toast("Assessment generated from your category and claimed skills", "success");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not start assessment", "error");
    } finally { setBusy(false); }
  }

  async function submit() {
    if (!assessment) return;
    setBusy(true);
    try {
      const result = await api.post<CandidateAssessment>(`/api/assessments/youth/${assessment.id}/submit`, {
        answers: assessment.questions.map((question) => ({ question_id: question.id, answer: answers[question.id] || "" })),
      });
      setAssessment(result);
      toast("Assessment scored and explainable job matches generated", "success");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not submit assessment", "error");
    } finally { setBusy(false); }
  }

  const answered = useMemo(() => assessment?.questions.filter((q) => answers[q.id]?.trim()).length || 0, [assessment, answers]);
  if (loading) return <Spinner label="Loading AI skill assessment..." />;

  if (showStart || !assessment) return (
    <div className="space-y-6">
      <PageHeader title="AI Skill Assessment" subtitle="Your real knowledge and practical skills—not only your resume—drive the score." />
      <section className="card mx-auto max-w-3xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <IconTile icon={<IconSpark />} accent="purple" />
          <div><h2 className="section-title text-xl">Start your assessment</h2><p className="text-sm text-muted">Questions adapt to the candidate category and claimed skills.</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="label">Candidate category</span><select className="input" value={category} onChange={(event) => { const value = event.target.value; setCategory(value); setRole(ROLES[value][0]); }}><option>IT</option><option>Non-IT</option><option>General Workforce</option></select></label>
          <label><span className="label">Target role</span><select className="input" value={role} onChange={(event) => setRole(event.target.value)}>{ROLES[category].map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        {category === "IT" && <div className="mt-5"><span className="label">Skills to assess</span><div className="mt-2 flex flex-wrap gap-2">{profile?.skills.map((skill) => { const active = selectedSkillIds.includes(skill.skill_id); return <button key={skill.skill_id} type="button" className={`chip ${active ? "!bg-brand-blue !text-white" : ""}`} onClick={() => setSelectedSkillIds((current) => active ? current.filter((id) => id !== skill.skill_id) : [...current, skill.skill_id])}>{skill.name} (Level {skill.level})</button>; })}</div>{!profile?.skills.length && <p className="mt-2 text-sm text-muted">Add skills in your profile first; a role-based assessment will be generated.</p>}</div>}
        <div className="mt-5 rounded-xl border border-brand-blue/15 bg-brand-blueTint p-4 text-sm text-body">
          <strong>Fairness:</strong> English grammar, degree, resume, gender, religion, caste, disability and other protected traits are not scored. General Workforce candidates receive simple, practical questions and may answer in Tamil or English.
        </div>
        <button className="btn-primary mt-5" disabled={busy} onClick={start}>{busy ? "Generating..." : "Generate assessment"}</button>
      </section>
    </div>
  );

  if (assessment.status === "completed") return <AssessmentResult assessment={assessment} onRetake={() => setShowStart(true)} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Adaptive Skill Assessment" subtitle={`${assessment.category} · ${assessment.target_role} · ${answered}/${assessment.questions.length} answered`} />
      <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand-green transition-all" style={{ width: `${assessment.questions.length ? 100 * answered / assessment.questions.length : 0}%` }} /></div>
      <div className="space-y-4">
        {assessment.questions.map((question, index) => (
          <section key={question.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2"><span className="rounded-full bg-brand-blue px-2.5 py-1 text-xs font-bold text-white">{index + 1}</span><span className="font-semibold text-ink">{question.skill}</span></div>
              <div className="flex gap-2"><span className="chip capitalize">{question.question_type}</span><span className="chip">{question.difficulty}</span></div>
            </div>
            <p className="mt-4 text-base font-medium leading-7 text-body">{question.question}</p>
            <textarea className="input mt-4 min-h-32" value={answers[question.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder={assessment.category === "General Workforce" ? "தமிழ் அல்லது English-ல் simple-ஆ answer செய்யலாம்..." : "Explain your approach, steps, example and verification..."} />
          </section>
        ))}
      </div>
      <div className="sticky bottom-4 flex justify-end"><button className="btn-primary shadow-lift" disabled={busy || answered === 0} onClick={submit}>{busy ? "AI evaluating..." : "Submit & generate matches"}</button></div>
    </div>
  );
}

function AssessmentResult({ assessment, onRetake }: { assessment: CandidateAssessment; onRetake: () => void }) {
  const top = assessment.job_matches[0];
  return <div className="space-y-6">
    <PageHeader title="Assessment Result" subtitle={`${assessment.target_role} · Completed ${assessment.completed_at ? new Date(assessment.completed_at).toLocaleDateString() : ""}`} />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatTile label="Overall Skill Score" value={`${Math.round(assessment.overall_score || 0)}%`} icon={<IconChart />} accent="blue" /><StatTile label="Knowledge Level" value={assessment.knowledge_level || "-"} icon={<IconSkill />} accent="green" /><StatTile label="Skills Assessed" value={assessment.skill_scores.length} icon={<IconCheck />} accent="purple" /><StatTile label="Best Job Match" value={top ? `${Math.round(top.overall_match_score)}%` : "-"} icon={<IconTarget />} accent="orange" /></div>
    <section className="card p-5"><div className="flex items-center justify-between"><h2 className="section-title text-xl">Skill scores</h2><button className="btn-ghost" onClick={onRetake}>Take another assessment</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{assessment.skill_scores.map((skill) => <div key={skill.id} className="rounded-xl border border-line p-4"><div className="flex justify-between"><strong>{skill.skill}</strong><span className="font-bold text-brand-blue">{Math.round(skill.score)}%</span></div><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-blue" style={{ width: `${skill.score}%` }} /></div><p className="mt-2 text-xs text-muted">{skill.knowledge_level}</p></div>)}</div></section>
    <div className="grid gap-4 lg:grid-cols-2"><ListCard title="Strengths" items={assessment.strengths} good /><ListCard title="Needs improvement" items={assessment.weak_areas} /></div>
    <section className="space-y-4"><h2 className="section-title text-xl">Recommended jobs</h2>{assessment.job_matches.length ? assessment.job_matches.map((match) => <article key={match.id} className="card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-ink">{match.job_title}</h3><p className="text-sm text-muted">{match.company}</p></div><div className="text-right"><div className="text-2xl font-black text-brand-greenDark">{Math.round(match.overall_match_score)}%</div><div className="text-sm font-semibold text-brand-blue">{match.match_level}</div></div></div>{match.mandatory_missing.length > 0 && <div className="mt-4 rounded-lg bg-brand-redTint px-3 py-2 text-sm font-semibold text-brand-red">Mandatory requirement missing: {match.mandatory_missing.join(", ")}</div>}<p className="mt-4 text-sm leading-6 text-body"><strong>Why recommended:</strong> {match.recommendation_reason}</p><div className="mt-4 grid gap-2 text-xs sm:grid-cols-3"><Metric label="Skills" value={match.skill_match} /><Metric label="Experience" value={match.experience_match} /><Metric label="Location" value={match.location_match} /><Metric label="Salary" value={match.salary_match} /><Metric label="Availability" value={match.availability_match} /><Metric label="Requirements" value={match.requirement_match} /></div>{match.gaps.length > 0 && <div className="mt-4 rounded-xl border border-brand-orange/20 bg-brand-orange/5 p-4"><strong className="text-sm text-ink">Skill gap analysis</strong>{match.gaps.map((gap) => <p key={gap.id} className="mt-2 text-sm text-body">{gap.skill}: {Math.round(gap.candidate_score)}% / required {Math.round(gap.required_score)}% · Gap {Math.round(gap.gap_percentage)}%. {gap.recommendation}</p>)}</div>}</article>) : <EmptyState icon={<IconTarget />} title="No active jobs configured" body="Matches will appear when employers configure active job requirements." />}</section>
    <div className="rounded-xl border border-brand-blue/20 bg-brand-blueTint p-4 text-sm font-medium text-body">{assessment.ai_disclaimer}</div>
  </div>;
}

function ListCard({ title, items, good = false }: { title: string; items: string[]; good?: boolean }) { return <section className="card p-5"><h2 className="section-title text-lg">{title}</h2><div className="mt-3 flex flex-wrap gap-2">{items.length ? items.map((item) => <span key={item} className={`chip ${good ? "!bg-brand-greenTint !text-brand-greenDark" : "!bg-brand-orange/10 !text-brand-orange"}`}>{item}</span>) : <span className="text-sm text-muted">None recorded</span>}</div></section>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-canvas px-3 py-2"><span className="text-muted">{label}</span><strong className="ml-2 text-ink">{Math.round(value)}%</strong></div>; }
