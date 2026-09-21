"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand";
import {
  IconBriefcase,
  IconChart,
  IconCheck,
  IconGradCap,
  IconIdCard,
  IconInstitution,
  IconShieldCheck,
  IconTarget,
  IconUserCheck,
  IconUsers,
} from "@/components/icons";
import { cx, IconTile } from "@/components/ui";
import { api } from "@/lib/api";
import { homeFor, useAuth } from "@/lib/auth";
import type { User, VoterRecord } from "@/lib/types";

interface OtpResp {
  phone: string;
  demo_otp: string | null;
  message: string;
  is_new_user: boolean;
}

interface AuthResp {
  token: string;
  user: User;
}

type PageMode = "signin" | "signup";
type SigninKind = "youth" | "staff";
type SignupKind = "youth" | "recruiter" | "provider";

const DEMO_ACCESS = [
  { label: "Youth", kind: "youth", voterId: "YJV0983114", password: "demo123" },
  { label: "MLA / Admin", kind: "staff", email: "mla@jobnadu.demo", password: "demo123" },
  { label: "Recruiter", kind: "staff", email: "zoho@jobnadu.demo", password: "demo123" },
  { label: "Provider", kind: "staff", email: "skills@jobnadu.demo", password: "demo123" },
] as const;

const EXPERIENCE_CARDS = [
  {
    title: "Youth",
    body: "Register with guided steps, build a trusted profile, and view matched jobs.",
    icon: <IconUsers width={18} height={18} />,
    accent: "blue" as const,
  },
  {
    title: "Recruiters",
    body: "Post openings, shortlist verified candidates, and move them through the pipeline.",
    icon: <IconBriefcase width={18} height={18} />,
    accent: "teal" as const,
  },
  {
    title: "Constituency teams",
    body: "Track verification progress, program performance, and placement outcomes in one place.",
    icon: <IconInstitution width={18} height={18} />,
    accent: "purple" as const,
  },
] as const;

function modeDescription(pageMode: PageMode, signupKind: SignupKind, signupStep: "details" | "otp") {
  if (pageMode === "signin") return "Choose your role and continue to your workspace.";
  if (signupStep === "otp") return "Confirm the one-time password to complete account creation.";
  if (signupKind === "youth") return "Start with voter ID lookup and then confirm your mobile number.";
  return "Create a staff account with your contact details and one mobile OTP.";
}

function signupTitle(kind: SignupKind) {
  if (kind === "recruiter") return "Recruiter registration";
  if (kind === "provider") return "Training provider registration";
  return "Youth registration";
}

