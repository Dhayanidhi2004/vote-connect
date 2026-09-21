"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "./brand";
import {
  IconBriefcase,
  IconChart,
  IconClose,
  IconDoc,
  IconGradCap,
  IconLaptop,
  IconLogout,
  IconMenu,
  IconShieldCheck,
  IconSkill,
  IconTarget,
  IconUserCheck,
  IconUsers,
} from "./icons";
import { cx } from "./ui";
import { homeFor, useAuth } from "@/lib/auth";

export interface NavItem {
  href: string;
  label: string;
}

const TAMIL_LABELS: Record<string, string> = {
  "Dashboard": "டாஷ்போர்டு",
  "My Profile": "என் சுயவிவரம்",
  "Skill Gap": "திறன் இடைவெளி",
  "AI Assessment": "AI திறன் மதிப்பீடு",
  "AI Assessments": "AI மதிப்பீடுகள்",
  "Career Pathway": "தொழில் பாதை",
  "Jobs": "வேலைகள்",
  "Applications": "விண்ணப்பங்கள்",
  "Public Services": "பொது சேவைகள்",
  "Candidates": "வேட்பாளர்கள்",
  "Pipeline": "தேர்வு நிலைகள்",
  "Skill Insights": "திறன் பகுப்பாய்வு",
  "Verifications": "சரிபார்ப்புகள்",
  "Employers": "முதலாளிகள்",
  "Placements": "வேலை நியமனங்கள்",
  "Outcomes & Retention": "விளைவுகள் & நிலைத்தன்மை",
};

function iconFor(label: string) {
  const l = label.toLowerCase();
  const p = { width: 20, height: 20, "aria-hidden": true };
  if (l.includes("profile")) return <IconUserCheck {...p} />;
  if (l.includes("skill")) return <IconSkill {...p} />;
  if (l.includes("job")) return <IconBriefcase {...p} />;
  if (l.includes("application")) return <IconLaptop {...p} />;
  if (l.includes("candidate")) return <IconUsers {...p} />;
  if (l.includes("pipeline")) return <IconTarget {...p} />;
  if (l.includes("verif")) return <IconShieldCheck {...p} />;
  if (l.includes("course") || l.includes("training")) return <IconGradCap {...p} />;
  return <IconChart {...p} />;
}

export function PortalShell({
  nav,
  accentLabel,
  children,
}: {
  nav: NavItem[];
  accentLabel: string;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const displayName = user?.role === "admin" ? "Admin" : user?.name;
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [language, setLanguage] = useState<"English" | "Tamil">("English");
  const homeHref = user ? homeFor(user.role) : nav[0]?.href || "/";
  const activeItem = useMemo(
    () =>
      [...nav]
        .sort((a, b) => b.href.length - a.href.length)
        .find(
          (item) =>
            pathname === item.href ||
            (item.href.split("/").length > 2 && pathname.startsWith(`${item.href}/`)),
        ) ?? nav[0],
    [nav, pathname],
  );

  useEffect(() => setSidebarOpen(false), [pathname]);

  useEffect(() => {
    const stored = window.localStorage.getItem("jobnadu_language");
    if (stored === "Tamil") {
      setLanguage("Tamil");
      document.documentElement.lang = "ta";
    } else {
      document.documentElement.lang = "en";
    }
  }, []);

  function toggleLanguage() {
    const next = language === "English" ? "Tamil" : "English";
    setLanguage(next);
    window.localStorage.setItem("jobnadu_language", next);
    document.documentElement.lang = next === "Tamil" ? "ta" : "en";
  }

  const labelFor = (label: string) => language === "Tamil" ? (TAMIL_LABELS[label] ?? label) : label;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSidebarOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function handleLogout() {
    setSidebarOpen(false);
    logout();
    router.replace("/login");
  }

  const sidebar = (
    <div className="relative flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_0%_0%,rgba(29,78,216,0.55),transparent_32%),radial-gradient(circle_at_90%_100%,rgba(15,118,110,0.35),transparent_32%),linear-gradient(180deg,#071a3a,#0b1831)] text-white">
      <div className="pointer-events-none absolute -right-20 top-52 h-48 w-48 rounded-full bg-brand-blue/15 blur-3xl" />
      <div className="relative flex h-[80px] items-center justify-between border-b border-white/10 px-5">
        <Logo href={homeHref} light />
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        >
          <IconClose width={21} height={21} />
        </button>
      </div>

      <div className="relative px-4 pb-3 pt-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">Workspace</p>
          <div className="mt-1 truncate text-sm font-semibold text-white">{accentLabel}</div>
        </div>
      </div>

      <nav className="relative flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Primary navigation">
        {nav.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href.split("/").length > 2 && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition duration-200",
                isActive
                  ? "bg-[linear-gradient(135deg,#2563eb,#0f766e)] text-white shadow-[0_10px_22px_rgba(29,78,216,0.28)]"
                  : "text-slate-300 hover:bg-white/[0.07] hover:text-white",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className={cx(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition",
                  isActive ? "bg-white/15" : "bg-white/[0.04] group-hover:bg-white/10",
                )}
              >
                {iconFor(item.label)}
              </span>
              <span className="truncate">{labelFor(item.label)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="relative border-t border-white/10 p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-red-500/10 hover:text-red-200"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]">
            <IconLogout width={19} height={19} />
          </span>
          <span className="hidden lg:inline">{language === "Tamil" ? "வெளியேறு" : "Logout"}</span>
          <span className="lg:hidden">{language === "Tamil" ? "வெளியேறு" : "Sign out"}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_88%_0%,rgba(29,78,216,0.07),transparent_26%),linear-gradient(180deg,#f8fbff,#f3f7fb)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] lg:block">{sidebar}</aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation overlay"
          />
          <aside className="relative h-full w-[min(86vw,320px)] shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="min-h-screen lg:pl-[272px]">
        <header className="sticky top-0 z-30 border-b border-white/80 bg-white/80 shadow-[0_4px_18px_rgba(15,23,42,0.04)] backdrop-blur-xl">
          <div className="flex h-[76px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-ink shadow-tile transition hover:bg-slate-50 lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation"
                aria-expanded={sidebarOpen}
              >
                <IconMenu width={21} height={21} />
              </button>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-brand-blue">{accentLabel}</p>
                <p className="mt-0.5 truncate text-base font-bold text-ink sm:text-lg">
                  {activeItem ? labelFor(activeItem.label) : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleLanguage}
                className="min-h-10 rounded-xl border border-blue-100 bg-brand-blueTint px-3 py-2 text-xs font-semibold text-brand-blue"
                aria-label="Change language"
              >
                {language === "English" ? "தமிழ்" : "English"}
              </button>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#1d4ed8,#0f766e)] text-sm font-bold text-white shadow-[0_8px_18px_rgba(29,78,216,0.22)]">
                {displayName?.charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-[150px] truncate text-sm font-semibold text-ink sm:block">
                {displayName}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="hidden min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-muted shadow-tile transition hover:bg-brand-redTint hover:text-brand-red sm:inline-flex"
              >
                <IconLogout width={17} height={17} />
                {language === "Tamil" ? "வெளியேறு" : "Logout"}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
