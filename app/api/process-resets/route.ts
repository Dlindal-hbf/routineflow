import { NextRequest, NextResponse } from "next/server";
import { processResets } from "@/src/server/process-resets";
import { ResetEngineInput } from "@/src/lib/scheduling/reset-types";
import { getAccount } from "@/src/auth/server";

export async function POST(request: NextRequest) {
  const { approved } = await getAccount();
  if (!approved) return NextResponse.json({ ok: false }, { status: 403 });
  try {
    const body = (await request.json()) as ResetEngineInput;
    const result = processResets(body, new Date());

    return NextResponse.json({
      ok: true,
      summary: result.summary,
      lists: result.lists,
      tasks: result.tasks,
      history: result.history,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Failed to process resets",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 }
    );
  }
}

export async function GET() {
  const { approved } = await getAccount();
  if (!approved) return NextResponse.json({ ok: false }, { status: 403 });
  return NextResponse.json({
    ok: true,
    message:
      "process-resets endpoint is ready. POST lists/tasks/history payload to process due resets.",
  });
}
