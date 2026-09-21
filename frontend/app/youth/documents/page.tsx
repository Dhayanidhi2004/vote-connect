"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconShieldCheck } from "@/components/icons";
import { EmptyState, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api, ApiError } from "@/lib/api";
import type { CandidateDocument } from "@/lib/types";

export default function DocumentsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<CandidateDocument[] | null>(null);
  const [type, setType] = useState("identity");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get<CandidateDocument[]>("/api/youth/documents").then(setRows).catch(() => setRows([])); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!file) return toast("Choose a document first", "error"); setBusy(true);
    try { const row = await api.post<CandidateDocument>("/api/youth/documents", { document_type: type, filename: file.name }); setRows((old) => [row, ...(old || [])]); setFile(null); toast("Document submitted for Admin verification", "success"); }
    catch (error) { toast(error instanceof ApiError ? error.message : "Could not submit document", "error"); }
    finally { setBusy(false); }
  }
  if (!rows) return <Spinner label="Loading documents..." />;
  return <div className="space-y-6"><PageHeader title="Document verification" subtitle="Submit your documents securely. Admin verifies them before final placement." />
    <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-[1fr_2fr_auto]"><label><span className="label">Document type</span><select className="input" value={type} onChange={(e) => setType(e.target.value)}><option value="identity">Identity proof</option><option value="resume">Resume</option><option value="certificate">Certificate</option><option value="licence">Licence</option><option value="other">Other</option></select></label><label><span className="label">Choose file</span><input className="input" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label><button className="btn-primary self-end" disabled={busy}>{busy ? "Submitting..." : "Submit"}</button><p className="sm:col-span-3 text-xs text-muted">Demo stores file metadata only; connect cloud storage before production.</p></form>
    {rows.length ? <section className="card overflow-hidden"><table className="grid-table"><thead><tr><th>Document</th><th>File</th><th>Status</th><th>Admin note</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td className="capitalize font-semibold">{row.document_type}</td><td>{row.filename}</td><td><span className="chip capitalize">{row.verification_status}</span></td><td>{row.reviewer_notes || "-"}</td></tr>)}</tbody></table></section> : <EmptyState icon={<IconShieldCheck />} title="No documents submitted" body="Submit identity, certificate or licence documents for verification." />}
  </div>;
}
