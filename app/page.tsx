import RoutineFlowApp from "@/components/RoutineFlowApp";
import { requireApprovedAccount } from "@/src/auth/server";
import { AccountBar } from "@/components/auth/AccountBar";
import { SessionBoundary } from "@/components/auth/SessionBoundary";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { user, profile, admin } = await requireApprovedAccount();
  return <SessionBoundary userId={user!.id}>
    <AccountBar name={profile?.full_name || user!.email || "Konto"} admin={admin} />
    <RoutineFlowApp account={{ id: user!.id, fullName: profile?.full_name || "", admin }} />
  </SessionBoundary>;
}
