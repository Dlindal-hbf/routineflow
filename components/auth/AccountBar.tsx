import Link from "next/link";
import { LogOut, UsersRound } from "lucide-react";
import { signOut } from "@/src/auth/actions";
import { Button } from "@/components/ui/button";

export function AccountBar({ name, admin = false }: { name: string; admin?: boolean }) {
  return <div className="border-b bg-white px-4 py-3">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-3">
      <span className="min-w-0 break-all text-sm text-foreground/70">{name}</span>
      {admin && <Button asChild variant="outline" size="sm"><Link href="/admin/users"><UsersRound />Kontoforespørsler</Link></Button>}
      <form action={signOut}><Button type="submit" variant="ghost" size="sm"><LogOut />Logg ut</Button></form>
    </div>
  </div>;
}
