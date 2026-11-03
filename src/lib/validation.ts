import { z } from "zod";
import { fils } from "./money";
const text = z.string().trim().min(1).max(200);
const optional = z.string().trim().max(200).optional().default("");
const notes = z.string().trim().max(4000).optional().default("");
const id = z.string().max(100).optional().default("");
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "Enter a valid date.",
  );
const optDate = z
  .union([date, z.literal("")])
  .optional()
  .default("");
const money = z.string().refine((v) => {
  try {
    return fils(v) > 0n;
  } catch {
    return false;
  }
}, "Enter a positive amount, up to two decimals.");
export const statuses = [
  "JAPAN_POOL",
  "COMMITTED",
  "AWAITING_SHIPMENT",
  "IN_TRANSIT",
  "UAE_INVENTORY",
  "SOLD",
  "DELIVERED",
] as const;
export const categories = [
  "PURCHASE",
  "SHIPPING_IMPORT",
  "MECHANICAL",
  "PAINT",
  "UPHOLSTERY",
  "RIMS",
  "TIRES",
  "ACCESSORIES",
  "PARTS",
  "VEHICLE_TRANSPORT",
  "ADVERTISING",
  "GENERAL_TRANSPORT",
  "MISCELLANEOUS",
];
export const partySchema = z.object({
  id,
  kind: z.enum(["SUPPLIER", "CUSTOMER"]),
  name: text,
  email: z
    .union([z.email(), z.literal("")])
    .optional()
    .default(""),
  phone: optional,
  group: z.enum(["JAPAN", "IMPORT_PARTNER", "LOCAL"]).default("LOCAL"),
  notes,
});
export const vehicleSchema = z.object({
  id,
  code: text,
  make: text,
  model: text,
  year: z
    .union([z.literal(""), z.string().regex(/^\d{4}$/)])
    .optional()
    .default(""),
  chassis: optional,
  acquisition: z.enum(["INVENTORY", "CUSTOMER_SOURCED"]),
  location: z.enum(["JAPAN", "IN_TRANSIT", "UAE"]),
  status: z.enum(statuses),
  committedAt: optDate,
  supplierId: id,
  shippingEstimate: z.string().refine((v) => {
    try {
      return fils(v) >= 0n;
    } catch {
      return false;
    }
  }, "Invalid estimate"),
  notes,
});
export const billSchema = z.object({
  reference: text,
  supplierId: text,
  vehicleId: id,
  category: text,
  description: text,
  notes,
  amount: money,
  originalAmount: money,
  currency: z.string().regex(/^[A-Z]{3}$/),
  issuedAt: date,
  dueAt: optDate,
});
export const saleSchema = z.object({
  reference: text,
  vehicleId: text,
  customerId: text,
  type: z.enum(["AS_IS", "CUSTOMIZED"]),
  amount: money,
  agreedAt: date,
  weights: z.string().regex(/^\d+(,\d+)*$/),
  dueDates: z.array(date).min(1).max(12),
  notes,
});
export const paymentSchema = z.object({
  idempotencyKey: z.string().uuid(),
  reference: text,
  kind: z.enum([
    "SUPPLIER_PAYMENT",
    "CUSTOMER_RECEIPT",
    "CUSTOMER_REFUND",
    "OWNER_CONTRIBUTION",
    "OWNER_WITHDRAWAL",
  ]),
  billId: id,
  saleId: id,
  amount: money,
  date,
  method: z.enum(["BANK_TRANSFER", "CASH"]),
  account: z.enum(["BUSINESS", "PERSONAL"]),
  notes,
});
export const adjustmentSchema = z.object({
  reference: text,
  billId: id,
  saleId: id,
  amount: money,
  reason: z.string().trim().min(5).max(1000),
  date,
});
export const settingsSchema = z.object({
  shippingEstimate: z.string().refine((v) => {
    try {
      return fils(v) >= 0n;
    } catch {
      return false;
    }
  }, "Invalid estimate"),
  vatNote: notes,
  categories: z
    .array(text)
    .min(1)
    .max(40)
    .refine(
      (v) => v.includes("PURCHASE"),
      "Keep the PURCHASE category for vehicle acquisition bills.",
    ),
  plans: z
    .array(
      z.object({
        name: text,
        weights: z.array(z.number().int().positive()).min(1).max(12),
      }),
    )
    .min(1)
    .max(10),
});
export const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify"), id: text }),
  z.object({
    action: z.literal("reverse"),
    id: text,
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal("reconcile"),
    id: text,
    note: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal("saleStatus"),
    id: text,
    status: z.enum(["SOLD", "DELIVERED"]),
    date,
  }),
  z.object({
    action: z.literal("archive"),
    id: text,
    entity: z.enum(["vehicle", "party"]),
  }),
]);
