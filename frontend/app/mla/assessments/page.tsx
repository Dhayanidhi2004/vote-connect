"use client";

import { useEffect, useState } from "react";
import { IconChart, IconCheck, IconSkill, IconTarget, IconUsers } from "@/components/icons";
import { EmptyState, IconTile, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api, ApiError } from "@/lib/api";
import type { AssessmentConfig, AssessmentQueueRow, CandidateAssessment, Job } from "@/lib/types";

export default function AdminAssessmentsPage() {
  const [queue, setQueue] = useState<AssessmentQueueRow[]>([]);
  const [config, setConfig] = useState<AssessmentConfig | null>(null);
  const [detail, setDetail] = useState<CandidateAssessment | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [category, setCategory] = useState("");
  const [role, setRole] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [knowledge, setKnowledge] = useState("");
  const [minSkillScore, setMinSkillScore] = useState("");
  const [minMatchScore, setMinMatchScore] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (role) params.set("role", role);
    if (statusFilter) params.set("status_filter", statusFilter);
    if (knowledge) params.set("knowledge_level", knowledge);
    if (minSkillScore) params.set("min_skill_score", minSkillScore);
    if (minMatchScore) params.set("min_match_score", minMatchScore);
    Promise.all([
      api.get<AssessmentQueueRow[]>(`/api/assessments/admin/queue${params.size ? `?${params}` : ""}`),
      api.get<AssessmentConfig>("/api/assessments/configuration/weights"),
      api.get<Job[]>("/api/assessments/configuration/jobs"),
    ]).then(([rows, currentConfig, availableJobs]) => { setQueue(rows); setConfig(currentConfig); setJobs(availableJobs); })
      .catch((error: Error) => toast(error.message, "error")).finally(() => setLoading(false));
  }

  useEffect(load, [category, role, statusFilter, knowledge, minSkillScore, minMatchScore]);

  async function openDetail(id: number) {
    try { setDetail(await api.get<CandidateAssessment>(`/api/assessments/admin/${id}`)); }
    catch (error) { toast(error instanceof ApiError ? error.message : "Could not load assessment", "error"); }
  }

  async function saveConfig() {
    if (!config) return;
    setBusy(true);
    try { setConfig(await api.put<AssessmentConfig>("/api/assessments/configuration/weights", config)); toast("Assessment and match weights saved", "success"); }
    catch (error) { toast(error instanceof ApiError ? error.message : "Could not save configuration", "error"); }
    finally { setBusy(false); }
  }

  if (loading) return <Spinner label="Loading assessment review..." />;
  return <div className="space-y-6">
    <PageHeader title="AI Assessment Review" subtitle="AI scores and matches are advisory. Admin / Recruiter / Employer makes every final decision." />
    <section className="card p-5">
      <div className="flex items-center gap-2"><IconTile icon={<IconUsers />} accent="blue" /><div><h2 className="section-title text-xl">Candidate assessment queue</h2><p className="text-sm text-muted">Review category, skill score, knowledge level and top job match.</p></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option><option>IT</option><option>Non-IT</option><option>General Workforce</option></select>
        <input className="input" value={role} onChange={(event) => setRole(event.target.value)} placeholder="Job role" />
        <select className="input" value={knowledge} onChange={(event) => setKnowledge(event.target.value)}><option value="">All knowledge levels</option><option>Beginner / Needs Training</option><option>Basic</option><option>Intermediate</option><option>Advanced</option><option>Expert</option></select>
        <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select>
        <input className="input" type="number" min="0" max="100" value={minSkillScore} onChange={(event) => setMinSkillScore(event.target.value)} placeholder="Min skill %" />
        <input className="input" type="number" min="0" max="100" value={minMatchScore} onChange={(event) => setMinMatchScore(event.target.value)} placeholder="Min match %" />
      </div>
      {queue.length ? <div className="mt-5 overflow-x-auto"><table className="grid-table"><thead><tr><th>Candidate</th><th>Category / Role</th><th>Status</th><th className="num">Skill Score</th><th>Knowledge</th><th>Recommended Job</th><th className="num">Match</th><th /></tr></thead><tbody>{queue.map((row) => <tr key={row.assessment_id}><td className="font-semibold">{row.candidate_name}</td><td>{row.category}<div className="text-xs text-muted">{row.target_role}</div></td><td className="capitalize">{row.status.replace("_", " ")}</td><td className="num">{row.overall_score == null ? "-" : `${Math.round(row.overall_score)}%`}</td><td>{row.knowledge_level || "-"}</td><td>{row.top_job || "-"}</td><td className="num">{row.job_match_score == null ? "-" : `${Math.round(row.job_match_score)}%`}</td><td><button className="btn-ghost !min-h-8 !px-3 !py-1" onClick={() => openDetail(row.assessment_id)}>Review</button></td></tr>)}</tbody></table></div> : <EmptyState icon={<IconUsers />} title="No assessments yet" body="Completed youth assessments will appear here." />}
    </section>

    {detail && <AssessmentDetail assessment={detail} onClose={() => setDetail(null)} onVerified={() => openDetail(detail.id)} />}

    {config && <section className="card p-5"><div className="flex items-center gap-2"><IconTile icon={<IconChart />} accent="purple" /><div><h2 className="section-title text-xl">Assessment Weightage Configuration</h2><p className="text-sm text-muted">Each group must total 100%. Changes affect future scoring and matching.</p></div></div><h3 className="mt-5 font-bold text-ink">Skill assessment weights</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Weight label="MCQ / Concept" field="mcq_weight" config={config} setConfig={setConfig} /><Weight label="Scenario" field="scenario_weight" config={config} setConfig={setConfig} /><Weight label="Practical" field="practical_weight" config={config} setConfig={setConfig} /><Weight label="Coding" field="coding_weight" config={config} setConfig={setConfig} /><Weight label="Experience" field="experience_weight" config={config} setConfig={setConfig} /></div><h3 className="mt-5 font-bold text-ink">Job match weights</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Weight label="Skill assessment" field="match_skill_weight" config={config} setConfig={setConfig} /><Weight label="Experience" field="match_experience_weight" config={config} setConfig={setConfig} /><Weight label="Location" field="match_location_weight" config={config} setConfig={setConfig} /><Weight label="Salary" field="match_salary_weight" config={config} setConfig={setConfig} /><Weight label="Availability" field="match_availability_weight" config={config} setConfig={setConfig} /><Weight label="Requirement" field="match_requirement_weight" config={config} setConfig={setConfig} /><Weight label="Optional skills" field="match_optional_weight" config={config} setConfig={setConfig} /></div><button className="btn-primary mt-5" disabled={busy} onClick={saveConfig}>{busy ? "Saving..." : "Save weightages"}</button></section>}

    {config && <ThresholdConfiguration config={config} setConfig={setConfig} />}
    <JobRequirementConfiguration jobs={jobs} />
  </div>;
}

