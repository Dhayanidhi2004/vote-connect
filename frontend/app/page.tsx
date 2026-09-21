import Link from "next/link";
import {
  IconArrowRight,
  IconBriefcase,
  IconChart,
  IconGradCap,
  IconIdCard,
  IconInstitution,
  IconUsers,
} from "@/components/icons";

const TN_OPPORTUNITY_URL = "https://tamil-nadu-youth-opportunity.vercel.app/";

const navItems = [
  ["Home", "#home"],
  ["About Us", "#about"],
  ["Services", "#services"],
  ["Youth Corner", "/youth"],
  ["Recruiters", "/recruiter"],
  ["Training", "/provider"],
  ["Contact Us", "#contact"],
];

const services = [
  { title: "Voter ID Verification", text: "Verify and create your profile", icon: IconIdCard, color: "bg-[#1559cf]" },
  { title: "Skill Assessment", text: "AI-based skill evaluation", icon: IconUsers, color: "bg-[#238f2f]" },
  { title: "Training & Development", text: "Access quality training programs", icon: IconGradCap, color: "bg-[#ed5d00]" },
  { title: "Job Matching & Placement", text: "Find the right job opportunities", icon: IconBriefcase, color: "bg-[#5930a8]" },
];

const stats = [
  { value: "10K+", label: "Youth Registered", icon: IconUsers, color: "text-[#188333]" },
  { value: "500+", label: "Training Programs", icon: IconGradCap, color: "text-[#175bd2]" },
  { value: "200+", label: "Recruiter Partners", icon: IconInstitution, color: "text-[#f05a00]" },
  { value: "85%", label: "Placement Rate", icon: IconChart, color: "text-[#5c2daa]" },
];

function Logo() {
  return <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="JobNadu home">
    <span className="relative block h-[62px] w-[62px] shrink-0 overflow-hidden" aria-hidden="true">
      <img
        src="/jobnadu-green.png"
        alt=""
        className="absolute left-[-39px] top-[-12px] h-[142px] w-[142px] max-w-none transition-transform duration-300 group-hover:scale-[1.04]"
      />
    </span>
    <span className="leading-none">
      <span className="block text-[25px] font-black tracking-[-.045em] sm:text-[30px]">
        <span className="text-[#07358e]">Job</span><span className="text-[#08a52c]">Nadu</span>
      </span>
      <span className="mt-1 hidden text-[8px] font-semibold uppercase tracking-[.12em] text-[#26364e] sm:block">
        Connecting Talent with Opportunity
      </span>
    </span>
  </Link>;
}

