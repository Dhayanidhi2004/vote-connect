"use client";

import { useEffect, type ReactNode } from "react";
import { MatchBar, VerifiedBadge, cx } from "@/components/ui";
import {
  IconArrowRight,
  IconBriefcase,
  IconDoc,
  IconGradCap,
  IconTarget,
  IconTrendingUp,
  IconUserCheck,
} from "@/components/icons";
import type { Candidate, PipelineFunnel } from "@/lib/types";

/** Build & download a plain-text résumé from the candidate's profile (demo). */
export function downloadResume(c: Candidate) {
  const lines = [
    c.name,
    "".padEnd(44, "="),
    `Constituency : ${c.constituency_name ?? "-"}`,
    `Employability: ${c.employability_score}/100 ${c.employability_band ? `(${c.employability_band})` : ""}`,
    "",
    "EDUCATION",
    `  ${[c.education_field, c.education_level && `(${c.education_level})`].filter(Boolean).join(" ")}`.trimEnd() || "  -",
    c.institution ? `  ${c.institution}` : "",
    "",
    "EXPERIENCE",
    `  ${c.experience_title ?? "-"}${c.experience_company ? ` · ${c.experience_company}` : ""} · ${c.experience_years} yr`,
    "",
    "SKILLS",
    `  ${c.skills.join(", ") || "-"}`,
  ].filter((l) => l !== undefined);
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const base = (c.resume_filename || `${c.name.replace(/\s+/g, "_")}_Resume.pdf`).replace(/\.pdf$/i, "");
  a.download = `${base}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

const AVATAR_ACCENTS = [
  "bg-brand-blue/12 text-brand-blue",
  "bg-brand-green/12 text-brand-green",
  "bg-brand-purple/12 text-brand-purple",
  "bg-brand-orange/12 text-brand-orange",
  "bg-brand-teal/12 text-brand-teal",
];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-14 w-14 text-lg" : size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  const accent =
    AVATAR_ACCENTS[
      Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_ACCENTS.length
    ];
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold",
        dim,
        accent,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Simple accessible modal dialog. */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-900/40 p-4 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={cx("card my-4 w-full p-6", wide ? "max-w-2xl" : "max-w-lg")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="section-title text-xl">{title}</h2>
          <button
            onClick={onClose}
            className="btn-ghost !px-3 !py-1.5 text-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ResumeSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

/** Résumé-style candidate view for the profile modal (with download). */
export function CandidateProfile({ candidate }: { candidate: Candidate }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Avatar name={candidate.name} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-display text-lg font-bold text-ink">{candidate.name}</div>
              {candidate.verification_status && (
                <VerifiedBadge
                  status={
                    candidate.verification_status === "verified"
                      ? "verified"
                      : candidate.verification_status === "pending"
                        ? "pending"
                        : "unverified"
                  }
                />
              )}
            </div>
            <div className="text-sm text-muted">
              {[candidate.education_field || candidate.education_level, candidate.constituency_name]
                .filter(Boolean)
                .join(" · ") || "—"}
            </div>
          </div>
        </div>
        <button onClick={() => downloadResume(candidate)} className="btn-primary !py-2 text-sm">
          <IconDoc width={16} height={16} /> Download résumé
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-line bg-canvas p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Experience</div>
          <div className="tnum text-lg font-bold text-ink">{candidate.experience_years} yr</div>
        </div>
        <div className="rounded-lg border border-line bg-canvas p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Employability</div>
          <div className="tnum text-lg font-bold text-ink">{candidate.employability_score}</div>
        </div>
        <div className="rounded-lg border border-line bg-canvas p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Match</div>
          <div className="tnum text-lg font-bold text-brand-blue">{candidate.match_score}%</div>
        </div>
      </div>

      <ResumeSection title="Education" icon={<IconGradCap width={14} height={14} />}>
        <p className="text-sm text-ink">
          {[candidate.education_field, candidate.education_level && `(${candidate.education_level})`]
            .filter(Boolean)
            .join(" ") || "—"}
          {candidate.institution ? ` · ${candidate.institution}` : ""}
        </p>
      </ResumeSection>

      <ResumeSection title="Experience" icon={<IconBriefcase width={14} height={14} />}>
        <p className="text-sm text-ink">
          {candidate.experience_title || "—"}
          {candidate.experience_company ? ` · ${candidate.experience_company}` : ""}
          {candidate.experience_years ? ` · ${candidate.experience_years} yr` : ""}
        </p>
      </ResumeSection>

      <ResumeSection title="Skills" icon={<IconTarget width={14} height={14} />}>
        {candidate.skills.length ? (
          <div className="flex flex-wrap gap-1.5">
            {candidate.skills.map((s) => (
              <span key={s} className="chip">{s}</span>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted">No skills listed.</div>
        )}
      </ResumeSection>

      <ResumeSection title="Résumé" icon={<IconDoc width={14} height={14} />}>
        <div className="flex items-center justify-between rounded-lg border border-line bg-canvas px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm text-ink">
            <IconDoc width={16} height={16} className="text-brand-blue" />
            {candidate.resume_filename || "No résumé uploaded"}
          </span>
          {candidate.resume_filename && (
            <button
              onClick={() => downloadResume(candidate)}
              className="text-sm font-semibold text-brand-blue hover:underline"
            >
              View
            </button>
          )}
        </div>
      </ResumeSection>

      <div className="flex items-center justify-between border-t border-line pt-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Match score</span>
        <MatchBar score={candidate.match_score} />
      </div>
    </div>
  );
}

/** Horizontal hiring funnel — connected stat chips with arrows (deck page 6). */
export function HiringFunnel({ pipeline }: { pipeline: PipelineFunnel }) {
  const stages = [
    { label: "Applied", value: pipeline.registered, icon: <IconDoc width={18} height={18} />, accent: "bg-brand-blue/12 text-brand-blue" },
    { label: "Shortlisted", value: pipeline.shortlisted, icon: <IconGradCap width={18} height={18} />, accent: "bg-brand-orange/12 text-brand-orange" },
    { label: "Interview", value: pipeline.interviews, icon: <IconTrendingUp width={18} height={18} />, accent: "bg-brand-purple/12 text-brand-purple" },
    { label: "Selected", value: pipeline.selected, icon: <IconTarget width={18} height={18} />, accent: "bg-brand-teal/12 text-brand-teal" },
    { label: "Joined", value: pipeline.joined, icon: <IconUserCheck width={18} height={18} />, accent: "bg-brand-green/12 text-brand-green" },
  ];
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {stages.map((s, i) => (
        <div key={s.label} className="flex flex-1 items-center gap-2">
          <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl border border-line bg-white p-4 text-center">
            <span className={cx("inline-flex h-9 w-9 items-center justify-center rounded-xl", s.accent)}>
              {s.icon}
            </span>
            <span className="font-display text-2xl font-bold text-navy-800">{s.value}</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {s.label}
            </span>
          </div>
          {i < stages.length - 1 && (
            <IconArrowRight className="hidden shrink-0 text-line sm:block" width={20} height={20} />
          )}
        </div>
      ))}
    </div>
  );
}
