import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, HttpError } from "@/lib/auth";
import { snapshot } from "@/lib/service";
import { reports } from "@/lib/reports";
import { decimal } from "@/lib/money";
const cell = (v: unknown) => {
  let s =
    v === null || v === undefined
      ? ""
      : typeof v === "bigint"
        ? decimal(v)
        : v instanceof Date
          ? v.toISOString()
          : typeof v === "object"
            ? JSON.stringify(v)
            : String(v);
  if (/^[=+@\t\r]/.test(s) || /^-[^0-9]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
};
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const d = await snapshot();
    const r = reports(d);
    const type = req.nextUrl.searchParams.get("type") || "vehicles";
    const sets: Record<string, unknown[]> = {
      vehicles: r.vehicles,
      bills: r.bills,
      sales: r.sales,
      suppliers: r.suppliers,
      customers: r.customers,
      payments: d.payments,
      cash: d.payments.filter((p) => p.status === "VERIFIED"),
      monthly: r.monthly,
      comparison: r.comparison,
      audit: d.audits,
    };
    const rows = sets[type];
    if (!rows) throw new HttpError(400, "Unknown report.");
    const keys = rows.length
      ? Object.keys(rows[0] as object)
      : ["No recorded data"];
    const csv =
      "\uFEFF" +
      [
        keys.map(cell).join(","),
        ...rows.map((row) =>
          keys.map((k) => cell((row as Record<string, unknown>)[k])).join(","),
        ),
      ].join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="keitora-${type}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof HttpError ? e.message : "Export unavailable." },
      { status: e instanceof HttpError ? e.status : 503 },
    );
  }
}
