import { readJson } from "@/lib/http";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, checkOrigin, HttpError } from "@/lib/auth";
import { importSchema } from "@/lib/onboarding";
import { transaction } from "@/lib/service";
import { fils, jsonSafe } from "@/lib/money";
import { ZodError } from "zod";
export async function POST(req: NextRequest) {
  try {
    await checkOrigin();
    const actor = await requireAdmin();
    const body = (await readJson(req)) as { data: unknown; confirm?: boolean };
    const data = importSchema.parse(body.data);
    const preview = await transaction(async (tx) => {
      const matches = await tx.vehicle.findMany({
        where: {
          OR: [
            { code: { in: data.vehicles.map((v) => v.code) } },
            {
              chassis: {
                in: data.vehicles.map((v) => v.chassis).filter(Boolean),
              },
            },
          ],
        },
      });
      if (matches.length)
        throw new Error(
          "Import conflicts with existing vehicle IDs/chassis: " +
            matches.map((v) => v.code).join(", "),
        );
      for (const row of data.vehicles)
        if (row.supplierId) {
          const p = await tx.party.findUnique({
            where: { id: row.supplierId },
          });
          if (!p || p.kind !== "SUPPLIER" || p.archived)
            throw new Error("Invalid supplier for " + row.code);
        }
      if (body.confirm === true) {
        for (const {
          year,
          chassis,
          committedAt,
          supplierId,
          shippingEstimate,
          ...rest
        } of data.vehicles) {
          const v = await tx.vehicle.create({
            data: {
              ...rest,
              year: year ? Number(year) : null,
              chassis: chassis || null,
              committedAt: committedAt ? new Date(committedAt) : null,
              supplierId: supplierId || null,
              shippingEstimate: fils(shippingEstimate),
            },
          });
          await tx.audit.create({
            data: {
              actorId: actor.id,
              action: "vehicle.import",
              entityId: v.id,
              data: jsonSafe(v),
            },
          });
        }
      }
      return data.vehicles;
    });
    return NextResponse.json({ preview, imported: body.confirm === true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof ZodError
            ? e.issues
                .map((i) => i.path.join(".") + ": " + i.message)
                .join("; ")
            : e instanceof HttpError
              ? e.message
              : e instanceof Error && !e.name.startsWith("Prisma")
                ? e.message
                : "Import failed. No rows were imported; check identifiers and database availability.",
      },
      { status: e instanceof HttpError ? e.status : 400 },
    );
  }
}