function voterPreviewFields(voter: VoterRecord) {
  return [
    { label: "Name", value: voter.name },
    { label: "Voter ID", value: voter.id_code },
    { label: "Age", value: voter.age ? String(voter.age) : null },
    { label: "Gender", value: voter.gender ?? null },
    { label: "House No", value: voter.house_no ?? null },
    { label: "Booth", value: voter.booth_number ?? null },
  ].filter((item) => item.value);
}

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();

  const [pageMode, setPageMode] = useState<PageMode>("signin");
  const [signinKind, setSigninKind] = useState<SigninKind>("youth");
  const [signupKind, setSignupKind] = useState<SignupKind>("youth");
  const [signupStep, setSignupStep] = useState<"details" | "otp">("details");

  const [signinVoterId, setSigninVoterId] = useState("");
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  const [phone, setPhone] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [voterId, setVoterId] = useState("");
  const [voter, setVoter] = useState<VoterRecord | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace(homeFor(user.role));
  }, [user, router]);

  function resetState(nextMode: PageMode) {
    setPageMode(nextMode);
    setSignupStep("details");
    setDemoOtp(null);
    setCode("");
    setError("");
    setPhone("");
    setName("");
    setOrgName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setVoterId("");
    setVoter(null);
    setSigninVoterId("");
    setSigninEmail("");
    setSigninPassword("");
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r =
        signinKind === "youth"
          ? await api.post<AuthResp>("/api/auth/youth-login", {
              voter_id: signinVoterId.trim().toUpperCase(),
              password: signinPassword,
            })
          : await api.post<AuthResp>("/api/auth/staff-login", {
              email: signinEmail.trim().toLowerCase(),
              password: signinPassword,
            });
      login(r.token, r.user);
      router.replace(homeFor(r.user.role));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function lookupVoter(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api.get<VoterRecord>(`/api/auth/voter-lookup/${encodeURIComponent(voterId.trim().toUpperCase())}`);
      setVoter(r);
    } catch (err) {
      setVoter(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function requestSignupOtp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (signupKind !== "youth" && !email.trim()) {
      setError("Email is required for staff signup.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api.post<OtpResp>("/api/auth/request-otp", { phone });
      if (!r.is_new_user) {
        setError("This mobile number already has an account. Use sign in instead.");
        return;
      }
      setDemoOtp(r.demo_otp);
      setCode(r.demo_otp ?? "");
      setSignupStep("otp");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function completeSignup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload =
        signupKind === "youth"
          ? {
              phone,
              code,
              role: "youth",
              voter_id: voterId,
              password,
            }
          : {
              phone,
              code,
              role: signupKind,
              name,
              org_name: signupKind === "recruiter" ? orgName : undefined,
              email,
              password,
            };
      const r = await api.post<AuthResp>("/api/auth/verify-otp", payload);
      login(r.token, r.user);
      router.replace(homeFor(r.user.role));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_5%_5%,rgba(29,78,216,0.14),transparent_28%),radial-gradient(circle_at_95%_95%,rgba(15,118,110,0.13),transparent_30%),linear-gradient(180deg,#f9fbff,#f2f6fc)]">
      <div className="container-page py-6 sm:py-8">
        <div className="grid min-h-[calc(100vh-3rem)] gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <section className="hero-shell flex flex-col justify-between p-6 sm:p-8 lg:p-10">
            <div>
              <Logo />
              <div className="mt-8 max-w-xl">
                <span className="info-pill">
                  <IconShieldCheck width={14} height={14} className="text-brand-green" />
                  Secure and role-aware access
                </span>
                <h1 className="mt-5 font-display text-4xl font-bold leading-tight tracking-[-0.03em] text-ink sm:text-5xl">
                  Sign in to youth, recruiter, provider, and constituency workspaces
                </h1>
                <p className="mt-4 text-base leading-8 text-body">
                  Access verified youth onboarding, employer workflows, training coordination, and
                  constituency dashboards from one entry point.
                </p>
              </div>

              <div className="mt-8 grid gap-4">
                {EXPERIENCE_CARDS.map((item) => (
                  <div key={item.title} className="glass-panel p-4">
                    <div className="flex items-start gap-3">
                      <IconTile icon={item.icon} accent={item.accent} />
                      <div>
                        <h2 className="font-display text-lg font-semibold text-ink">{item.title}</h2>
                        <p className="mt-1 text-sm leading-6 text-body">{item.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Trusted entry",
                  value: "OTP verification",
                  icon: <IconShieldCheck width={18} height={18} />,
                  accent: "green" as const,
                },
                {
                  label: "Youth access",
                  value: "Voter ID lookup",
                  icon: <IconIdCard width={18} height={18} />,
                  accent: "orange" as const,
                },
                {
                  label: "Operational view",
                  value: "Role-based workspace",
                  icon: <IconChart width={18} height={18} />,
                  accent: "purple" as const,
                },
              ].map((item) => (
                <div key={item.label} className="glass-panel p-4">
                  <IconTile icon={item.icon} accent={item.accent} size="sm" />
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="card flex items-center p-4 sm:p-6 lg:p-8 lg:my-3">
            <div className="w-full">
              <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(135deg,rgba(10,102,194,0.08),rgba(14,140,127,0.05))] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">
                      {pageMode === "signin" ? "Welcome back" : signupTitle(signupKind)}
                    </p>
                    <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink">
                      {pageMode === "signin"
                        ? "Access your workspace"
                        : signupStep === "details"
                          ? "Create your account"
                          : "Verify your OTP"}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-body">
                      {modeDescription(pageMode, signupKind, signupStep)}
                    </p>
                  </div>
                  <div className="hidden gap-2 sm:flex">
                    {[
                      { active: pageMode === "signin", label: "Sign in" },
                      { active: pageMode === "signup" && signupStep === "details", label: "Details" },
                      { active: pageMode === "signup" && signupStep === "otp", label: "OTP" },
                    ].map((step, index) => (
                      <div
                        key={step.label}
                        className={cx(
                          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
                          step.active ? "bg-brand-blue text-white" : "bg-white/80 text-muted",
                        )}
                      >
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-[11px]">
                          {index + 1}
                        </span>
                        {step.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-5 rounded-2xl border border-brand-red/20 bg-brand-redTint px-4 py-3 text-sm text-brand-red">
                  {error}
                </div>
              )}

              {pageMode === "signin" && (
                <>
                  <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-canvas/80 p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSigninKind("youth");
                        setError("");
                      }}
                      className={cx(
                        "rounded-xl px-4 py-3 text-sm font-semibold transition",
                        signinKind === "youth" ? "bg-white text-ink shadow-card" : "text-muted",
                      )}
                    >
                      Youth sign in
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSigninKind("staff");
                        setError("");
                      }}
                      className={cx(
                        "rounded-xl px-4 py-3 text-sm font-semibold transition",
                        signinKind === "staff" ? "bg-white text-ink shadow-card" : "text-muted",
                      )}
                    >
                      Staff sign in
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-line/70 bg-canvas/60 px-4 py-3 text-sm text-body">
                    {signinKind === "youth"
                      ? "Youth users sign in with voter ID and password."
                      : "Recruiters, providers, and admins sign in with email and password."}
                  </div>

                  <form onSubmit={signIn} className="mt-5 space-y-4">
                    {signinKind === "youth" ? (
                      <div>
                        <label className="label">Voter ID / EPIC number</label>
                        <input
                          className="input uppercase"
                          value={signinVoterId}
                          onChange={(e) => setSigninVoterId(e.target.value.toUpperCase())}
                          placeholder="Example: YJV0983114"
                          required
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="label">Email</label>
                        <input
                          type="email"
                          className="input"
                          value={signinEmail}
                          onChange={(e) => setSigninEmail(e.target.value)}
                          placeholder="name@company.com"
                          required
                        />
                      </div>
                    )}
                    <div>
                      <label className="label">Password</label>
                      <input
                        type="password"
                        className="input"
                        value={signinPassword}
                        onChange={(e) => setSigninPassword(e.target.value)}
                        required
                      />
                    </div>
                    <button className="btn-primary w-full" disabled={busy}>
                      {busy ? "Signing in..." : "Continue to dashboard"}
                    </button>
                  </form>

                  <div className="mt-6 text-center text-sm text-muted">
                    New here?{" "}
                    <button
                      type="button"
                      onClick={() => resetState("signup")}
                      className="font-semibold text-brand-blue hover:underline"
                    >
                      Create an account
                    </button>
                  </div>
                </>
              )}

              {pageMode === "signup" && signupStep === "details" && (
                <>
                  <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-canvas/80 p-1.5">
                    {(
                      [
                        ["youth", "Youth"],
                        ["recruiter", "Recruiter"],
                        ["provider", "Provider"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSignupKind(key);
                          setError("");
                        }}
                        className={cx(
                          "rounded-xl px-3 py-3 text-sm font-semibold transition",
                          signupKind === key ? "bg-white text-ink shadow-card" : "text-muted",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-line/70 bg-canvas/60 px-4 py-3 text-sm text-body">
                    {signupKind === "youth"
                      ? "Youth accounts begin with voter record lookup before OTP verification."
                      : "Staff registration uses one OTP for setup and email plus password for future access."}
                  </div>

                  {signupKind === "youth" ? (
                    <div className="mt-5 space-y-4">
                      <form onSubmit={lookupVoter} className="space-y-4">
                        <div>
                          <label className="label">Voter ID / EPIC number</label>
                          <input
                            className="input uppercase"
                            value={voterId}
                            onChange={(e) => setVoterId(e.target.value.toUpperCase())}
                            placeholder="Example: YJV0983114"
                            required
                          />
                        </div>
                        <button className="btn-primary w-full" disabled={busy}>
                          {busy ? "Checking..." : "Find voter record"}
                        </button>
                      </form>

                      {voter && (
                        <div className="rounded-[24px] border border-brand-green/15 bg-brand-greenTint/40 p-5">
                          <div className="flex items-center gap-3">
                            <IconTile icon={<IconUserCheck width={18} height={18} />} accent="green" />
                            <div>
                              <p className="font-display text-lg font-semibold text-ink">Voter record found</p>
                              <p className="text-sm text-body">Confirm the details below and continue with OTP setup.</p>
                            </div>
                          </div>

                          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                            {voterPreviewFields(voter).map((item) => (
                              <div key={item.label} className="rounded-2xl bg-white/80 p-4">
                                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                                  {item.label}
                                </dt>
                                <dd className="mt-1 font-semibold text-ink">{item.value}</dd>
                              </div>
                            ))}
                          </dl>

                          {voter.is_registered ? (
                            <div className="mt-5 rounded-2xl border border-brand-red/20 bg-white/85 px-4 py-4 text-sm text-brand-red">
                              This voter ID is already linked to an account
                              {voter.registered_youth_name ? ` for ${voter.registered_youth_name}` : ""}.
                              Use sign in instead or check the EPIC number.
                            </div>
                          ) : (
                            <form onSubmit={requestSignupOtp} className="mt-5 space-y-4">
                              <div>
                                <label className="label">Mobile number</label>
                                <input
                                  className="input"
                                  inputMode="numeric"
                                  value={phone}
                                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                                  placeholder="10-digit mobile number"
                                  required
                                />
                              </div>
                              <div>
                                <label className="label">Set password</label>
                                <input
                                  type="password"
                                  className="input"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  required
                                />
                              </div>
                              <div>
                                <label className="label">Confirm password</label>
                                <input
                                  type="password"
                                  className="input"
                                  value={confirmPassword}
                                  onChange={(e) => setConfirmPassword(e.target.value)}
                                  required
                                />
                              </div>
                              <button className="btn-primary w-full" disabled={busy}>
                                {busy ? "Sending..." : "Send OTP and continue"}
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={requestSignupOtp} className="mt-5 space-y-4">
                      <div>
                        <label className="label">Full name</label>
                        <input
                          className="input"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Enter full name"
                          required
                        />
                      </div>
                      {signupKind === "recruiter" && (
                        <div>
                          <label className="label">Company name</label>
                          <input
                            className="input"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            placeholder="Enter organization name"
                            required
                          />
                        </div>
                      )}
                      <div>
                        <label className="label">Phone number</label>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                          placeholder="10-digit mobile number"
                          required
                        />
                      </div>
                      <div>
                        <label className="label">Email</label>
                        <input
                          type="email"
                          className="input"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@organization.com"
                          required
                        />
                      </div>
                      <div>
                        <label className="label">Set password</label>
                        <input
                          type="password"
                          className="input"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="label">Confirm password</label>
                        <input
                          type="password"
                          className="input"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </div>
                      <button className="btn-primary w-full" disabled={busy}>
                        {busy ? "Sending..." : "Send OTP and continue"}
                      </button>
                    </form>
                  )}

                  <div className="mt-6 text-center text-sm text-muted">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => resetState("signin")}
                      className="font-semibold text-brand-blue hover:underline"
                    >
                      Sign in
                    </button>
                  </div>
                </>
              )}

              {pageMode === "signup" && signupStep === "otp" && (
                <form onSubmit={completeSignup} className="mt-6 space-y-4">
                  {demoOtp && (
                    <div className="rounded-[24px] border border-dashed border-brand-blue/30 bg-brand-blueTint/60 px-4 py-4 text-sm">
                      <div className="flex items-start gap-3">
                        <IconTile icon={<IconCheck width={16} height={16} />} accent="blue" size="sm" />
                        <div>
                          <p className="font-semibold text-ink">Demo OTP available</p>
                          <p className="mt-1 text-body">In this prototype the OTP is shown on screen instead of being sent by SMS.</p>
                          <p className="tnum mt-3 text-2xl font-bold tracking-[0.3em] text-brand-blue">{demoOtp}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="label">One-time password</label>
                    <input
                      className="input tracking-[0.3em]"
                      inputMode="numeric"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter OTP"
                      required
                    />
                  </div>
                  <button className="btn-primary w-full" disabled={busy}>
                    {busy ? "Verifying..." : "Create account"}
                  </button>
                </form>
              )}

              <div className="mt-8 border-t border-line pt-5">
                <div className="mb-3 flex items-center gap-2">
                  <IconTile icon={<IconTarget width={16} height={16} />} accent="orange" size="sm" />
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Demo access</p>
                </div>
                <div className="grid gap-2">
                  {DEMO_ACCESS.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        resetState("signin");
                        if (item.kind === "youth") {
                          setSigninKind("youth");
                          setSigninVoterId(item.voterId ?? "");
                        } else {
                          setSigninKind("staff");
                          setSigninEmail(item.email ?? "");
                        }
                        setSigninPassword(item.password);
                      }}
                      className="flex w-full items-center justify-between rounded-2xl border border-transparent bg-canvas/60 px-4 py-3 text-left transition hover:border-line hover:bg-white"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-ink">{item.label}</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {item.kind === "youth" ? "Voter ID login" : "Email login"}
                        </span>
                      </span>
                      <span className="tnum text-xs text-muted">
                        {item.kind === "youth"
                          ? `${item.voterId} / ${item.password}`
                          : `${item.email} / ${item.password}`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
