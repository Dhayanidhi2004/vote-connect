"use client";

import { useEffect, useState } from "react";
import { ScoreGauge } from "@/components/gauge";
import {
  IconGradCap,
  IconBriefcase,
  IconSkill,
  IconDoc,
  IconTarget,
  IconUserCheck,
  IconChart,
  IconSpark,
  IconIdCard,
  IconLocation,
  IconCheck,
} from "@/components/icons";
import {
  IconTile,
  VerifiedBadge,
  EmptyState,
  CtaLink,
  cx,
  type Accent,
} from "@/components/ui";
import { Skeleton } from "@/components/skeleton";
import { api } from "@/lib/api";
import type { Constituency, YouthProfile } from "@/lib/types";

function maskEpic(epic: string | null): string {
  if (!epic) return "Not provided";
  const clean = epic.trim();
  if (clean.length < 6) return clean;
  return `${clean.slice(0, 2)}XX${clean.slice(4)}`;
}

const OUTPUTS: { icon: React.ReactNode; accent: Accent; title: string }[] = [
  { icon: <IconUserCheck width={18} height={18} />, accent: "blue", title: "Verified job-seeker profile" },
  { icon: <IconChart width={18} height={18} />, accent: "green", title: "Employability score" },
  { icon: <IconTarget width={18} height={18} />, accent: "orange", title: "Skill-gap identification" },
  { icon: <IconSpark width={18} height={18} />, accent: "purple", title: "Personalized recommendations" },
];

