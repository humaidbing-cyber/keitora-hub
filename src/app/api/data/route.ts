import { NextResponse } from "next/server";
import { requireAdmin, HttpError } from "@/lib/auth";
import { snapshot } from "@/lib/service";
import { reports } from "@/lib/reports";
import { jsonSafe } from "@/lib/money";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireAdmin();
    const data = await snapshot();
    return NextResponse.json(jsonSafe({ ...data, report: reports(data) }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof HttpError
            ? e.message
            : "Database unavailable. Check the local setup.",
      },
      { status: e instanceof HttpError ? e.status : 503 },
    );
  }
}
