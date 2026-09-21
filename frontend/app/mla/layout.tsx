"use client";

import { PortalShell, type NavItem } from "@/components/portal-shell";
import { Spinner } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";

const NAV: NavItem[] = [
  { href: "/mla", label: "Dashboard" },
  { href: "/mla/verifications", label: "Verifications" },
  { href: "/mla/documents", label: "Documents" },
  { href: "/mla/employers", label: "Employers" },
  { href: "/mla/placements", label: "Placements" },
  { href: "/mla/outcomes", label: "Outcomes & Retention" },
  { href: "/mla/assessments", label: "AI Assessments" },
  { href: "/mla/commissions", label: "Commissions" },
];

export default function MlaLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useRequireRole(["admin"]);

  if (loading || !user) return <Spinner label="Loading constituency portal…" />;

  return (
    <PortalShell nav={NAV} accentLabel="Admin">
      {children}
    </PortalShell>
  );
}
