import type { Metadata } from "next";

export const metadata: Metadata = { title: "Konto | RoutineFlow", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function AuthLayout({ children }: { children: React.ReactNode }) { return children; }