function AssessmentDetail({ assessment, onClose, onVerified }: { assessment: CandidateAssessment; onClose: () => void; onVerified: () => void }) {
  const toast = useToast();
  const [scores, setScores] = useState({ practical_test: 0, communication: 0, technical_skill: 0, job_knowledge: 0, safety_awareness: 0, problem_solving: 0 });
  async function savePractical() { try { await api.post(`/api/assessments/admin/${assessment.id}/practical`, scores); toast("Human practical verification recorded", "success"); onVerified(); } catch (error) { toast(error instanceof ApiError ? error.message : "Could not save", "error"); } }
  return <section className="card border-2 border-brand-blue/20 p-5"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Candidate assessment details</p><h2 className="section-title mt-1 text-2xl">{assessment.candidate_name}</h2><p className="text-sm text-muted">{assessment.category} · {assessment.target_role} · {assessment.knowledge_level} · {Math.round(assessment.overall_score || 0)}%</p></div><button className="btn-ghost" onClick={onClose}>Close</button></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><div><h3 className="font-bold text-ink">Question-wise performance</h3><div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{assessment.questions.map((question) => <div key={question.id} className="rounded-lg border border-line p-3"><div className="flex justify-between text-sm"><strong>{question.skill} · {question.question_type}</strong><span>{Math.round(question.score || 0)}%</span></div><p className="mt-1 text-xs text-muted">{question.ai_feedback || "Awaiting answer"}</p></div>)}</div></div><div><h3 className="font-bold text-ink">Human practical verification</h3><div className="mt-3 grid grid-cols-2 gap-3">{Object.entries(scores).map(([key, value]) => <label key={key}><span className="label capitalize">{key.replaceAll("_", " ")}</span><input className="input" type="number" min="0" max="100" value={value} onChange={(event) => setScores((current) => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}</div><button className="btn-primary mt-4" onClick={savePractical}>Record practical scores</button></div></div><div className="mt-5 rounded-xl bg-brand-blueTint p-4 text-sm text-body"><strong>Explainability:</strong> {assessment.job_matches[0]?.recommendation_reason || "Complete the assessment to generate matches."}</div></section>;
}

function Weight({ label, field, config, setConfig }: { label: string; field: keyof AssessmentConfig; config: AssessmentConfig; setConfig: (value: AssessmentConfig) => void }) { return <label><span className="label">{label} %</span><input className="input" type="number" min="0" max="100" value={config[field] as number} onChange={(event) => setConfig({ ...config, [field]: Number(event.target.value) })} /></label>; }

function ThresholdConfiguration({ config, setConfig }: { config: AssessmentConfig; setConfig: (value: AssessmentConfig) => void }) {
  return <section className="card p-5"><h2 className="section-title text-xl">Configurable score thresholds</h2><p className="mt-1 text-sm text-muted">Enter five ascending values. Use the Save weightages button above to apply both weight and threshold changes.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label><span className="label">Knowledge: start, Basic, Intermediate, Advanced, Expert</span><input className="input" value={config.knowledge_thresholds} onChange={(event) => setConfig({ ...config, knowledge_thresholds: event.target.value })} /></label><label><span className="label">Match: start, Partial, Good, Strong, Excellent</span><input className="input" value={config.match_thresholds} onChange={(event) => setConfig({ ...config, match_thresholds: event.target.value })} /></label></div></section>;
}

function JobRequirementConfiguration({ jobs }: { jobs: Job[] }) {
  const toast = useToast();
  const [jobId, setJobId] = useState(jobs[0]?.id || 0);
  const job = jobs.find((item) => item.id === jobId);
  const [notice, setNotice] = useState("30");
  const [category, setCategory] = useState("");
  const [licence, setLicence] = useState("");
  const [certificate, setCertificate] = useState("");
  const [minimums, setMinimums] = useState<Record<number, number>>({});
  async function save() { if (!job) return; try { await api.put(`/api/assessments/configuration/jobs/${job.id}`, { maximum_notice_days: notice ? Number(notice) : null, mandatory_education: Boolean(job.education_required), required_certificate: certificate || null, required_licence: licence || null, candidate_category: category || null, skills: job.skills.map((skill) => ({ skill_id: skill.id, minimum_score: minimums[skill.id] ?? 60, mandatory: true, optional: false, weightage: 1 })) }); toast("Structured job requirements saved", "success"); } catch (error) { toast(error instanceof ApiError ? error.message : "Could not save requirements", "error"); } }
  return <section className="card p-5"><div className="flex items-center gap-2"><IconTile icon={<IconTarget />} accent="orange" /><div><h2 className="section-title text-xl">Job Requirement Configuration</h2><p className="text-sm text-muted">Minimum assessed skill scores and mandatory licence/certificate rules.</p></div></div>{job ? <><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label><span className="label">Job</span><select className="input" value={jobId} onChange={(event) => { setJobId(Number(event.target.value)); setMinimums({}); }}>{jobs.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.org_name}</option>)}</select></label><label><span className="label">Candidate category</span><select className="input" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Any</option><option>IT</option><option>Non-IT</option><option>General Workforce</option></select></label><label><span className="label">Maximum notice days</span><input className="input" type="number" value={notice} onChange={(event) => setNotice(event.target.value)} /></label><label><span className="label">Required licence</span><input className="input" value={licence} onChange={(event) => setLicence(event.target.value)} placeholder="e.g. Driving Licence" /></label><label><span className="label">Required certificate</span><input className="input" value={certificate} onChange={(event) => setCertificate(event.target.value)} placeholder="Optional certificate" /></label></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{job.skills.map((skill) => <label key={skill.id} className="rounded-lg border border-line p-3"><span className="label">{skill.name} minimum %</span><input className="input" type="number" min="0" max="100" value={minimums[skill.id] ?? 60} onChange={(event) => setMinimums((current) => ({ ...current, [skill.id]: Number(event.target.value) }))} /></label>)}</div><button className="btn-primary mt-5" onClick={save}>Save job requirements</button></> : <EmptyState icon={<IconTarget />} title="No jobs available" body="Create a recruiter job first." />}</section>;
}
