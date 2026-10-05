import { NextResponse } from "next/server";
import { getAccount } from "@/src/auth/server";

export async function GET() {
  const { approved, user } = await getAccount();
  return NextResponse.json({ approved, userId: user?.id ?? null }, { status: approved ? 200 : 403, headers: { "Cache-Control": "private, no-store" } });
}
