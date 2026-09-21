"use client";

import { useEffect, useState } from "react";
import { IconChart, IconCheck, IconGradCap, IconRupee, IconTarget, IconUsers } from "@/components/icons";
import { EmptyState, IconTile, PageHeader, Spinner, StatTile } from "@/components/ui";
import { api } from "@/lib/api";
import type { OutcomeDashboard, PolicyRecommendation } from "@/lib/types";


export default function OutcomesPage() {
  const [data, setData] = useState<OutcomeDashboard | null>(null);
  const [error, setError] = useState("");
  const [policy, setPolicy] = useState<PolicyRecommendation[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<OutcomeDashboard>("/api/admin/outcomes"),
      api.get<PolicyRecommendation[]>("/api/ecosystem/admin/policy-recommendations"),
    ])
      .then(([outcomes, recommendations]) => { setData(outcomes); setPolicy(recommendations); })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) {
    return <EmptyState icon={<IconChart />} title="Outcome data unavailable" body={error} />;
  }
  if (!data) return <Spinner label="Measuring sustainable employment outcomes..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outcome & Retention Dashboard"
        subtitle="Measure job quality, wage progression, training impact, and 3/6/12-month retention - not registrations alone."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Joined Placements" value={data.placements} icon={<IconUsers />} accent="blue" />
        <StatTile label="Offer-to-Joining" value={`${data.joining_rate}%`} icon={<IconCheck />} accent="green" />
        <StatTile label="Median Starting Salary" value={formatRupees(data.median_starting_salary)} icon={<IconRupee />} accent="orange" />
        <StatTile label="Time to Placement" value={`${data.average_time_to_placement_days} days`} icon={<IconTarget />} accent="purple" />
      </div>

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-2">
          <IconTile icon={<IconChart width={18} height={18} />} accent="blue" size="sm" />
          <div><h2 className="section-title text-xl">Complete Goal & Result KPI Framework</h2><p className="text-sm text-muted">Access, guidance, matching, employment quality, inclusion, and ecosystem performance.</p></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Metric label="Registration conversion" value={`${data.registration_conversion}%`} />
          <Metric label="Average current salary" value={formatRupees(data.average_salary)} />
          <Metric label="Interview conversion" value={`${data.interview_conversion}%`} />
          <Metric label="Employer response time" value={`${data.employer_response_days} days`} />
          <Metric label="Skill mismatch rate" value={`${data.skill_mismatch_rate}%`} />
          <Metric label="Entrepreneurship created" value={data.entrepreneurship_created.toLocaleString("en-IN")} />
          <Metric label="Rural coverage" value={`${data.rural_coverage}%`} />
          <Metric label="Assisted-access share" value={`${data.assisted_access_share}%`} />
          <Metric label="Differently-abled participation" value={`${data.differently_abled_participation}%`} />
          <Metric label="Active mentorships" value={data.active_mentorships.toLocaleString("en-IN")} />
          <Metric label="Reminder completion" value={`${data.reminder_completion_rate}%`} />
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-2">
          <IconTile icon={<IconTarget width={18} height={18} />} accent="teal" size="sm" />
          <div>
            <h2 className="section-title text-xl">Sustained Employment</h2>
            <p className="text-sm text-muted">Retention milestones and progression after joining.</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <RetentionBar label="3-month retention" value={data.retention_3m} />
          <RetentionBar label="6-month retention" value={data.retention_6m} />
          <RetentionBar label="12-month retention" value={data.retention_12m} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Average wage growth" value={`${data.average_wage_growth}%`} />
          <Metric label="Role-skill match" value={`${data.role_skill_match}/5`} />
          <Metric label="Candidate satisfaction" value={`${data.candidate_satisfaction}/5`} />
          <Metric label="Employer satisfaction" value={`${data.employer_satisfaction}/5`} />
          <Metric label="Formal benefits coverage" value={`${data.formal_benefits_coverage}%`} />
          <Metric label="Women placement share" value={`${data.women_placement_share}%`} />
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-2"><IconTile icon={<IconTarget />} accent="orange" size="sm" /><div><h2 className="section-title text-xl">Continuous Policy Optimisation</h2><p className="text-sm text-muted">Live gaps and outcomes translated into prioritised constituency actions.</p></div></div>
        <div className="grid gap-3 lg:grid-cols-2">{policy.map((item) => <article key={item.title} className="rounded-xl border border-line p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-ink">{item.title}</h3><span className="rounded-full bg-brand-orange/10 px-2 py-1 text-xs font-semibold uppercase text-brand-orange">{item.priority}</span></div><p className="mt-2 text-sm text-muted"><strong className="text-ink">Evidence:</strong> {item.evidence}</p><p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-sm text-body"><strong>Action:</strong> {item.action}</p></article>)}</div>
      </section>

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-2">
          <IconTile icon={<IconGradCap width={18} height={18} />} accent="purple" size="sm" />
          <div>
            <h2 className="section-title text-xl">Training ROI & Work-Based Learning</h2>
            <p className="text-sm text-muted">Separate demonstrated competency from course enrolment.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Training enrolments" value={data.training_enrollments.toLocaleString("en-IN")} />
          <Metric label="Completion rate" value={`${data.training_completion_rate}%`} />
          <Metric label="Average assessment" value={`${data.average_assessment_score}%`} />
          <Metric label="Work-based learning" value={`${data.work_based_learning_share}%`} />
        </div>
        <p className="mt-4 rounded-lg bg-canvas px-4 py-3 text-sm text-muted">
          Work-based learning includes employer projects, internships, apprenticeships, and supervised simulations.
        </p>
      </section>
    </div>
  );
}


function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-canvas p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-2 font-display text-2xl font-bold text-navy-800">{value}</div>
    </div>
  );
}


function RetentionBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-center justify-between text-sm font-semibold text-ink">
        <span>{label}</span>
        <span className="tnum text-brand-greenDark">{value}%</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-brand-green" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}


function formatRupees(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
