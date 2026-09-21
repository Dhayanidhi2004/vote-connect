import Link from "next/link";
import { IconIdCard } from "./icons";

export function Logo({
  light = false,
  href = "/",
}: {
  light?: boolean;
  href?: string;
}) {
  return (
    <Link href={href} className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none">
      <span
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-tile ${
          light
            ? "border-white/15 bg-white/10 text-white"
            : "border-blue-200 bg-brand-blue text-white"
        }`}
      >
        <IconIdCard width={22} height={22} />
      </span>
      <span className="min-w-0 leading-tight">
        <span
          className={`block truncate font-display text-[16px] font-bold tracking-tight ${
            light ? "text-white" : "text-ink"
          }`}
        >
          VoteConnect
        </span>
        <span
          className={`block truncate text-[10px] font-medium ${
            light ? "text-white/60" : "text-muted"
          }`}
        >
          Your Vote. Your Future. Your Opportunity.
        </span>
      </span>
    </Link>
  );
}
