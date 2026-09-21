"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconShieldCheck } from "@/components/icons";
import { EmptyState, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api, ApiError } from "@/lib/api";
import type { CandidateDocument } from "@/lib/types";

export default function AdminDocumentsPage() {
  const toast = useToast(); const [rows, setRows] = useState<CandidateDocument[] | null>(null); const [busy, setBusy] = useState<number | null>(null);
  useEffect(() => { api.get<CandidateDocument[]>("/api/admin/documents").then(setRows).catch(() => setRows([])); }, []);
  async function review(row: CandidateDocument, approve: boolean) { setBusy(row.id); try { await api.patch(`/api/admin/documents/${row.id}/verify`, { approve, reviewer_notes: approve ? "Verified by Admin" : "Document needs correction" }); setRows((old) => old?.filter((item) => item.id !== row.id) || []); toast(`Document ${approve ? "verified" : "rejected"}`, approve ? "success" : "info"); } catch (error) { toast(error instanceof ApiError ? error.message : "Could not update document", "error"); } finally { setBusy(null); } }
  if (!rows) return <Spinner label="Loading document queue..." />;
  return <div className="space-y-6"><PageHeader title="Document verification" subtitle="Verify identity, certificates, licences and resumes before final placement." />{rows.length ? <section className="card overflow-hidden"><table className="grid-table"><thead><tr><th>Candidate</th><th>Type</th><th>File</th><th>Submitted</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td className="font-semibold">{row.youth_name}</td><td className="capitalize">{row.document_type}</td><td>{row.filename}</td><td>{new Date(row.created_at).toLocaleDateString()}</td><td><div className="flex gap-2"><button className="btn-primary !min-h-8 !px-3 !py-1" disabled={busy === row.id} onClick={() => review(row, true)}>Verify</button><button className="btn-ghost !min-h-8 !px-3 !py-1 !text-brand-red" disabled={busy === row.id} onClick={() => review(row, false)}>Reject</button></div></td></tr>)}</tbody></table></section> : <EmptyState icon={<IconShieldCheck />} title="No documents pending" body="Documents submitted by youth will appear here." />}</div>;
}
