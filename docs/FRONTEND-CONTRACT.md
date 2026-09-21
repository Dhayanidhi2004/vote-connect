# Frontend build contract (READ FULLY before writing any page)

You are building pages for a Next.js 15 (App Router) + TypeScript + Tailwind app: the
**Constituency Youth Employment Platform** ("YuvaSetu"). It follows a government pitch
deck. The design system, API client, auth, and all shared components ALREADY EXIST.
**Do NOT modify shared files. Only create files under your assigned route group.**

Project root: `/Users/pspranavram2005/Desktop/Project/constituency-youth-platform/frontend`
Deck reference images: `../docs/design-refs/gj_page_1..8.png` (view the ones for your portal).

## Design language (match the deck)
- Deep navy `navy-800 #0A2A63` headers; accents `brand-blue #1F6FD6` (primary), `brand-green`
  (verified/success), `brand-orange` (skills), `brand-purple` (training), `brand-teal` (jobs),
  `brand-red` (alerts). Canvas `#F4F6FA`, white cards, `line #E4E9F2` borders.
- Display font `font-display` (Poppins, bold/extrabold, UPPERCASE section titles); body `font-sans`.
- Card-based, generous spacing, rounded-2xl, soft shadows. Mobile-first & responsive.
- Numbered navy section badges, coloured icon tiles, pipeline strips, score gauges.

## Ready-made CSS utility classes (in globals.css)
`container-page`, `card`, `eyebrow`, `section-title`, `btn-primary`, `btn-navy`, `btn-ghost`,
`chip`, `input`, `label`, `footer-band`.

## Shared components — import and REUSE these (do not reinvent)
From `@/components/ui`:
- `SectionBadge({ n })` — navy numbered badge.
- `IconTile({ icon, accent, size })` — `accent`: blue|green|orange|purple|teal|navy|red; size sm|md|lg.
- `StatTile({ label, value, icon?, accent?, sub? })` — dashboard KPI tile.
- `VerifiedBadge({ status })` — status: "verified"|"pending"|"unverified".
- `PipelineStrip({ steps })` — steps: `{label, icon, accent}[]`.
- `MatchBar({ score })` — 0-100 match bar with % label.
- `SkillChip`, `PageHeader({ n?, title, subtitle?, right? })`, `EmptyState({icon?,title,body?,action?})`,
  `Spinner({label?})`, `CtaLink({href, children, variant?})`, `FooterBand`, `cx(...)`, type `Accent`.
From `@/components/gauge`: `ScoreGauge({ score, max?, band?, label?, size?, stars? })` — the radial dial.
From `@/components/charts` (client): `DonutChart`, `VBarChart`, `HBarChart({data,highlightName?})`, `MiniPie`
  — all take `data: {name, value}[]`.
From `@/components/icons`: `IconShieldCheck, IconUserCheck, IconUsers, IconSkill, IconGradCap,
  IconBriefcase, IconTarget, IconChart, IconInstitution, IconSearch, IconFilter, IconCalendar,
  IconDoc, IconLocation, IconIdCard, IconSpark, IconArrowRight, IconCheck, IconTrendingUp, IconRupee`.
From `@/components/portal-shell`: `PortalShell({ nav, accentLabel, children })`, type `NavItem = {href,label}`.

## Auth & data
From `@/lib/auth`: `useAuth()` → `{user, loading, login, logout}`; `useRequireRole(roles: Role[])` →
`{user, loading}` (redirects if wrong role — call at top of each portal layout).
From `@/lib/api`: `api.get/post/put/patch/del<T>(path, body?)` — bearer token auto-attached. Throws `ApiError`.
From `@/lib/types`: import the interfaces (User, YouthProfile, Job, Candidate, Application, SkillGap,
  RecruiterDashboard, MlaDashboard, Skill, Constituency, TrainingProgram, PipelineFunnel, NameValue, etc.).

Pages that use hooks/state/effects MUST start with `"use client";`.

## Backend endpoints (base http://localhost:8000, already running)
Reference (any auth): `GET /api/reference/skills`, `/constituencies`, `/training`.

YOUTH (role youth):
- `GET /api/youth/profile` → YouthProfile
- `PUT /api/youth/profile` body: partial { epic_number, constituency_id, gender, age, education_level,
  education_field, institution, graduation_year, experience_years, experience_title, experience_company,
  resume_filename, skills:[{skill_id,level}], consent, complete_onboarding } → YouthProfile
- `GET /api/youth/skill-gap` → SkillGap {current_skills, demand_skills, gap_skills, recommendations[]}
- `GET /api/youth/jobs` → Job[] (each has match_score, already_applied)
- `POST /api/youth/jobs/{id}/apply` → Application
- `GET /api/youth/applications` → Application[]

RECRUITER (role recruiter):
- `GET /api/recruiter/dashboard` → RecruiterDashboard {active_jobs,total_applications,shortlisted,hired,
  top_candidates:Candidate[], pipeline:PipelineFunnel}
- `GET /api/recruiter/jobs` → Job[];  `POST /api/recruiter/jobs` body JobIn {title, description?, location?,
  constituency_id?, min_experience, salary_min?, salary_max?, education_required?, skills:[{skill_id,weight}]}
- `PATCH /api/recruiter/jobs/{id}/close`
- `GET /api/recruiter/candidates?skill_id=1&skill_id=2&education_level=Graduate&min_experience=1&constituency_id=1&job_id=3`
  → Candidate[]  (all query params optional; job_id ranks by match to that job)
- `GET /api/recruiter/applications?job_id=` → Application[] (has youth_name, job_title, stage, match_score)
- `PATCH /api/recruiter/applications/{id}/stage` body {stage} — stage in applied|shortlisted|interview|selected|joined|rejected
- `POST /api/recruiter/applications/{id}/interview` body {scheduled_at?, mode, notes?}

ADMIN/MLA (role admin):
- `GET /api/admin/dashboard` → MlaDashboard (kpis, employment_score, employment_score_band, pipeline,
  employment_status[], monthly_placements[], top_skill_demand[], gender[], age_group[], education_level[], comparison[])
- `GET /api/admin/verification-queue` → YouthProfile[]
- `PATCH /api/admin/youth/{id}/verify?approve=true`
- `GET /api/admin/training`; `POST /api/admin/training` body TrainingProgramIn {title, program_type, provider?,
  description?, target_skill_id?, url?, duration?}; `DELETE /api/admin/training/{id}`

## Quality bar
- Faithful to the relevant deck page(s). Loading (`Spinner`) + empty (`EmptyState`) + error states handled.
- Accessible: semantic HTML, labelled inputs, visible focus (utilities already do this), good contrast.
- No TypeScript errors; import types; no `any` unless unavoidable. Keep components reasonably sized.
