"use client";

import { useEffect, useState } from "react";
import { IconBriefcase, IconChart, IconTarget, IconUsers } from "@/components/icons";
import { EmptyState, IconTile, PageHeader, Spinner, StatTile } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { DemandForecast, EmployerSupportRequest, SkillSupplyGap } from "@/lib/types";

export default function RecruiterInsightsPage() {
  const [gaps, setGaps] = useState<SkillSupplyGap[]>([]);
  const [forecasts, setForecasts] = useState<DemandForecast[]>([]);
  const [requests, setRequests] = useState<EmployerSupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestType, setRequestType] = useState("job_description");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<SkillSupplyGap[]>("/api/ecosystem/recruiter/skill-supply-gap"),
      api.get<DemandForecast[]>("/api/ecosystem/recruiter/forecasts"),
      api.get<EmployerSupportRequest[]>("/api/ecosystem/recruiter/support"),
    ]).then(([supply, demand, support]) => {
      setGaps(supply); setForecasts(demand); setRequests(support);
    }).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, []);

  async function submitSupport(event: React.FormEvent) {
    event.preventDefault(); setSubmitting(true);
    try {
      const row = await api.post<EmployerSupportRequest>("/api/ecosystem/recruiter/support", { request_type: requestType, description });
      setRequests((current) => [row, ...current]); setDescription("");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not submit request");
    } finally { setSubmitting(false); }
  }

  if (loading) return <Spinner label="Calculating employer skill gaps..." />;
  if (error && !gaps.length) return <EmptyState icon={<IconChart />} title="Insights unavailable" body={error} />;
  const shortage = gaps.reduce((sum, row) => sum + row.shortage, 0);

  return <div className="space-y-6">
    <PageHeader title="Employer Skill-Gap Analytics" subtitle="Validate demand before training and reduce time-to-hire with constituency talent supply." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile label="Required Skills" value={gaps.length} icon={<IconTarget />} accent="blue" />
      <StatTile label="Estimated Shortage" value={shortage} icon={<IconUsers />} accent="orange" />
      <StatTile label="Rising Forecasts" value={forecasts.filter((row) => row.trend === "rising").length} icon={<IconChart />} accent="purple" />
      <StatTile label="Service Requests" value={requests.length} icon={<IconBriefcase />} accent="green" />
    </div>

    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2"><IconTile icon={<IconTarget />} accent="orange" size="sm" /><h2 className="section-title text-xl">Demand vs Verified Youth Supply</h2></div>
      {gaps.length === 0 ? <EmptyState icon={<IconTarget />} title="Post an active job to calculate gaps" body="Required skills will be compared with verified constituency youth supply." /> :
        <div className="overflow-x-auto"><table className="grid-table"><thead><tr><th>Skill</th><th className="num">Job Demand</th><th className="num">Youth Supply</th><th className="num">Shortage</th><th>Recommended Action</th></tr></thead><tbody>{gaps.map((row) => <tr key={row.skill_id}><td className="font-semibold">{row.skill_name}</td><td className="num">{row.openings}</td><td className="num">{row.available_youth}</td><td className="num font-semibold text-brand-orange">{row.shortage}</td><td>{row.shortage > 0 ? "Sponsor a practical course/apprenticeship and widen verified local search." : "Supply is healthy; begin targeted screening."}</td></tr>)}</tbody></table></div>}
    </section>

    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2"><IconTile icon={<IconChart />} accent="purple" size="sm" /><h2 className="section-title text-xl">Six-Month District Forecast</h2></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{forecasts.slice(0, 8).map((row) => <div key={row.skill_id} className="rounded-xl border border-line p-4"><div className="font-semibold text-ink">{row.skill_name}</div><div className="mt-2 flex items-end justify-between"><div><div className="text-xs text-muted">Forecast index</div><div className="font-display text-2xl font-bold text-navy-800">{row.forecast_6m}</div></div><span className="rounded-full bg-brand-greenTint px-2 py-1 text-xs font-semibold capitalize text-brand-greenDark">{row.trend}</span></div><p className="mt-2 text-xs text-muted">{row.shortage_roles} shortage roles expected</p></div>)}</div>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={submitSupport} className="card p-5"><h2 className="section-title text-xl">MSME Employer Service Desk</h2><p className="mt-1 text-sm text-muted">Help with job descriptions, screening, apprenticeships, or local job fairs.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="support-type">Support type</label><select id="support-type" className="input" value={requestType} onChange={(event) => setRequestType(event.target.value)}><option value="job_description">Job description</option><option value="screening">Candidate screening</option><option value="apprenticeship">Apprenticeship design</option><option value="job_fair">Local job fair</option></select></div><div><label className="label" htmlFor="support-description">Requirement</label><input id="support-description" className="input" required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the hiring challenge" /></div></div><button className="btn-primary mt-4" disabled={submitting}>{submitting ? "Submitting..." : "Request employer support"}</button></form>
      <div className="card p-5"><h2 className="section-title text-xl">Request Status</h2><div className="mt-4 space-y-3">{requests.length === 0 && <p className="text-sm text-muted">No service requests yet.</p>}{requests.map((row) => <div key={row.id} className="rounded-xl border border-line p-3"><div className="flex justify-between gap-3"><span className="text-sm font-semibold capitalize text-ink">{row.request_type.replace("_", " ")}</span><span className="text-xs font-semibold uppercase text-brand-blue">{row.status}</span></div><p className="mt-1 text-xs text-muted">{row.description}</p></div>)}</div></div>
    </section>
  </div>;
}
