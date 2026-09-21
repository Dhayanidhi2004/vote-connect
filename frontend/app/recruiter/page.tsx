"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  EmptyState,
  MatchBar,
  PageHeader,
  Spinner,
  StatTile,
} from "@/components/ui";
import {
  IconBriefcase,
  IconDoc,
  IconTarget,
  IconUserCheck,
  IconUsers,
} from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import type { Candidate, RecruiterDashboard } from "@/lib/types";
import { Avatar, CandidateProfile, HiringFunnel, Modal } from "./_components";

export default function RecruiterDashboardPage() {
  const [data, setData] = useState<RecruiterDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);

  useEffect(() => {
    api
      .get<RecruiterDashboard>("/api/recruiter/dashboard")
      .then(setData)
      .catch((e: unknown) =>
        setError(e instanceof ApiError ? e.message : "Failed to load dashboard."),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (error || !data)
    return (
      <EmptyState
        icon={<IconBriefcase width={26} height={26} />}
        title="Could not load dashboard"
        body={error ?? undefined}
      />
    );

  return (
    <div className="space-y-8">
      <PageHeader
        n={6}
        title="Recruiter Dashboard"
        subtitle="Smarter hiring · Local talent"
        right={
          <Link href="/recruiter/jobs" className="btn-primary">
            Post a job
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Active Jobs"
          value={data.active_jobs}
          accent="blue"
          icon={<IconBriefcase width={22} height={22} />}
        />
        <StatTile
          label="Applications"
          value={data.total_applications}
          accent="teal"
          icon={<IconDoc width={22} height={22} />}
        />
        <StatTile
          label="Shortlisted"
          value={data.shortlisted}
          accent="orange"
          icon={<IconUsers width={22} height={22} />}
        />
        <StatTile
          label="Hired"
          value={data.hired}
          accent="green"
          icon={<IconUserCheck width={22} height={22} />}
        />
      </div>

      <section className="card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="section-title text-lg">Top Matched Candidates</h2>
          <Link
            href="/recruiter/candidates"
            className="text-sm font-semibold text-brand-blue hover:underline"
          >
            Search candidates
          </Link>
        </div>

        {data.top_candidates.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            No matched candidates yet. Post a job to start matching.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="grid-table min-w-[640px]">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="pb-3 pr-4">Candidate</th>
                  <th className="pb-3 pr-4">Match Score</th>
                  <th className="pb-3 pr-4">Skills</th>
                  <th className="pb-3 pr-4">Experience</th>
                  <th className="pb-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.top_candidates.map((c) => (
                  <tr key={c.youth_id} className="border-b border-line/60 last:border-0">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} size="sm" />
                        <div className="min-w-0">
                          <div className="font-semibold text-navy-800">{c.name}</div>
                          <div className="text-xs text-muted">
                            {[c.education_level, c.constituency_name]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <MatchBar score={c.match_score} />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {c.skills.slice(0, 3).map((s) => (
                          <span key={s} className="chip">
                            {s}
                          </span>
                        ))}
                        {c.skills.length > 3 && (
                          <span className="chip">+{c.skills.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-navy-700">
                      {c.experience_years} yr
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <button
                        onClick={() => setSelected(c)}
                        className="btn-ghost !px-3 !py-1.5 text-xs"
                      >
                        View profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="section-title mb-4 text-lg">Hiring Pipeline</h2>
        <HiringFunnel pipeline={data.pipeline} />
      </section>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Candidate profile"
      >
        {selected && <CandidateProfile candidate={selected} />}
      </Modal>
    </div>
  );
}
