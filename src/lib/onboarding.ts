import { todayDubai } from "./money";
import { z } from "zod";
import { vehicleSchema } from "./validation";
export const importSchema = z
  .object({
    vehicles: z
      .array(vehicleSchema.omit({ id: true }))
      .min(1)
      .max(100),
  })
  .superRefine((v, ctx) => {
    const codes = new Set<string>();
    const chassis = new Set<string>();
    v.vehicles.forEach((row, i) => {
      if (row.committedAt && row.committedAt > todayDubai())
        ctx.addIssue({
          code: "custom",
          path: ["vehicles", i, "committedAt"],
          message: "Commitment date cannot be in the future.",
        });
      if (
        [row.code, row.make, row.model, row.notes].some((s) =>
          /REPLACE-WITH|TEMPLATE ONLY/i.test(s),
        )
      )
        ctx.addIssue({
          code: "custom",
          path: ["vehicles", i],
          message: "Replace all template values with actual supplied details.",
        });
      if (codes.has(row.code))
        ctx.addIssue({
          code: "custom",
          path: ["vehicles", i, "code"],
          message: "Duplicate vehicle ID in import.",
        });
      codes.add(row.code);
      if (row.chassis && chassis.has(row.chassis))
        ctx.addIssue({
          code: "custom",
          path: ["vehicles", i, "chassis"],
          message: "Duplicate chassis in import.",
        });
      if (row.chassis) chassis.add(row.chassis);
      if (row.status !== "JAPAN_POOL" && !row.committedAt)
        ctx.addIssue({
          code: "custom",
          path: ["vehicles", i, "committedAt"],
          message: "Agreement date required.",
        });
      if (["SOLD", "DELIVERED"].includes(row.status))
        ctx.addIssue({
          code: "custom",
          path: ["vehicles", i, "status"],
          message:
            "Import as UAE_INVENTORY; create the genuine sale agreement, then mark sold/delivered.",
        });
      if (
        row.year &&
        (Number(row.year) < 1950 ||
          Number(row.year) > Number(todayDubai().slice(0, 4)) + 1)
      )
        ctx.addIssue({
          code: "custom",
          path: ["vehicles", i, "year"],
          message: "Invalid year.",
        });
    });
  });
