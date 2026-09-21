import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowRight, IconCheck } from "./icons";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const ACCENTS: Record<string, string> = {
  blue: "bg-brand-blueTint text-brand-blue",
  green: "bg-brand-greenTint text-brand-green",
  orange: "bg-brand-orangeTint text-brand-orange",
  purple: "bg-brand-purpleTint text-brand-purple",
  teal: "bg-brand-tealTint text-brand-teal",
  navy: "bg-navy-50 text-navy-700",
  red: "bg-brand-redTint text-brand-red",
};

export type Accent = keyof typeof ACCENTS;

export function SectionBadge({ n }: { n: number | string }) {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-blueTint text-sm font-bold text-brand-blue">
      {n}
    </span>
  );
}

export function IconTile({
  icon,
  accent = "blue",
  size = "md",
}: {
  icon: ReactNode;
  accent?: Accent;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "lg" ? "h-12 w-12" : size === "sm" ? "h-9 w-9" : "h-10 w-10";
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center rounded-xl",
        dim,
        ACCENTS[accent],
      )}
    >
      {icon}
    </span>
  );
}

export function StatTile({
  label,
  value,
  icon,
  accent = "blue",
  sub,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  accent?: Accent;
  sub?: string;
}) {
  return (
    <div className="card relative overflow-hidden p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <span className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#1d4ed8,#0f766e)]" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-medium uppercase tracking-wide text-muted">
            {label}
          </div>
          <div className="tnum mt-1.5 text-2xl font-bold text-ink">{value}</div>
          {sub && <div className="mt-0.5 text-xs font-medium text-brand-green">{sub}</div>}
        </div>
        {icon && <IconTile icon={icon} accent={accent} size="sm" />}
      </div>
    </div>
  );
}

export function VerifiedBadge({
  status,
}: {
  status: "verified" | "pending" | "unverified";
}) {
  const map = {
    verified: { c: "bg-brand-greenTint text-brand-greenDark", t: "Verified" },
    pending: { c: "bg-brand-orangeTint text-brand-orange", t: "Pending review" },
    unverified: { c: "bg-navy-50 text-muted", t: "Unverified" },
  }[status];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        map.c,
      )}
    >
      {status === "verified" && <IconCheck width={13} height={13} />}
      {map.t}
    </span>
  );
}

export function PipelineStrip({
  steps,
}: {
  steps: { label: string; icon: ReactNode; accent?: Accent }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-y-4">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center">
          <div className="flex w-28 flex-col items-center gap-2 text-center">
            <IconTile icon={s.icon} accent={s.accent ?? "blue"} />
            <span className="text-xs font-semibold leading-tight text-navy-800">
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <IconArrowRight className="mb-6 hidden shrink-0 text-line sm:block" width={20} height={20} />
          )}
        </div>
      ))}
    </div>
  );
}

export function MatchBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-brand-green" : score >= 60 ? "bg-brand-blue" : "bg-brand-orange";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-canvas">
        <div className={cx("h-full rounded-full", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="tnum w-9 text-right text-sm font-bold text-ink">{score}%</span>
    </div>
  );
}

export function SkillChip({ children }: { children: ReactNode }) {
  return <span className="chip">{children}</span>;
}

export function PageHeader({
  n,
  title,
  subtitle,
  right,
}: {
  n?: number | string;
  title: string;
  subtitle?: string;
  eyebrowAccent?: string;
  right?: ReactNode;
}) {
  void n;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-white bg-[radial-gradient(circle_at_90%_15%,rgba(21,128,61,0.13),transparent_25%),linear-gradient(120deg,#ffffff,#f5f9ff)] px-5 py-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] sm:px-6">
      <div className="min-w-0">
        <h1 className="section-title text-xl sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      {icon && <IconTile icon={icon} accent="navy" size="lg" />}
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      {body && <p className="max-w-md text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand-blue" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function CtaLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "navy" | "ghost";
}) {
  const cls =
    variant === "navy" ? "btn-navy" : variant === "ghost" ? "btn-ghost" : "btn-primary";
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export function FooterBand({ tagline }: { tagline?: string }) {
  return (
    <footer className="footer-band mt-16">
      <div className="container-page flex flex-col gap-1 py-8">
        <p className="text-sm font-medium text-navy-800">
          {tagline ?? "Empowering youth, strengthening skills, building a better future"}
        </p>
        <p className="text-xs text-muted">
          Voter ID-based youth placement and skill development system - demo prototype
        </p>
      </div>
    </footer>
  );
}
