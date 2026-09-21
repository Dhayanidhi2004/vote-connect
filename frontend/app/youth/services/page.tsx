"use client";

import { IconBriefcase, IconGradCap, IconInstitution, IconLaptop, IconTarget } from "@/components/icons";
import { IconTile, PageHeader } from "@/components/ui";


const SERVICES = [
  {
    name: "Tamil Nadu Employment & Training",
    role: "Local assisted access",
    description: "Employment registration, district career guidance, job fairs, counselling, competitive-exam coaching, and local labour-market support.",
    bestFor: "In-person guidance, job fairs, exam support, and assisted digital registration",
    href: "https://tnvelaivaaippu.gov.in/activities.html",
    icon: <IconInstitution />,
    accent: "blue" as const,
  },
  {
    name: "Naan Mudhalvan",
    role: "Education-to-industry bridge",
    description: "Industry-aligned learning, mentorship, internships, apprenticeships, practical exposure, and placement support for Tamil Nadu youth.",
    bestFor: "Students and recent graduates seeking first-work experience",
    href: "https://www.naanmudhalvan.tn.gov.in/internships/",
    icon: <IconGradCap />,
    accent: "green" as const,
  },
  {
    name: "National Career Service",
    role: "National job reach",
    description: "A national marketplace connecting jobseekers, verified employers, counsellors, career centres, skill providers, vacancies, and job fairs.",
    bestFor: "Jobs beyond the district or state and national career information",
    href: "https://www.ncs.gov.in/Pages/about-us.aspx",
    icon: <IconBriefcase />,
    accent: "orange" as const,
  },
  {
    name: "Skill India Digital Hub",
    role: "Lifelong digital skilling",
    description: "Course discovery, personalised learning, assessments, credentials, apprenticeships, jobs, reskilling, and entrepreneurship pathways.",
    bestFor: "Flexible online learning, certification, reskilling, and self-employment discovery",
    href: "https://www.skillindiadigital.gov.in/about-us",
    icon: <IconLaptop />,
    accent: "purple" as const,
  },
];


export default function PublicServicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Public Employment Services Hub"
        subtitle="Use one connected journey while each official service does what it does best."
      />

      <section className="card p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
          {["Profile", "Assessment", "Skill-gap plan", "Training", "Work experience", "Verified match", "Placement", "Retention"].map((step, index, all) => (
            <div key={step} className="flex items-center gap-2">
              <span className="rounded-full bg-brand-blueTint px-3 py-1.5 text-brand-blue">{step}</span>
              {index < all.length - 1 && <span aria-hidden="true">→</span>}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {SERVICES.map((service) => (
          <article key={service.name} className="card flex flex-col p-5">
            <div className="flex items-start gap-3">
              <IconTile icon={service.icon} accent={service.accent} />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-brand-blue">{service.role}</div>
                <h2 className="mt-1 font-display text-xl font-bold text-navy-800">{service.name}</h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-body">{service.description}</p>
            <div className="mt-4 rounded-lg bg-canvas px-3 py-2 text-sm text-muted">
              <strong className="text-ink">Best for:</strong> {service.bestFor}
            </div>
            <a
              href={service.href}
              target="_blank"
              rel="noreferrer"
              className="btn-primary mt-5 self-start"
            >
              Open official service
            </a>
          </article>
        ))}
      </div>

      <section className="card p-5">
        <div className="flex items-start gap-3">
          <IconTile icon={<IconTarget />} accent="teal" />
          <div>
            <h2 className="section-title text-xl">Need assisted access?</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Youth without a device, connectivity, English confidence, or digital literacy should use a district career centre, college support desk, library, or Common Service Centre for profile, resume, and application help. Never pay an unverified intermediary for a public-service registration or job offer.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
