# Constituency Youth Employment Platform — Technical Blueprint

> **Voter ID-Based Youth Placement & Skill Development System**
> Connecting Youth, Recruiters, and Skill Development Centers through constituency-level AI matching.
>
> Status: **Architecture blueprint (no code yet)** · Author role: Principal Architect / Staff Eng / Pragmatic CTO
> Source of truth for scope & design: `docs/design-refs/gj_page_1..8.png` (the pitch deck).

---

## 1. Executive Summary

We are building a **three-sided, single-constituency web platform** that lets **Youth** create a verified job-seeker profile, get an **AI employability score + skill-gap analysis + training recommendations**, and get matched to jobs; lets **Recruiters/Companies** post jobs, search/filter candidates, and run a hiring pipeline; and gives the **MLA/Constituency office** a real-time employment dashboard.

**Recommended architecture style: a single, boring, well-structured modular monolith** (one deployable web app + one relational database + a small background-job worker), not microservices. At the scale in the deck (~45,000 youth, ~650 recruiters, one constituency), a monolith is faster to ship, cheaper to run, easier to secure, and trivially scalable for years. AI matching is an internal module, not a separate service.

**Why this fits:**
- **Speed-to-market** — one codebase, one deploy, one DB. A small team ships the full 3-portal MVP in weeks, not months.
- **Reliability & low ops burden** — managed Postgres + a single app host. Nothing exotic to page someone about at 2am.
- **Security & compliance** — one trust boundary, one place to enforce role-based access, consent, and audit logging (this app handles sensitive personal data of youth in India → **DPDP Act 2023** applies).
- **Right-sized AI** — skill-gap and job-matching are solved well by **weighted rule scoring + a normalized skills taxonomy**, optionally upgraded to text embeddings later. No GPU, no model training on day one.

**The one architectural decision that shapes everything: identity.** The deck sells "Voter ID as verified identity," but *no private/MLA-sponsored platform can authoritatively verify an EPIC (Voter ID) number against the Election Commission database* — that access is restricted to government (ERONET). See §3 and §4. **Recommendation: anchor identity on phone-OTP (+ optional DigiLocker/Aadhaar), and treat Voter ID as a captured, consented claim with lightweight/deferred verification.** This keeps the product's "verified constituency youth" promise honest and legal without blocking launch.

---

## 2. Assumptions + Scope Boundaries

