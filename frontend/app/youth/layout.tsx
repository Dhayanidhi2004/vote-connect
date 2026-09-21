"use client";

import { PortalShell, type NavItem } from "@/components/portal-shell";
import { Spinner } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";

const NAV: NavItem[] = [
  { href: "/youth/profile", label: "My Profile" },
  { href: "/youth/skills", label: "Skill Gap" },
  { href: "/youth/assessment", label: "AI Assessment" },
  { href: "/youth/pathway", label: "Career Pathway" },
  { href: "/youth/jobs", label: "Jobs" },
  { href: "/youth/applications", label: "Applications" },
  { href: "/youth/documents", label: "Documents" },
  { href: "/youth/services", label: "Public Services" },
];

export default function YouthLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useRequireRole(["youth"]);

  if (loading || !user) return <Spinner label="Loading your portal…" />;

  return (
    <PortalShell nav={NAV} accentLabel="Youth Portal">
      {children}
    </PortalShell>
  );
}
