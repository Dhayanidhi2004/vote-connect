# Employment Outcome Enhancements

For the complete point-by-point report coverage, see [REPORT-COMPLIANCE-MATRIX.md](REPORT-COMPLIANCE-MATRIX.md).

This implementation aligns the platform with the two August 2026 employment-service reports supplied for the project:

- *Goal-Oriented & Result-Oriented Enhancement Report for Employment Services*
- *Employment, Career and Skill Services: Advantages, Disadvantages and Their Role in Reducing Youth Unemployment*

## Connected service journey

The platform now supports a measurable pathway instead of stopping at registration:

1. Verified youth profile and employability assessment
2. District-demand skill-gap analysis and career plan
3. Verified course, certification, internship, apprenticeship, or scheme recommendation
4. Training enrollment, progress, practical component, assessment, and completion
5. AI-ranked job matching and the recruiter pipeline
6. Placement-quality capture: wage, employment type, formal benefits, and employer satisfaction
7. Youth check-ins at 3, 6, and 12 months, including retention, wage progression, role fit, satisfaction, and exit reason
8. MLA outcome dashboard for policy and provider feedback

The youth Public Services Hub also provides one-place access to the complementary official
services reviewed in the report: Tamil Nadu Employment & Training, Naan Mudhalvan, National
Career Service, and Skill India Digital Hub, including assisted-access guidance.

## Result-oriented KPIs

The `/api/admin/outcomes` dashboard measures:

- Offer-to-joining conversion
- Median starting salary and average wage growth
- Average time to placement
- Role-skill match
- Formal-benefits coverage
- Candidate and employer satisfaction
- 3-, 6-, and 12-month retention
- Training enrollment, completion, and assessment performance
- Work-based-learning coverage
- Women placement share

These metrics deliberately distinguish registration, enrollment, certificates, offers, joining, and sustained employment.

## Data model additions

- `TrainingEnrollment`: learning progress, assessment, practical exposure, stipend, and provider rating
- `PlacementOutcome`: wage, job-quality, satisfaction, retention milestones, and exit reason

The additions use new tables, so the existing local demo database can be upgraded through the application's normal `create_all` startup without dropping user data. Fresh demo seeds include representative training and outcome records.
