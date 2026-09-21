"use client";

import { PortalShell, type NavItem } from "@/components/portal-shell";
import { Spinner } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";

const NAV: NavItem[] = [
  { href: "/recruiter", label: "Dashboard" },
  { href: "/recruiter/jobs", label: "Jobs" },
  { href: "/recruiter/candidates", label: "Candidates" },
  { href: "/recruiter/pipeline", label: "Pipeline" },
  { href: "/recruiter/insights", label: "Skill Insights" },
];

export default function RecruiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useRequireRole(["recruiter"]);

  if (loading || !user) return <Spinner label="Loading your portal…" />;

  return (
    <PortalShell nav={NAV} accentLabel="Recruiter Portal">
      {children}
    </PortalShell>
  );
}
