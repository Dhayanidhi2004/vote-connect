"use client";

import { useEffect, useState } from "react";
import {
  IconBriefcase,
  IconCalendar,
  IconChart,
  IconCheck,
  IconSpark,
  IconTarget,
  IconUsers,
} from "@/components/icons";
import { EmptyState, IconTile, PageHeader, Spinner, StatTile, cx } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type {
  CareerAssessment,
  EcosystemOverview,
  EmploymentOpportunity,
  Mentorship,
  OpportunityApplication,
  Reminder,
} from "@/lib/types";
import { useToast } from "@/components/toast";


const CATEGORY_LABELS: Record<string, string> = {
  internship: "Internship",
  apprenticeship: "Apprenticeship",
  rural_job: "Rural Job",
  gig: "Verified Gig",
  startup: "Startup",
  self_employment: "Self-employment",
};


export default function CareerPathwayPage() {
  const [data, setData] = useState<EcosystemOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | string | null>(null);
  const [filter, setFilter] = useState("all");
  const toast = useToast();

  function load() {
    setLoading(true);
    api.get<EcosystemOverview>("/api/ecosystem/youth/overview")
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function saveAssessment(body: Record<string, unknown>) {
    setBusy("assessment");
    try {
      const assessment = await api.put<CareerAssessment>("/api/ecosystem/youth/assessment", body);
      setData((current) => current ? { ...current, assessment } : current);
      toast("Personalised pathway generated", "success");
      load();
    } catch (reason) {
      toast(reason instanceof ApiError ? reason.message : "Could not save assessment", "error");
    } finally {
      setBusy(null);
    }
  }

  async function requestMentor(mentorId: number, goal: string) {
    setBusy(`mentor-${mentorId}`);
    try {
      const mentorship = await api.post<Mentorship>("/api/ecosystem/youth/mentorships", {
        mentor_id: mentorId,
        goal,
      });
      setData((current) => current ? {
        ...current,
        mentorships: [mentorship, ...current.mentorships],
      } : current);
      toast("Mentor session requested", "success");
    } catch (reason) {
      toast(reason instanceof ApiError ? reason.message : "Could not request mentor", "error");
    } finally {
      setBusy(null);
    }
  }

  async function expressInterest(opportunity: EmploymentOpportunity) {
    setBusy(opportunity.id);
    try {
      const application = await api.post<OpportunityApplication>(
        `/api/ecosystem/youth/opportunities/${opportunity.id}/interest`,
      );
      setData((current) => current ? {
        ...current,
        opportunities: current.opportunities.map((row) => (
          row.id === opportunity.id ? { ...row, already_interested: true } : row
        )),
        applications: [application, ...current.applications],
      } : current);
      toast("Verified referral recorded", "success");
    } catch (reason) {
      toast(reason instanceof ApiError ? reason.message : "Could not record interest", "error");
    } finally {
      setBusy(null);
    }
  }

  async function markRead(reminder: Reminder) {
    const updated = await api.patch<Reminder>(`/api/ecosystem/youth/reminders/${reminder.id}/read`);
    setData((current) => current ? {
      ...current,
      reminders: current.reminders.map((row) => row.id === updated.id ? updated : row),
    } : current);
  }

  if (loading && !data) return <Spinner label="Building your connected career pathway..." />;
  if (error) return <EmptyState icon={<IconTarget />} title="Pathway unavailable" body={error} />;
  if (!data) return null;

  const categories = Array.from(new Set(data.opportunities.map((row) => row.category)));
  const opportunities = filter === "all"
    ? data.opportunities
    : data.opportunities.filter((row) => row.category === filter);
  const unread = data.reminders.filter((row) => !row.is_read).length;
  const rising = data.forecasts.filter((row) => row.trend === "rising").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goal-Oriented Career Pathway"
        subtitle="Assessment → roadmap → mentor → work experience → income pathway → measurable outcome"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Suitability Score" value={`${data.assessment?.suitability_score ?? 0}/100`} icon={<IconTarget />} accent="blue" />
        <StatTile label="Rising Skill Forecasts" value={rising} icon={<IconChart />} accent="orange" />
        <StatTile label="Active Mentors" value={data.mentorships.filter((row) => row.status === "active").length} icon={<IconUsers />} accent="green" />
        <StatTile label="Action Reminders" value={unread} icon={<IconCalendar />} accent="purple" />
      </div>

      <AssessmentPanel assessment={data.assessment} busy={busy === "assessment"} onSave={saveAssessment} />

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-2">
          <IconTile icon={<IconChart />} accent="orange" size="sm" />
          <div>
            <h2 className="section-title text-xl">District Demand Forecast</h2>
            <p className="text-sm text-muted">Current demand, six-month projection, and shortage roles.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.forecasts.slice(0, 9).map((forecast) => (
            <div key={forecast.skill_id} className="rounded-xl border border-line p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-ink">{forecast.skill_name}</div>
                <span className={cx(
                  "rounded-full px-2 py-1 text-xs font-semibold capitalize",
                  forecast.trend === "rising" ? "bg-brand-greenTint text-brand-greenDark" : "bg-canvas text-muted",
                )}>{forecast.trend}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <MetricMini label="Current" value={forecast.current_demand} />
                <MetricMini label="6 months" value={forecast.forecast_6m} />
                <MetricMini label="Shortage" value={forecast.shortage_roles} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconTile icon={<IconBriefcase />} accent="teal" size="sm" />
            <div>
              <h2 className="section-title text-xl">Work, Rural & Entrepreneurship Marketplace</h2>
              <p className="text-sm text-muted">Verified pathways with wages, safeguards, finance guidance, and market access.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>All</FilterButton>
            {categories.map((category) => (
              <FilterButton key={category} active={filter === category} onClick={() => setFilter(category)}>
                {CATEGORY_LABELS[category] ?? category}
              </FilterButton>
            ))}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {opportunities.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              busy={busy === opportunity.id}
              onInterest={expressInterest}
            />
          ))}
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-2">
          <IconTile icon={<IconUsers />} accent="green" size="sm" />
          <div>
            <h2 className="section-title text-xl">Industry Mentor Network</h2>
            <p className="text-sm text-muted">Tamil/English guidance for careers, apprenticeships, and entrepreneurship.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.mentors.map((mentor) => {
            const existing = data.mentorships.find((row) => row.mentor_id === mentor.id);
            return (
              <div key={mentor.id} className="rounded-xl border border-line p-4">
                <h3 className="font-semibold text-ink">{mentor.name}</h3>
                <p className="text-sm font-medium text-brand-blue">{mentor.expertise}</p>
                <p className="mt-2 text-xs text-muted">{mentor.organisation} · {mentor.languages}</p>
                {mentor.rural_support && <p className="mt-2 text-xs font-semibold text-brand-greenDark">Rural support available</p>}
                <button
                  type="button"
                  className="btn-primary mt-4 w-full !py-2"
                  disabled={Boolean(existing) || busy === `mentor-${mentor.id}`}
                  onClick={() => requestMentor(mentor.id, `Guidance for ${mentor.expertise}`)}
                >
                  {existing ? `${existing.status} · ${existing.next_session_at ? new Date(existing.next_session_at).toLocaleDateString("en-IN") : "scheduled"}` : "Request mentor"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <h2 className="section-title text-xl">Automated Reminders</h2>
          <div className="mt-4 space-y-3">
            {data.reminders.length === 0 && <p className="text-sm text-muted">No reminders yet.</p>}
            {data.reminders.map((reminder) => (
              <button
                type="button"
                key={reminder.id}
                onClick={() => markRead(reminder)}
                className={cx(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left",
                  reminder.is_read ? "border-line bg-canvas opacity-70" : "border-brand-blue/30 bg-brand-blueTint/30",
                )}
              >
                <IconCheck width={18} height={18} />
                <span>
                  <span className="block text-sm font-semibold text-ink">{reminder.title}</span>
                  <span className="block text-xs text-muted">{reminder.message}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="section-title text-xl">Public Platform Integration</h2>
          <p className="mt-1 text-sm text-muted">Official-link adapters; API sync activates when government credentials are provided.</p>
          <div className="mt-4 space-y-3">
            {data.integrations.map((integration) => (
              <a key={integration.id} href={integration.official_url ?? "#"} target="_blank" rel="noreferrer" className="block rounded-xl border border-line p-3 hover:border-brand-blue">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-ink">{integration.platform}</span>
                  <span className="rounded-full bg-brand-orange/10 px-2 py-1 text-xs font-semibold text-brand-orange">{integration.status.replace("_", " ")}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{integration.capability}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}


function AssessmentPanel({ assessment, busy, onSave }: { assessment: CareerAssessment | null; busy: boolean; onSave: (body: Record<string, unknown>) => void }) {
  const [aptitude, setAptitude] = useState(assessment?.aptitude_area ?? "");
  const [interests, setInterests] = useState(assessment?.interests ?? "");
  const [sectors, setSectors] = useState(assessment?.preferred_sectors ?? "");
  const [mobility, setMobility] = useState(assessment?.mobility ?? "Within district");
  const [wage, setWage] = useState(assessment?.wage_expectation?.toString() ?? "");
  const [entrepreneurship, setEntrepreneurship] = useState(assessment?.entrepreneurship_interest ?? false);

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <IconTile icon={<IconSpark />} accent="purple" size="sm" />
        <div>
          <h2 className="section-title text-xl">Career Assessment Before Training</h2>
          <p className="text-sm text-muted">Aptitude, interests, mobility, wage expectation, and local demand guide the pathway.</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Field label="Aptitude area" value={aptitude} onChange={setAptitude} placeholder="Analytical, technical..." />
        <Field label="Interests" value={interests} onChange={setInterests} placeholder="Roles or activities" />
        <Field label="Preferred sectors" value={sectors} onChange={setSectors} placeholder="IT, finance, EV..." />
        <div>
          <label className="label" htmlFor="mobility">Mobility</label>
          <select id="mobility" className="input" value={mobility} onChange={(event) => setMobility(event.target.value)}>
            <option>Within district</option><option>Within Tamil Nadu</option><option>Anywhere in India</option><option>Remote</option>
          </select>
        </div>
        <Field label="Expected monthly wage" value={wage} onChange={setWage} type="number" placeholder="25000" />
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm font-medium text-ink">
        <input type="checkbox" checked={entrepreneurship} onChange={(event) => setEntrepreneurship(event.target.checked)} />
        Include startup and self-employment pathways
      </label>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Current suitability: <strong className="text-ink">{assessment?.suitability_score ?? 0}/100</strong></p>
        <button className="btn-primary" disabled={busy || !aptitude || !interests || !sectors || !wage} onClick={() => onSave({
          aptitude_area: aptitude, interests, preferred_sectors: sectors, mobility,
          wage_expectation: Number(wage), entrepreneurship_interest: entrepreneurship,
          career_plan_completed: true, referral_accepted: true,
        })}>{busy ? "Generating..." : "Generate personalised roadmap"}</button>
      </div>
    </section>
  );
}


function OpportunityCard({ opportunity, busy, onInterest }: { opportunity: EmploymentOpportunity; busy: boolean; onInterest: (row: EmploymentOpportunity) => void }) {
  return (
    <article className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-blue">{CATEGORY_LABELS[opportunity.category] ?? opportunity.category}</span>
          <h3 className="mt-1 font-display text-lg font-bold text-navy-800">{opportunity.title}</h3>
          <p className="text-sm text-muted">{opportunity.provider} · {opportunity.district}</p>
        </div>
        <div className="text-right text-sm font-semibold text-brand-greenDark">
          ₹{(opportunity.income_min ?? 0).toLocaleString("en-IN")}–₹{(opportunity.income_max ?? 0).toLocaleString("en-IN")}
        </div>
      </div>
      <p className="mt-3 text-sm text-body">{opportunity.description}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Info label="Skills" value={opportunity.skill_names} />
        <Info label="Safeguards" value={opportunity.safeguards} />
        <Info label="Finance & compliance" value={opportunity.finance_guidance} />
        <Info label="Market access" value={opportunity.market_access} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 text-xs font-semibold">
          {opportunity.rural_friendly && <span className="rounded-full bg-brand-greenTint px-2 py-1 text-brand-greenDark">Rural friendly</span>}
          {opportunity.remote_allowed && <span className="rounded-full bg-brand-blueTint px-2 py-1 text-brand-blue">Remote</span>}
          {opportunity.women_focused && <span className="rounded-full bg-brand-purple/10 px-2 py-1 text-brand-purple">Women focused</span>}
        </div>
        <button className="btn-primary !py-2" disabled={opportunity.already_interested || busy} onClick={() => onInterest(opportunity)}>
          {opportunity.already_interested ? "Referral recorded" : busy ? "Saving..." : "Express interest"}
        </button>
      </div>
    </article>
  );
}


function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return <div><label className="label" htmlFor={id}>{label}</label><input id={id} type={type} className="input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>;
}

function Info({ label, value }: { label: string; value: string | null }) {
  return <div className="rounded-lg bg-canvas px-3 py-2 text-xs"><strong className="text-ink">{label}:</strong> <span className="text-muted">{value || "Provided during referral"}</span></div>;
}

function MetricMini({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-canvas px-2 py-2"><div className="font-bold text-ink">{value}</div><div className="text-muted">{label}</div></div>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={cx("rounded-full px-3 py-1.5 text-xs font-semibold", active ? "bg-brand-blue text-white" : "bg-canvas text-muted")}>{children}</button>;
}
