import { readJson } from "@/lib/http";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { requireAdmin, checkOrigin, HttpError } from "@/lib/auth";
import { mutate } from "@/lib/service";
import { jsonSafe } from "@/lib/money";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  try {
    await checkOrigin();
    const actor = await requireAdmin();
    if (Number(req.headers.get("content-length") || 0) > 100000)
      throw new HttpError(413, "Request too large.");
    const result = await mutate(
      (await params).module,
      await readJson(req),
      actor.id,
    );
    return NextResponse.json(jsonSafe(result));
  } catch (e) {
    const status =
      e instanceof HttpError
        ? e.status
        : e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002"
          ? 409
          : 400;
    const error =
      e instanceof ZodError
        ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : e instanceof Prisma.PrismaClientKnownRequestError
          ? e.code === "P2002"
            ? "That identifier or payment reference already exists."
            : e.code === "P2025"
              ? "Record not found."
              : "The record could not be saved. Please retry."
          : e instanceof Error && !e.name.startsWith("Prisma")
            ? e.message
            : "Database unavailable. Please retry or check the server configuration.";
    return NextResponse.json({ error }, { status });
  }
}