export default function YouthProfilePage() {
  const [profile, setProfile] = useState<YouthProfile | null>(null);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [p, cons] = await Promise.all([
          api.get<YouthProfile>("/api/youth/profile"),
          api.get<Constituency[]>("/api/reference/constituencies").catch(() => []),
        ]);
        if (!alive) return;
        setProfile(p);
        setConstituencies(cons);
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

  if (loading)
    return (
      <div className="space-y-4">
        <div className="card overflow-hidden">
          <Skeleton className="h-28 w-full rounded-none" />
          <div className="space-y-3 p-5">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );

  if (error)
    return (
      <div className="rounded-xl bg-brand-redTint px-4 py-3 text-sm text-brand-red">
        {error}
      </div>
    );

  if (!profile) return null;

  if (!profile.onboarding_complete) {
    return (
      <EmptyState
        icon={<IconUserCheck width={22} height={22} />}
        title="Complete your registration"
        body="Finish the quick registration to create your verified job-seeker profile, get an employability score and unlock matched jobs."
        action={<CtaLink href="/youth/register">Start registration</CtaLink>}
      />
    );
  }

  const cons = constituencies.find((c) => c.id === profile.constituency_id);
  const verified = profile.verification_status === "verified";
  const headline =
    [profile.experience_title, profile.education_field || profile.education_level]
      .filter(Boolean)
      .join(" · ") || "Job seeker";
  const location = [profile.constituency_name, cons?.district, cons?.state]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <div className="overflow-hidden rounded-lg border border-line bg-white">
        {/* Identity */}
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-blue text-3xl font-bold text-white">
                {profile.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 pb-1">
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl font-bold text-ink">{profile.name}</h1>
                  {verified && (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-green text-white">
                      <IconCheck width={12} height={12} />
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-body">{headline}</p>
                {location && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                    <IconLocation width={14} height={14} />
                    {location}
                  </p>
                )}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <VerifiedBadge
                    status={
                      verified
                        ? "verified"
                        : profile.verification_status === "pending"
                          ? "pending"
                          : "unverified"
                    }
                  />
                  <span className="tnum inline-flex items-center gap-1 rounded-full bg-brand-blueTint px-2.5 py-1 text-xs font-semibold text-brand-blue">
                    <IconIdCard width={13} height={13} /> {maskEpic(profile.epic_number)}
                  </span>
                </div>
              </div>
            </div>

            {/* Employability score */}
            <div
              className={cx(
                "flex flex-col items-center rounded-xl border px-5 py-3",
                verified ? "border-brand-greenTint bg-brand-greenTint/40" : "border-line bg-canvas",
              )}
            >
              <span className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Employability
              </span>
              <ScoreGauge
                score={profile.employability_score}
                band={profile.employability_band}
                size={108}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <CtaLink href="/youth/jobs">View matched jobs</CtaLink>
            <CtaLink href="/youth/register" variant="ghost">Edit profile</CtaLink>
          </div>
        </div>

        {/* Detail cards */}
        <div className="grid gap-4 border-t border-line p-6 md:grid-cols-2">
          <DetailCard icon={<IconGradCap width={18} height={18} />} accent="green" title="Education">
            <ul className="space-y-1 text-sm text-body">
              <li className="flex gap-2"><Dot /> {profile.education_field || profile.education_level || "—"}
                {profile.education_level && profile.education_field ? ` (${profile.education_level})` : ""}
              </li>
              {profile.institution && <li className="flex gap-2"><Dot /> {profile.institution}</li>}
              {profile.graduation_year && <li className="flex gap-2"><Dot /> {profile.graduation_year}</li>}
            </ul>
          </DetailCard>

          <DetailCard icon={<IconSkill width={18} height={18} />} accent="blue" title="Skills">
            {profile.skills.length ? (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((s) => (
                  <span
                    key={s.skill_id}
                    className="rounded-md bg-brand-greenTint px-2.5 py-1 text-xs font-semibold text-brand-greenDark"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No skills added yet.</p>
            )}
          </DetailCard>

          <DetailCard icon={<IconBriefcase width={18} height={18} />} accent="orange" title="Experience">
            <ul className="space-y-1 text-sm text-body">
              <li className="flex gap-2"><Dot /> {profile.experience_title || "—"}</li>
              <li className="flex gap-2"><Dot />
                {profile.experience_years
                  ? `${profile.experience_years} year${profile.experience_years === 1 ? "" : "s"}`
                  : "No experience recorded"}
              </li>
              {profile.experience_company && <li className="flex gap-2"><Dot /> {profile.experience_company}</li>}
            </ul>
          </DetailCard>

          <DetailCard icon={<IconDoc width={18} height={18} />} accent="purple" title="Resume">
            {profile.resume_filename ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">{profile.resume_filename}</p>
                  <p className="text-xs text-muted">120 KB · PDF</p>
                </div>
                <button
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-brand-blue transition hover:bg-brand-blueTint"
                  title="Download resume"
                  aria-label="Download resume"
                >
                  <IconDoc width={16} height={16} />
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted">No resume uploaded.</p>
            )}
          </DetailCard>
        </div>

        {/* Employment readiness */}
        <div className="flex items-start gap-3 border-t border-line bg-brand-blueTint/50 px-6 py-4">
          <IconTile icon={<IconTarget width={18} height={18} />} accent="blue" size="sm" />
          <div>
            <div className="font-semibold text-ink">Employment readiness</div>
            <p className="text-sm text-muted">
              Profile completed. You are eligible for job matching and personalized
              training recommendations.
            </p>
          </div>
        </div>
      </div>

      <InclusionPreferences profile={profile} onSaved={setProfile} />

      {/* Outputs for youth */}
      <section>
        <p className="eyebrow mb-3">Outputs for youth</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OUTPUTS.map((o) => (
            <div key={o.title} className="card flex items-center gap-3 p-4">
              <IconTile icon={o.icon} accent={o.accent} size="sm" />
              <span className="text-sm font-semibold text-ink">{o.title}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function InclusionPreferences({
  profile,
  onSaved,
}: {
  profile: YouthProfile;
  onSaved: (profile: YouthProfile) => void;
}) {
  const [ruralResident, setRuralResident] = useState(profile.rural_resident);
  const [differentlyAbled, setDifferentlyAbled] = useState(profile.differently_abled);
  const [assistedAccess, setAssistedAccess] = useState(profile.assisted_access);
  const [preferredLanguage, setPreferredLanguage] = useState(profile.preferred_language || "Tamil");
  const [mobility, setMobility] = useState(profile.mobility_preference || "Within district");
  const [expectedSalary, setExpectedSalary] = useState(profile.expected_salary?.toString() || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const updated = await api.put<YouthProfile>("/api/youth/profile", {
        rural_resident: ruralResident,
        differently_abled: differentlyAbled,
        assisted_access: assistedAccess,
        preferred_language: preferredLanguage,
        mobility_preference: mobility,
        expected_salary: expectedSalary ? Number(expectedSalary) : null,
      });
      onSaved(updated);
      setMessage("Preferences saved. These choices improve inclusive job and support matching.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-5">
      <p className="eyebrow">Access & inclusion / அணுகல் மற்றும் உள்ளடக்கம்</p>
      <h2 className="mt-1 font-display text-xl font-bold text-ink">Employment preferences</h2>
      <p className="mt-1 text-sm text-muted">
        Used for rural coverage, accessibility support, language, mobility and wage-quality tracking.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm font-semibold text-body">
          Preferred language
          <select className="input mt-1 w-full" value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value)}>
            <option>Tamil</option><option>English</option><option>Tamil, English</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-body">
          Mobility preference
          <select className="input mt-1 w-full" value={mobility} onChange={(e) => setMobility(e.target.value)}>
            <option>Within constituency</option><option>Within district</option><option>Within Tamil Nadu</option><option>Remote only</option><option>Open to relocate</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-body">
          Expected monthly salary (₹)
          <input className="input mt-1 w-full" type="number" min="0" value={expectedSalary} onChange={(e) => setExpectedSalary(e.target.value)} placeholder="e.g. 20000" />
        </label>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ["Rural resident", ruralResident, setRuralResident],
          ["Person with disability", differentlyAbled, setDifferentlyAbled],
          ["Need assisted digital access", assistedAccess, setAssistedAccess],
        ].map(([label, checked, setter]) => (
          <label key={label as string} className="flex items-center gap-2 rounded-lg border border-line p-3 text-sm font-medium text-body">
            <input type="checkbox" checked={checked as boolean} onChange={(e) => (setter as (value: boolean) => void)(e.target.checked)} />
            {label as string}
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-primary" type="button" disabled={saving} onClick={save}>
          {saving ? "Saving..." : "Save preferences"}
        </button>
        {message && <p className="text-sm text-muted" role="status">{message}</p>}
      </div>
    </section>
  );
}

function Dot() {
  return <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted" />;
}

function DetailCard({
  icon,
  accent,
  title,
  children,
}: {
  icon: React.ReactNode;
  accent: Accent;
  title: string;
  children: React.ReactNode;
}) {
  const titleColor: Record<string, string> = {
    green: "text-brand-greenDark",
    blue: "text-brand-blue",
    orange: "text-brand-orange",
    purple: "text-brand-purple",
    teal: "text-brand-teal",
    navy: "text-navy-800",
    red: "text-brand-red",
  };
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <IconTile icon={icon} accent={accent} size="sm" />
        <span className={cx("text-sm font-bold uppercase tracking-wide", titleColor[accent])}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
