# AI Skill Assessment and Job Matching

## Reused architecture

- Next.js App Router, Tailwind design tokens, portal shell, toast/loading components and typed API client.
- FastAPI role authentication, SQLAlchemy models, Youth/Skill/Job entities and existing scoring helpers.
- Existing Gemini structured-output adapter. `ASSESSMENT_AI_MODE=auto` uses Gemini when `GEMINI_API_KEY` is configured; `deterministic` is the offline-safe explainable evaluator. Keys remain environment variables.
- Existing active jobs, job skills, constituency, experience, salary and mobility profile data.

AI output is advisory. Admin, recruiter or employer retains the final verification and hiring decision.

## Candidate flow

1. Youth opens **AI Assessment**, selects IT, Non-IT or General Workforce and a target role.
2. IT youth selects claimed skills. Non-IT and General Workforce questions use role-specific skills so irrelevant technical questions are not generated.
3. Difficulty begins from claimed skill level/experience. Sets include concept/MCQ, scenario, practical, coding (IT) and experience questions as appropriate.
4. Answers are evaluated for correctness, practical understanding, clarity, problem solving and completeness. Grammar and English fluency are excluded.
5. The service generates per-skill scores, overall score, configurable knowledge level, strengths and gaps.
6. Active jobs are compared using structured requirements. Results show match factors, matched/missing skills, mandatory failures, explanations and gap recommendations.
7. Admin/recruiter reviews question performance and records practical verification scores.

General Workforce questions are short, practical, Tamil/English friendly and do not depend on degree or resume unless a job explicitly requires them.

## Scoring

Default assessment formula:

`MCQ 20% + Scenario 25% + Practical 20% + Coding 25% + Experience 10%`

Only applicable components are normalized for a category. Default knowledge thresholds are `0,40,60,80,90` for Needs Training, Basic, Intermediate, Advanced and Expert.

Default match formula:

`Skill 45% + Experience 20% + Location 10% + Salary 10% + Availability 5% + Education/Certificate/Licence 5% + Optional Skills 5%`

Default match thresholds are `0,50,65,80,90` for Low, Partial, Good, Strong and Excellent. Missing mandatory skills, licence, certificate, category or education are highlighted and cap the recommendation below Strong/Excellent. Both weight groups and threshold sets are Admin configurable and validated.

## Database changes

New entities:

- `AssessmentConfig`, `AssessmentTemplate`
- `CandidateAssessment`, `AssessmentQuestion`, `AssessmentAnswer`, `CandidateSkillScore`
- `PracticalVerification`
- `JobRequirement`, `JobRequiredSkill`
- `CandidateJobMatch`, `SkillGapAnalysis`

Youth profile additions: `candidate_category`, `target_role`, `notice_period_days`, `certificates`. SQLite demo columns are added idempotently by `ensure_runtime_schema`; SQLAlchemy creates new tables on startup.

## REST APIs

Youth:

- `POST /api/assessments/youth/start`
- `GET /api/assessments/youth/current`
- `GET /api/assessments/youth/history`
- `POST /api/assessments/youth/{assessment_id}/submit`

Admin/recruiter:

- `GET /api/assessments/admin/queue` with category, role, status, knowledge, minimum skill and minimum match filters
- `GET /api/assessments/admin/{assessment_id}`
- `POST /api/assessments/admin/{assessment_id}/practical`
- `GET|PUT /api/assessments/configuration/weights` (Admin)
- `GET /api/assessments/configuration/jobs`
- `PUT /api/assessments/configuration/jobs/{job_id}`

## Files

Created: `backend/app/assessment_engine.py`, `backend/app/routers/assessment_router.py`, `frontend/app/youth/assessment/page.tsx`, and `frontend/app/mla/assessments/page.tsx`.

Modified: backend models, schemas, database compatibility patch, router registration, startup and enhancement seed; frontend shared types, Youth/MLA navigation and Tamil labels.

## Testing and example flow

1. Start backend and frontend using `RUN.md`.
2. Youth login with demo phone `9000000003`; open `/youth/assessment`.
3. Test each category, select a role, answer and submit.
4. Confirm skill/overall scores, level, strengths, gaps, recommended jobs, factor scores and mandatory warnings.
5. Admin login with `mla@jobnadu.demo` / `demo123`; open `/mla/assessments`.
6. Exercise filters, open a candidate, save practical verification, change valid 100%-total weights and configure requirements.
7. Verify invalid weights/thresholds and scores outside 0-100 return validation errors.
8. Run Python compile, TypeScript no-emit and the Next.js production build.

Example: an IT youth selects Excel, SQL and Java, answers role-level questions, and receives separate scores plus an overall level. Matching compares the scores with job minimums and experience, location, salary and availability. A missing mandatory licence is visibly flagged; Admin records the practical result before any final decision.

## Fairness safeguards

Prompts and deterministic logic exclude gender, religion, caste, race, disability, marital status and other protected traits. Age is not scored. English grammar, degree and resume absence do not reduce scores unless explicitly required. Every match includes a human-readable reason and the permanent advisory disclaimer.
