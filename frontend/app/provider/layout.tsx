"use client";

import { PortalShell, type NavItem } from "@/components/portal-shell";
import { Spinner } from "@/components/ui";
import { useRequireRole } from "@/lib/auth";

const NAV: NavItem[] = [{ href: "/provider", label: "My Courses" }];

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useRequireRole(["provider"]);

  if (loading || !user) return <Spinner label="Loading provider portal…" />;

  return (
    <PortalShell nav={NAV} accentLabel="Training Provider">
      {children}
    </PortalShell>
  );
}
