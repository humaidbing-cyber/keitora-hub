import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireAdmin, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const doc = await db.document.findUnique({
      where: { id: (await params).id },
    });
    if (!doc) throw new HttpError(404, "Document not found.");
    const data = await readFile(
      /* turbopackIgnore: true */ path.join(
        /* turbopackIgnore: true */ path.resolve(
          /* turbopackIgnore: true */ process.env.UPLOAD_DIR ||
            "./private-uploads",
        ),
        doc.key,
      ),
    );
    return new NextResponse(data, {
      headers: {
        "Content-Type": doc.mime,
        "Content-Length": String(data.length),
        "Content-Disposition": `${new URL(req.url).searchParams.get("view") === "1" ? "inline" : "attachment"}; filename="document"; filename*=UTF-8''${encodeURIComponent(doc.name).replace(/'/g, "%27")}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof HttpError ? e.message : "Document unavailable." },
      { status: e instanceof HttpError ? e.status : 404 },
    );
  }
}
