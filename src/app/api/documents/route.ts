import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { requireAdmin, checkOrigin, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
export const runtime = "nodejs";
const MAX = 10 * 1024 * 1024;
export async function POST(req: NextRequest) {
  let stored: string | undefined;
  try {
    await checkOrigin();
    const actor = await requireAdmin();
    const reader = req.body?.getReader();
    if (!reader) throw new Error("Choose a file.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX + 100000) {
        await reader.cancel();
        throw new HttpError(413, "Maximum file size is 10 MB.");
      }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": req.headers.get("content-type") || "" },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > MAX)
      throw new Error(
        "Choose a non-empty PDF, PNG, JPEG or WebP, up to 10 MB.",
      );
    const meta = z
      .object({
        entityType: z.enum(["vehicle", "bill", "sale", "payment", "party"]),
        entityId: z.string().min(1),
        category: z.enum([
          "VEHICLE_PHOTO",
          "RECEIPT",
          "SUPPLIER_BILL",
          "QUOTATION",
          "INVOICE",
          "OTHER",
        ]),
      })
      .parse(Object.fromEntries(form));
    const models = {
      vehicle: db.vehicle,
      bill: db.bill,
      sale: db.sale,
      payment: db.payment,
      party: db.party,
    };
    const exists = await (
      models[meta.entityType] as unknown as {
        findUnique: (a: { where: { id: string } }) => Promise<unknown>;
      }
    ).findUnique({ where: { id: meta.entityId } });
    if (!exists) throw new Error("Linked record not found.");
    const data = Buffer.from(await file.arrayBuffer());
    let mime = "";
    if (data.subarray(0, 5).toString() === "%PDF-") mime = "application/pdf";
    else if (
      data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      mime = "image/png";
    else if (data[0] === 255 && data[1] === 216 && data[2] === 255)
      mime = "image/jpeg";
    else if (
      data.subarray(0, 4).toString() === "RIFF" &&
      data.subarray(8, 12).toString() === "WEBP"
    )
      mime = "image/webp";
    if (!mime)
      throw new Error("Unsupported file contents. Use PDF, PNG, JPEG or WebP.");
    const dir = path.resolve(
      /* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./private-uploads",
    );
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const key = randomUUID();
    stored = path.join(/* turbopackIgnore: true */ dir, key);
    await writeFile(stored, data, { flag: "wx", mode: 0o600 });
    const doc = await db.$transaction(async (tx) => {
      const d = await tx.document.create({
        data: {
          ...meta,
          name:
            file.name.replace(/[\r\n\x00-\x1f]/g, "").slice(0, 180) ||
            "document",
          key,
          mime,
          size: data.length,
        },
      });
      await tx.audit.create({
        data: {
          actorId: actor.id,
          action: "document.upload",
          entityId: d.id,
          data: {
            name: d.name,
            entityType: d.entityType,
            entityId: d.entityId,
          },
        },
      });
      return d;
    });
    return NextResponse.json({ id: doc.id });
  } catch (e) {
    if (stored) await unlink(stored).catch(() => {});
    return NextResponse.json(
      {
        error:
          e instanceof Error && !("code" in e) && !e.name.startsWith("Prisma")
            ? e.message
            : "Upload failed. Check private storage and database availability.",
      },
      { status: e instanceof HttpError ? e.status : 400 },
    );
  }
}