### Explicit assumptions
1. **Single constituency** first (the deck's "Your Constituency"). Multi-constituency is a later config change, not a rewrite — we design the schema constituency-aware from day one but ship one.
2. **Actors = 3 roles:** Youth (job seeker), Recruiter (company), MLA/Admin (constituency office + platform operator). Skill Development Centers appear in the deck but for MVP their "training programs" are **catalog entries an admin manages**, not a self-serve 4th portal.
3. **Voter ID cannot be verified against ECI in real time by us.** Treated as claimed data (format-validated, deduplicated, optionally OCR-assisted, human-reviewable). Real identity anchor = **phone number + OTP**; DigiLocker/Aadhaar optional upgrade.
4. **Scale is modest and single-region (India):** low tens of thousands of users, hundreds of recruiters. This fits comfortably on one managed DB + one app instance. No sharding, no multi-region.
5. **"AI" = deterministic weighted matching + skill taxonomy** for MVP. LLM/embedding features are additive and gated behind a feature flag.
6. **Language:** English UI first; the design must be i18n-ready (Tamil/Hindi likely later given the constituency context). Copy is externalized, not hard-coded.
7. **Mobile-first web** (most youth are on phones). Responsive web app, not native apps, for MVP. PWA-installable is a cheap add-on.
8. **Payments are out of scope for MVP** — this is a government/welfare-style free service.

### Intentionally excluded from MVP (explicit non-goals)
- Native iOS/Android apps.
- Real-time ECI/Aadhaar biometric verification, and any scraping of government databases.
- In-platform video interviews / chat (link out to phone/Google Meet instead).
- Automated course delivery / LMS (we link to external training; we don't host video courses).
- Multi-constituency tenancy, org billing, marketplace payments.
- ML model training pipelines, recommendation A/B infra, data-science notebooks.
- Anything not shown in the 8 deck pages. **Implement exactly what the deck depicts.**

---

## 3. Domain Model & Roles (what the deck actually requires)

Derived page-by-page from the pitch deck:

| Deck page | What it depicts | Product surface it maps to |
|---|---|---|
| 1 — Hero | 5-step flow: Voter ID Verify → Register → Skill Assess → Skill Dev → Placement | Public landing page + the youth journey spine |
| 2 — Challenges | Problem framing (unemployment cycle) | Public "Why" / about section |
| 3 — Proposed Solution | 6-step ecosystem, key benefits | Public "How it works" section |
| 4 — Youth Registration | Voter ID entry → verify → auto-map constituency → upload education/resume → **Youth Profile card w/ employability score 78/100** | **Youth portal:** onboarding wizard + profile |
| 5 — Skill Dev & AI | Skill-gap analysis, current vs industry-demand, recommendations (courses, certs, apprenticeships, govt schemes) | **Youth portal:** skill-gap + recommendations screen |
| 6 — Recruiter Integration | Post jobs, search candidates, advanced filters, AI match scores, recruiter dashboard, hiring pipeline (Applied→Shortlisted→Interview→Selected→Joined) | **Recruiter portal:** jobs, candidate search, pipeline |
| 7 — Constituency Dashboard | Totals (45k youth, 18.5k seekers, 650 recruiters, 53% placement), charts (status donut, monthly placements, top skill demand, demographics, constituency comparison), employment score 87/100 | **MLA/Admin portal:** analytics dashboard |
| 8 — Impact & Vision | Outcomes/marketing | Public closing section |

### Core entities (conceptual — not schema)
- **User** (auth identity: phone + role) → 1:1 with **YouthProfile** *or* membership in a **RecruiterOrg**, or **AdminRole**.
- **YouthProfile:** claimed Voter ID/EPIC, constituency (auto-mapped from a static constituency/ward reference table, not from ECI), education, experience, resume file, **skills[]** (normalized), employability score, verification status.
- **Skill** (canonical taxonomy) + **YouthSkill** (self-declared/assessed level) + **SkillDemand** (constituency/industry demand weight) → drives **skill gap**.
- **RecruiterOrg** + **Job** (skills required, experience, location, salary band) + **Application** (the pipeline stage machine) + **Interview**.
- **TrainingProgram / Scheme** (admin-managed catalog for recommendations).
- **MatchScore** (derived youth×job).
- **AuditLog**, **ConsentRecord** (DPDP), **VerificationRequest**.

---

## 4. The Identity Decision (highest-risk item — read before building)

**Claim in the deck:** "Verify youth using Voter ID / System verifies with Election database to ensure authenticity."

**Reality:** The authoritative electoral roll / EPIC verification system (**ERONET / ECI**) is a government-internal system and is **not** exposed as an API to private developers or MLA-sponsored apps. Commercial "Voter ID verification" APIs (Signzy, IDfy, Karza/Perfios, Zoop, Surepass, etc.) largely perform **OCR + format/checksum validation and best-effort lookups**, not an authoritative real-time match — and their legality hinges on **consent + DPDP compliance**. *(Confirmed by research brief — see §12.)*

**Recommendation (ship-safe, honest):**
1. **Primary identity anchor = phone number + OTP.** Cheap, universal, works on any phone, no legal grey area. This gives us a real, deduplicated account.
2. **Voter ID/EPIC = a consented claimed attribute.** Format-validate it, dedupe it (one EPIC → one account), optionally OCR the card image the youth uploads. Mark profile as `epic_provided` not `epic_verified`.
3. **"Verified" badge** is earned by: phone verified **+** (DigiLocker document pull *or* admin/booth-level manual review). DigiLocker is the legitimate, consented, government-backed way to pull verified documents — the correct upgrade path.
4. **Constituency mapping** comes from the youth selecting ward/constituency (validated against a static reference table we load), **not** from querying ECI.
5. Keep the UI language as "verified profile" but back it with real, lawful verification — don't imply an ECI live check we don't have.

This preserves the deck's entire value proposition (a *verified constituency youth database*) while being legal and shippable today. It's a config/feature-flag away from adding DigiLocker later.

---

## 5. Recommended Tech Stack (boring, proven)

| Concern | Choice | Why |
|---|---|---|
| App framework | **Next.js (React) full-stack**, or Django if team is Python-first | One codebase serves all 3 portals + API; SSR good for SEO on public pages; huge talent pool |
| Language | **TypeScript** end-to-end (or Python/Django) | Type safety across a data-heavy app |
| Database | **PostgreSQL (managed)** | Relational fits this domain perfectly; JSONB for flexible skill blobs; proven |
| Auth | **Phone OTP** via an SMS provider (e.g. MSG91/Twilio) + session cookies; role-based | Simplest lawful identity; no password reset hell |
| File storage | **S3-compatible object storage** (resumes, ID card images) | Cheap, offloads the app |
| Background jobs | One **worker** (queue) for OTP sends, score recompute, emails/SMS | Keeps requests fast |
| Search/matching | **Postgres full-text + weighted SQL scoring** for MVP; optional pgvector for embeddings later | No separate search cluster needed at this scale |
| Charts (dashboards) | A charting lib (Recharts/Chart.js) styled to the deck | Pages 4,7 are chart-heavy |
| Hosting | **One managed platform** (Vercel/Render/Railway/Fly) + managed Postgres + object store | Lowest ops burden; scales vertically for years |
| Observability | Managed error tracking (Sentry) + platform logs + uptime ping | Enough for launch |

**Concrete recommended pick (fastest lawful path to launch):** **Next.js (App Router) + Supabase (managed Postgres + Auth + Storage + pgvector) on Vercel.** Supabase bundles exactly what this app needs — phone-OTP auth, file storage for resumes/ID images, Row-Level Security that maps cleanly onto the three roles (youth/recruiter/MLA), and pgvector for the later embedding-based matching upgrade — collapsing several moving parts into one managed platform.

**Explicitly avoided:** microservices, Kubernetes, Kafka, a separate ML service, GraphQL, multi-cloud. None are justified at this scale and all slow the launch.

---

## 6. Page / Screen Inventory (the "what pages can we make" answer)

Grouped by surface. **★ = MVP-critical (directly in the deck).** Others are supporting.

### A. Public / Marketing (mirrors deck pages 1,2,3,8 — this is where we follow the PDF design most literally)
1. ★ **Landing / Hero** — the "Voter ID-Based Youth Placement" hero, 5-step flow, dual CTAs ("I'm looking for a job" / "I'm hiring"). *(deck p1)*
2. ★ **How it works** — 6-step ecosystem, key benefits. *(deck p3)*
3. **The problem** — challenges / unemployment cycle. *(deck p2)*
4. **Impact & Vision** — outcomes. *(deck p8)*
5. Login / OTP screen · Role picker · About · Privacy & consent (DPDP) · Contact.

### B. Youth Portal ★ (deck p4, p5)
6. ★ **Registration wizard** — step 1 phone-OTP → step 2 enter Voter ID (claimed) → step 3 auto/selected constituency → step 4 education & experience → step 5 upload resume → step 6 skill assessment.
7. ★ **Youth Profile** — the verified profile card with **employability score gauge** (the 78/100 dial), skills chips, education, experience, resume. *(deck p4)*
8. ★ **Skill Gap & Recommendations** — current vs. industry-demand comparison, recommended courses/certs/apprenticeships/govt schemes. *(deck p5)*
9. ★ **Job matches / Job board** — AI-ranked jobs, match %, apply.
10. **My applications** — youth-side pipeline status (Applied→Shortlisted→Interview→Selected→Joined).
11. Notifications, settings, consent management.

### C. Recruiter Portal ★ (deck p6)
12. ★ **Recruiter dashboard** — active jobs / applications / shortlisted / hired tiles + top matched candidates. *(deck p6)*
13. ★ **Post/Manage a Job** — skills, experience, location, salary.
14. ★ **Candidate search** — advanced filters (skills, education, experience, location, salary) + AI match score, "View Profile".
15. ★ **Hiring pipeline (Kanban)** — Applied→Shortlisted→Interview→Selected→Joined, schedule interview.
16. Company profile, team members, settings.

### D. MLA / Admin Portal ★ (deck p7)
17. ★ **Constituency dashboard** — overview tiles (total youth, seekers, recruiters, training enrolled, placed, placement rate), employment pipeline funnel, charts (employment-status donut, monthly-placements bar, top skill demand, demographics: gender/age/education, constituency comparison), **constituency employment score gauge** (87/100). *(deck p7)*
18. **Admin management** — moderate users, verify profiles (manual verification queue), manage training/scheme catalog & skill taxonomy, manage recruiters, export reports.
19. Audit log / consent register view (compliance).

**MVP cut line:** Ship A(1,2,5) + B(6,7,8,9,10) + C(12,13,14,15) + D(17, minimal 18). Everything else is fast-follow.

---

## 7. UX & Design System (following the PDF design)

The deck has a strong, consistent visual identity — we lift it directly so the product feels like the pitch.

**Palette (sampled from the deck):**
- Primary navy `#0A2A63` (headers, nav, section badges, footer band)
- Bright blue `#1F6FD6` (primary actions, links)
- Green `#2FA84F` (success, "verified", positive metrics)
- Orange `#E8792B` (skill/assessment accents, warnings)
- Purple `#7B4FC4` (secondary accents, training)
- Teal `#1F9E8F`, Red `#D8382B` (status), on light-gray `#F4F6FA` canvas, white cards.

**Typography:** heavy geometric/grotesque sans for headings (Poppins/Montserrat-family feel), clean humanist sans for body. Bold ALL-CAPS section titles with a colored subtitle line — exactly like each deck page.

**Signature components to build (they recur across the deck):**
- **Numbered section badge** (navy square, white number) — reused as step indicators.
- **Icon tile** (rounded-square, colored, flat icon) — the visual vocabulary of every page.
- **Pipeline/flow strip** with arrows (the 5-/6-step flows, the hiring pipeline funnel).
- **Score gauge** (radial dial: employability 78/100, constituency 87/100).
- **Stat tile row** (the dashboard KPI tiles).
- **Profile card** (the verified youth card on p4).
- **Gradient navy footer band** with tagline ("Empowering Youth • Strengthening Skills • Building a Better Future").

**UX principles:**
- **Mobile-first** — youth are on phones; wizard steps are one-thing-per-screen; big tap targets.
- **Trust cues everywhere** — "Verified" green badges, employability score front-and-center; the platform's whole promise is credibility.
- **Progressive disclosure** — the registration is a 6-step wizard with a progress bar, never one giant form.
- **Empty/first-run states** designed (new youth with 0 matches, recruiter with 0 jobs).
- **Accessibility** — WCAG AA contrast (the navy/white pairing already passes), keyboard nav, semantic HTML; matters for a government-facing service.
- **i18n-ready** — externalized copy for Tamil/Hindi later.
- A **design tokens file** (colors, spacing, radius, shadows) drives everything so it stays consistent.

---

## 8. High-Level Data Flow (matching / scoring)

**Employability score (p4) & Skill gap (p5) — deterministic v1:**
`score = weighted(education_level, experience_years, skill_coverage_vs_demand, resume_completeness, verification_level)` → normalized 0–100 with a labeled band (Good/Excellent). Skill gap = `constituency_demand_skills − youth_skills`, ranked by demand weight → drives recommendations pulled from the admin-managed training/scheme catalog.

**Job match (p6) — deterministic v1:**
`match% = weighted(skill_overlap, experience_fit, location/constituency_fit, salary_fit)`. Computed in SQL, cached on write, recomputed by the worker when a job or profile changes. **Upgrade path:** replace skill_overlap with embedding cosine similarity (pgvector) behind a flag — no architecture change.

**Dashboard (p7):** nightly (or on-write) rollup aggregates into a `constituency_stats` table so the MLA dashboard loads instantly instead of scanning raw tables.

---

## 9. Security, Privacy & Compliance (non-negotiable)

This app holds **sensitive personal data of Indian youth** (identity claims, resumes, contact info) → **DPDP Act 2023** governs it.
- **Explicit, logged consent** at registration (purpose-bound); consent-withdrawal + account/data deletion flow.
- **Data minimization** — collect only what the deck's flow needs; don't store Aadhaar numbers; store ID-card images encrypted with tight access + retention limits.
- **RBAC** enforced server-side on every request; recruiters see only permitted candidate fields (not raw Voter ID).
- **Audit logging** of who viewed/exported youth data (MLA/admin actions especially).
- Encryption in transit (TLS) + at rest; signed, expiring URLs for file access; rate-limiting on OTP and search; standard OWASP protections.
- **No scraping of government systems.** All verification is consented (DigiLocker) or manual.
- Data-protection notice + grievance contact published (DPDP requirement).

---

## 10. Delivery Sequencing (ship-fast plan)

**Phase 0 — Foundation (day 1):** repo, boring stack scaffold, design tokens from §7, auth (phone OTP), roles, DB schema, deploy pipeline, one seeded constituency + skill taxonomy.

**Phase 1 — Youth spine (the demo that sells it):** registration wizard → profile card w/ employability gauge → skill-gap + recommendations. *(deck p4, p5)*

**Phase 2 — Recruiter + matching:** post job → candidate search w/ match% → application pipeline. Youth "my applications" mirror. *(deck p6)*

**Phase 3 — MLA dashboard:** stat tiles + charts + constituency employment score from the rollup table. *(deck p7)*

**Phase 4 — Public site + polish:** landing/how-it-works/impact pages styled to the deck, consent/privacy, empty states, accessibility pass, admin verification queue. *(deck p1,2,3,8)*

**Phase 5 — Hardening:** security review, load check, backups/restore drill, error tracking, then launch.

> "Done today" reality check: the full 3-portal system is a multi-week build. **What is genuinely achievable in one focused day is Phase 0 + a clickable, deck-accurate front-end of Phase 1** — the exact scope trade-off is a decision for you (see §13).

---

## 11. Key Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Voter ID can't be authoritatively verified | **High** | Phone-OTP anchor + DigiLocker/manual verify; honest "verified" semantics (§4) |
| DPDP non-compliance (sensitive youth data) | **High** | Consent, minimization, RBAC, audit, deletion flow (§9) |
| "AI matching" over-promised | Medium | Deterministic weighted scoring ships now; embeddings are an optional upgrade |
| Scope creep (Skill Centers as 4th portal, LMS, video) | Medium | Explicit non-goals (§2); admin-managed catalog instead |
| "Done today" expectation vs. real build size | Medium | Sequenced phases; agree the one-day deliverable up front (§13) |
| Data quality of constituency/skill reference tables | Low | Seed from public constituency lists + a curated skill taxonomy |

---

## 12. Research Findings (internet) — summary

*(Populated from the research brief; see §4 for the load-bearing conclusion.)*

**1. Voter ID / EPIC verification (critical):**
- ECI's **ERONET 2.0 is an internal government system**, role-restricted to Election Commission officials — **no public/private developer API**. Citizens get only manual, captcha-gated single lookups on the Voters' Services Portal; bulk/programmatic access is not offered. *(eci.gov.in/ero-net-eci)*
- Third-party vendors (Surepass, Signzy, IDfy, Perfios/Karza, Attestr, AuthBridge, Zoop) mostly do **OCR + format/checksum validation plus a lookup that mirrors the public electoral-search page** — none document a licensed, authoritative real-time ECI feed. **Treat their "validation" as best-effort demographic match, not authoritative confirmation.**
- **DPDP Act 2023:** Voter ID is personal data → requires free, specific, informed, unambiguous consent via clear affirmative action, preceded by a notice (data + purpose), data minimization, and erasure on withdrawal. Enforcement rules are still phasing in (timeline extends toward ~2027) — confirm current status with counsel before launch.
- **Bottom line: do NOT use EPIC as the login/identity key.** Anchor on phone-OTP + optional DigiLocker; capture EPIC as a consented, OCR-assisted, format-validated, "unverified"-flagged attribute. *(This is exactly §4.)*

**2. Government interop:**
- **National Career Service (NCS, ncs.gov.in)** — India's flagship job-matching portal, already integrates **DigiLocker** and links e-Shram/PMKVY/AICTE. Good reference model.
- **Skill India Digital Hub (SIDH)** — skilling DPI (Aadhaar, NCVET certs, DigiLocker credentials).
- **DigiLocker is the real, consent-based integration point** for pulling verified documents — prioritize it over any Voter-ID API. NCS/SIDH's own APIs are partner/MoU-gated, not self-serve.

**3. AI matching:** Proven pattern at this scale = **hybrid: hard rules/filters (location, min qualification, sector) + text embeddings (`all-MiniLM-L6-v2` or a hosted embedding API) + vector search via pgvector**, combined by a tuned weighted score. Tens of thousands of rows is small — **pgvector inside Postgres is enough; no dedicated vector DB needed.** Pure rules = brittle; pure embeddings = ignores hard constraints. Ship weighted-rules v1, add embeddings behind a flag.

**4. Proven fast stack (2026):** Consensus "boring" stack = **Next.js (App Router) + Postgres (Supabase bundles auth/storage/pgvector) + Vercel**, optional Drizzle ORM / Clerk. Role-based access (youth/recruiter/MLA) maps cleanly onto Supabase Row-Level Security — a strong accelerator for this exact 3-role app.

**Uncertainty flags:** no vendor publicly proves authoritative ECI validation (verify contractually before relying); DPDP enforcement dates still phasing in (confirm with counsel).

---

## 13. Decisions (RESOLVED) & what was built

The user chose to build the **entire system as a working local demo prototype**. Decisions made:

1. **Deliverable:** full working prototype (all 3 portals + public site + real logic), local.
2. **Stack (as built):** **Next.js (App Router) + TypeScript + Tailwind + Recharts** frontend; **Python FastAPI + SQLAlchemy** backend; **local Supabase (Postgres 17)** as the database via the pure-Python `pg8000` driver (falls back to SQLite if `DATABASE_URL` is unset).
3. **Identity (as built):** phone-OTP anchor (OTP shown on screen in demo); **Voter ID captured as a claimed, consented attribute** (`epic_provided`, not authoritatively verified); admin verification queue grants the "verified" badge. DigiLocker is the documented later upgrade.
4. **Skill Development Centers:** admin-managed **training/scheme catalog** (not a 4th portal), surfaced as youth recommendations.

**Ports:** backend on **:8001** (local Supabase occupies :8000), frontend on **:3000**, Supabase Studio on **:54323**. See `RUN.md`.

Seed mirrors the deck: Velachery/Chennai/TN, KPIs 45,000 youth · 18,500 seekers · 650 recruiters · 9,800 placed · 53% · **87/100 Excellent**, the Karthik R profile, the page-6 candidates, and the Jan–Jun placement trend.