export default function HomePage() {
  return <main id="home" className="min-h-screen bg-white text-[#081b50]">
    <header className="relative z-30 border-b border-[#e7ebf3] bg-white shadow-[0_2px_12px_rgba(12,38,90,.06)]">
      <div className="mx-auto flex h-[96px] max-w-[1536px] items-center justify-between gap-6 px-5 sm:px-10">
        <Logo/>
        <nav className="hidden items-center gap-9 xl:flex" aria-label="Main navigation">
          {navItems.map(([label, href], index) => <Link key={label} href={href} className={`relative py-8 text-[15px] font-medium text-[#111827] transition hover:text-[#197126] ${index === 0 ? "text-[#197126] after:absolute after:bottom-[18px] after:left-0 after:h-[2px] after:w-full after:bg-[#238b2d]" : ""}`}>{label}</Link>)}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="inline-flex h-[42px] items-center rounded-[8px] border border-[#5e88de] px-5 text-[14px] font-semibold text-[#092b72] transition hover:bg-[#f2f6ff]">Login</Link>
          <Link href="/login" className="hidden h-[42px] items-center rounded-[8px] bg-[#248329] px-5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-[#176c1e] sm:inline-flex">Register</Link>
        </div>
      </div>
      <nav className="flex gap-7 overflow-x-auto border-t border-[#eef1f6] px-5 py-3 xl:hidden" aria-label="Mobile navigation">
        {navItems.map(([label, href]) => <Link key={label} href={href} className="shrink-0 text-[13px] font-semibold text-[#10275c]">{label}</Link>)}
      </nav>
    </header>

    <section id="about" className="relative min-h-[665px] overflow-hidden bg-[linear-gradient(90deg,#fff_0%,#f7fbff_42%,#ddecff_100%)] scroll-mt-28">
      <div className="absolute inset-0 hidden bg-cover bg-center bg-no-repeat lg:block" style={{ backgroundImage: "url('/jobnadu-hero-clear.png')" }} aria-hidden="true"/>
      <div className="relative z-10 mx-auto max-w-[1536px] px-6 pb-14 pt-[90px] sm:px-[68px] lg:pr-[52%]">
        <p className="inline-flex rounded-full bg-[#edf6ed] px-4 py-2 text-[16px] font-medium text-[#176624]">Empowering Youth, Building a Stronger Constituency</p>
        <h1 className="mt-7 text-[clamp(48px,5.2vw,74px)] font-extrabold leading-[1.06] tracking-[-.035em] text-[#093179]">
          Your Identity.<br/>Your Skills.<br/><span className="text-[#2a8b30]">Your Future.</span>
        </h1>
        <p className="mt-5 max-w-[520px] text-[17px] leading-[1.7] text-[#1f2937]">A voter ID based AI-powered platform connecting youth, recruiters and skill development centers to create better opportunities at the constituency level.</p>
        <div className="mt-7 flex flex-wrap gap-5">
          <Link href="/login" className="inline-flex h-[50px] items-center gap-5 rounded-[8px] bg-[#288b2d] px-8 text-[16px] font-semibold text-white shadow-[0_8px_20px_rgba(40,139,45,.2)] hover:bg-[#207625]">Get Started <IconArrowRight width={18} height={18}/></Link>
          <Link href="#services" className="inline-flex h-[50px] items-center gap-5 rounded-[8px] border border-[#85b88a] bg-white px-8 text-[16px] font-semibold text-[#177126] hover:bg-[#f1f8f1]">Learn More <IconArrowRight width={18} height={18}/></Link>
        </div>
        <a
          href={TN_OPPORTUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-7 flex max-w-[480px] items-center gap-4 rounded-[14px] border border-[#cfe0fb] bg-white/90 p-4 pr-5 shadow-[0_10px_26px_rgba(11,37,86,.10)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#8fb3ef] hover:shadow-[0_14px_32px_rgba(11,37,86,.16)]"
          aria-label="Open TN Youth Opportunity Network in a new tab"
        >
          <span className="grid h-[48px] w-[48px] shrink-0 place-items-center rounded-full bg-[#1559cf] text-white"><IconChart width={24} height={24}/></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-[.12em] text-[#2a8b30]">Statewide · All 38 districts</span>
            <span className="mt-1 block text-[17px] font-extrabold leading-tight text-[#093179]">TN Youth Opportunity Network</span>
            <span className="mt-0.5 block text-[13px] text-[#4b5563]">Education, industry &amp; jobs across Tamil Nadu</span>
          </span>
          <span className="shrink-0 text-[20px] font-bold text-[#1559cf] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true">↗</span>
        </a>
      </div>

      <div id="services" className="absolute bottom-6 right-[2.5%] z-20 hidden w-[675px] grid-cols-4 rounded-[18px] border border-[#dfe5ed] bg-white px-4 py-5 shadow-[0_15px_40px_rgba(11,37,86,.15)] lg:grid scroll-mt-28">
        {services.map(({ title, text, icon: Icon, color }, index) => <article key={title} className={`px-3 text-center ${index ? "border-l border-[#e1e5ec]" : ""}`}>
          <span className={`mx-auto grid h-[64px] w-[64px] place-items-center rounded-full text-white ${color}`}><Icon width={30} height={30}/></span>
          <h2 className="mt-4 min-h-[42px] text-[14px] font-extrabold uppercase leading-[1.35] text-[#0d1528]">{title}</h2>
          <p className="mt-2 text-[13px] leading-[1.4] text-[#242b3a]">{text}</p>
        </article>)}
      </div>
    </section>

    <section className="relative z-20 mx-auto -mt-1 max-w-[1536px] px-5 sm:px-9">
      <div className="grid overflow-hidden rounded-[17px] border border-[#dfe5ec] bg-white shadow-[0_10px_30px_rgba(14,42,88,.08)] sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ value, label, icon: Icon, color }, index) => <article key={label} className={`flex min-h-[170px] flex-col items-center justify-center px-5 text-center ${index ? "border-t border-[#e4e8ee] sm:border-l sm:border-t-0" : ""}`}>
          <Icon width={40} height={40} className={color}/>
          <strong className="mt-4 text-[25px] font-extrabold text-[#081b50]">{value}</strong>
          <span className="mt-1 text-[15px] text-[#1f2937]">{label}</span>
        </article>)}
      </div>
    </section>

    <footer id="contact" className="mx-auto mb-3 mt-5 max-w-[1465px] px-5 scroll-mt-28">
        <div className="flex flex-col gap-5 rounded-[15px] bg-[linear-gradient(90deg,#07175c,#092c78)] px-7 py-5 text-white shadow-[0_8px_20px_rgba(7,23,92,.16)] lg:flex-row lg:items-center lg:justify-between">
          <p className="flex items-center gap-4 text-[16px]"><IconUsers width={34} height={34}/><span>Building a skilled, employed and empowered youth community.</span></p>
        <div className="flex flex-wrap items-center gap-x-7 gap-y-3 text-[14px]"><span><b>Phone:</b> 1800-123-4567</span><span><b>Email:</b> info@constituencyyouth.in</span><span className="flex gap-3" aria-label="Social media"><i className="grid h-8 w-8 place-items-center rounded-full bg-white/10 not-italic">f</i><i className="grid h-8 w-8 place-items-center rounded-full bg-white/10 not-italic">X</i><i className="grid h-8 w-8 place-items-center rounded-full bg-white/10 not-italic">in</i></span></div>
      </div>
    </footer>
  </main>;
}
