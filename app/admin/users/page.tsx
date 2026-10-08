import Link from "next/link";
import { ArrowLeft, ArrowRight, MailCheck, Mail } from "lucide-react";
import { requireAdministrator } from "@/src/auth/server";
import { AccountBar } from "@/components/auth/AccountBar";
import { ReviewAccountForm } from "@/components/auth/ReviewAccountForm";
import { Button } from "@/components/ui/button";
import type { AccountProfile } from "@/src/auth/types";

export const dynamic = "force-dynamic";
const statuses = { pending: "Venter", approved: "Godkjent", suspended: "Suspendert", rejected: "Avslått" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; request?: string }> }) {
  const { user, profile, supabase } = await requireAdministrator();
  const params = await searchParams;
  const status = params.status && params.status in statuses ? params.status as keyof typeof statuses : "pending";
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page ?? "1", 10) || 1));
  const requestId = params.request && /^[0-9a-f-]{36}$/i.test(params.request) ? params.request : null;
  let query = supabase.from("account_profiles").select("*", { count: "exact" }).order("created_at", { ascending: false });
  query = requestId ? query.eq("id", requestId) : query.eq("approval_status", status);
  const { data, count, error } = await query.range((page - 1) * 25, page * 25 - 1);
  if (error) throw new Error("Unable to load account requests.");
  const profiles = (data ?? []) as AccountProfile[];
  const date = (value: string) => new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Oslo" }).format(new Date(value));
  return <>
    <AccountBar name={profile?.full_name || "Administrator"} />
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft className="size-4" />RoutineFlow</Link>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-foreground/70">Administrasjon</p><h1 className="text-2xl font-semibold">Kontoforespørsler</h1></div><span className="text-sm text-foreground/70">{count ?? 0} kontoer</span></header>
      <nav aria-label="Kontostatus" className="mb-6 flex flex-wrap gap-6 border-b">
        {Object.entries(statuses).map(([value, label]) => <Link key={value} href={`/admin/users?status=${value}`} aria-current={!requestId && value === status ? "page" : undefined} className={`border-b-2 px-1 py-3 text-sm font-medium ${!requestId && value === status ? "border-primary text-primary" : "border-transparent text-foreground/70"}`}>{label}</Link>)}
      </nav>
      {profiles.length === 0 ? <p className="py-12 text-center text-foreground/70">Ingen kontoforespørsler i denne visningen.</p> : <ul className="divide-y border-y bg-white">
        {profiles.map((account) => <li key={account.id} className="grid min-w-0 gap-4 px-4 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0"><h2 className="break-words font-semibold">{account.full_name || "Navn mangler"}</h2><p className="break-all text-sm text-foreground/70">{account.email || "Ingen e-postadresse"}</p><p className="mt-1 text-xs text-foreground/70">Forespurt {date(account.created_at)}</p></div>
          <div className="space-y-2 text-sm"><span className={`inline-flex rounded px-2 py-0.5 ${account.approval_status === "approved" ? "bg-green-50 text-green-800" : account.approval_status === "pending" ? "bg-accent/20 text-foreground" : "bg-muted text-foreground/70"}`}>{statuses[account.approval_status]}</span>
            <p className="flex items-center gap-2 text-xs text-foreground/70">{account.email_verified_at ? <MailCheck className="size-4" /> : <Mail className="size-4" />}{account.email_verified_at ? "E-post bekreftet" : "E-post ikke bekreftet"}</p>
            {account.reviewed_at && <p className="text-xs text-foreground/70">Vurdert {date(account.reviewed_at)}</p>}
          </div>
          <div className="flex items-center">{account.id !== user!.id && <ReviewAccountForm profile={account} />}</div>
        </li>)}
      </ul>}
      <nav aria-label="Sider" className="mt-6 flex items-center justify-between gap-3">
        {page > 1 ? <Button asChild variant="outline"><Link href={`/admin/users?status=${status}&page=${page - 1}`}><ArrowLeft />Forrige</Link></Button> : <span />}
        <span className="text-sm text-foreground/70">Side {page}</span>
        {(count ?? 0) > page * 25 ? <Button asChild variant="outline"><Link href={`/admin/users?status=${status}&page=${page + 1}`}>Neste<ArrowRight /></Link></Button> : <span />}
      </nav>
    </main>
  </>;
}
