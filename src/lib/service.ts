import { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";
import {
  fils,
  splitInstallments,
  sum,
  netReceipts,
  assertAllocation,
  jsonSafe,
  todayDubai,
} from "./money";
import {
  partySchema,
  vehicleSchema,
  billSchema,
  saleSchema,
  paymentSchema,
  adjustmentSchema,
  settingsSchema,
  actionSchema,
  categories,
} from "./validation";
import { HttpError } from "./auth";
type Tx = Prisma.TransactionClient;
const audit = (
  tx: Tx,
  actorId: string,
  action: string,
  entityId: string,
  data: unknown,
) =>
  tx.audit.create({
    data: { actorId, action, entityId, data: jsonSafe(data) },
  });
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let i = 0; i < 4; i++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: "Serializable",
        timeout: 15000,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2034" &&
        i < 3
      )
        continue;
      throw e;
    }
  }
  throw new Error("Please retry.");
}
async function supplier(tx: Tx, id: string) {
  const p = await tx.party.findUnique({ where: { id } });
  if (!p || p.kind !== "SUPPLIER" || p.archived)
    throw new Error("Select an active supplier.");
  return p;
}
async function allocation(
  tx: Tx,
  p: {
    kind: string;
    amount: bigint;
    billId: string | null;
    saleId: string | null;
  },
) {
  if (p.billId) {
    const bill = await tx.bill.findUniqueOrThrow({
      where: { id: p.billId },
      include: { payments: true, adjustments: true },
    });
    assertAllocation(
      p.kind,
      p.amount,
      sum(
        bill.payments
          .filter((p) => p.status === "VERIFIED")
          .map((p) => p.amount),
      ),
      bill.amount - sum(bill.adjustments.map((a) => a.amount)),
    );
  } else if (p.saleId) {
    const sale = await tx.sale.findUniqueOrThrow({
      where: { id: p.saleId },
      include: { payments: true, adjustments: true },
    });
    assertAllocation(
      p.kind,
      p.amount,
      netReceipts(sale.payments),
      sale.amount - sum(sale.adjustments.map((a) => a.amount)),
    );
  }
}
export async function mutate(module: string, input: unknown, actorId: string) {
  return transaction(async (tx) => {
    if (module === "parties") {
      const { id, ...v } = partySchema.parse(input);
      const data = { ...v, email: v.email || null, phone: v.phone || null };
      if (id) {
        const old = await tx.party.findUniqueOrThrow({ where: { id } });
        if (old.kind !== v.kind) throw new Error("Party type cannot change.");
      }
      const result = id
        ? await tx.party.update({ where: { id }, data })
        : await tx.party.create({ data });
      await audit(
        tx,
        actorId,
        id ? "party.update" : "party.create",
        result.id,
        data,
      );
      return result;
    }
    if (module === "vehicles") {
      const v = vehicleSchema.parse(input);
      if (v.committedAt && v.committedAt > todayDubai())
        throw new Error("A commitment date cannot be in the future.");
      if (v.supplierId) await supplier(tx, v.supplierId);
      if (
        v.year &&
        (Number(v.year) < 1950 ||
          Number(v.year) > Number(todayDubai().slice(0, 4)) + 1)
      )
        throw new Error("Enter a valid model year.");
      if (v.status !== "JAPAN_POOL" && !v.committedAt)
        throw new Error(
          "A committed vehicle needs its purchase agreement date.",
        );
      const old = v.id
        ? await tx.vehicle.findUniqueOrThrow({
            where: { id: v.id },
            include: { sale: true, bills: true },
          })
        : null;
      if (!old && ["SOLD", "DELIVERED"].includes(v.status))
        throw new Error(
          "Add the vehicle and sale agreement before marking sold.",
        );
      if (old) {
        const states = [
          "JAPAN_POOL",
          "COMMITTED",
          "AWAITING_SHIPMENT",
          "IN_TRANSIT",
          "UAE_INVENTORY",
          "SOLD",
          "DELIVERED",
        ];
        if (states.indexOf(v.status) < states.indexOf(old.status))
          throw new Error(
            "Backward status changes require a documented correction by a database administrator.",
          );
        if (["SOLD", "DELIVERED"].includes(v.status) && v.status !== old.status)
          throw new Error("Mark sold/delivered from the sale record.");
        if (v.status === "JAPAN_POOL" && (old.bills.length || old.sale))
          throw new Error(
            "A financially committed vehicle cannot return to Japan Pool.",
          );
      }
      const data = {
        code: v.code,
        make: v.make,
        model: v.model,
        year: v.year ? Number(v.year) : null,
        chassis: v.chassis || null,
        acquisition: v.acquisition,
        location: v.location,
        status: v.status,
        committedAt: v.committedAt ? new Date(v.committedAt) : null,
        supplierId: v.supplierId || null,
        shippingEstimate: fils(v.shippingEstimate),
        notes: v.notes,
      };
      const result = v.id
        ? await tx.vehicle.update({ where: { id: v.id }, data })
        : await tx.vehicle.create({ data });
      await audit(
        tx,
        actorId,
        old ? "vehicle.update" : "vehicle.create",
        result.id,
        { before: old, after: data },
      );
      return result;
    }
    if (module === "bills") {
      const v = billSchema.parse(input);
      if (v.issuedAt > todayDubai())
        throw new Error("A confirmed bill cannot be future-dated.");
      await supplier(tx, v.supplierId);
      const config = await tx.setting.findUnique({ where: { id: "business" } });
      const allowed =
        (config?.categories as string[] | undefined) || categories;
      if (!allowed.includes(v.category) && v.category !== "PURCHASE")
        throw new Error("Choose a saved expense category.");
      if (v.category === "PURCHASE" && !v.vehicleId)
        throw new Error(
          "A purchase bill must be linked to a committed vehicle.",
        );
      if (v.vehicleId) {
        const vehicle = await tx.vehicle.findUniqueOrThrow({
          where: { id: v.vehicleId },
        });
        if (vehicle.status === "JAPAN_POOL")
          throw new Error(
            "Commit this Japan Pool vehicle before recording obligations.",
          );
      }
      if (v.currency === "AED" && fils(v.amount) !== fils(v.originalAmount))
        throw new Error("AED original and confirmed amounts must match.");
      if (v.dueAt && v.dueAt < v.issuedAt)
        throw new Error("Due date cannot precede issue date.");
      const result = await tx.bill.create({
        data: {
          ...v,
          vehicleId: v.vehicleId || null,
          amount: fils(v.amount),
          issuedAt: new Date(v.issuedAt),
          dueAt: v.dueAt ? new Date(v.dueAt) : null,
        },
      });
      await audit(tx, actorId, "bill.post", result.id, result);
      return result;
    }
    if (module === "sales") {
      const v = saleSchema.parse(input);
      if (v.agreedAt > todayDubai())
        throw new Error("An agreement cannot be future-dated.");
      const vehicle = await tx.vehicle.findUniqueOrThrow({
        where: { id: v.vehicleId },
      });
      if (vehicle.archived || vehicle.status === "JAPAN_POOL")
        throw new Error("Choose a committed vehicle.");
      const customer = await tx.party.findUniqueOrThrow({
        where: { id: v.customerId },
      });
      if (customer.kind !== "CUSTOMER" || customer.archived)
        throw new Error("Choose an active customer.");
      const amounts = splitInstallments(
        fils(v.amount),
        v.weights.split(",").map(Number),
      );
      if (
        amounts.length !== v.dueDates.length ||
        v.dueDates.some((d) => d < v.agreedAt) ||
        v.dueDates.some((d, i) => i > 0 && d < v.dueDates[i - 1])
      )
        throw new Error(
          "Provide ordered installment dates on or after the agreement.",
        );
      const { weights, dueDates, ...rest } = v;
      const result = await tx.sale.create({
        data: {
          ...rest,
          amount: fils(v.amount),
          agreedAt: new Date(v.agreedAt),
          installments: amounts.map((a, i) => ({
            amount: a.toString(),
            dueAt: dueDates[i],
          })),
        },
      });
      await audit(tx, actorId, "sale.agree", result.id, result);
      return result;
    }
    if (module === "payments") {
      const v = paymentSchema.parse(input);
      const prior = await tx.payment.findUnique({
        where: { idempotencyKey: v.idempotencyKey },
      });
      if (prior) {
        if (
          prior.reference !== v.reference ||
          prior.amount !== fils(v.amount) ||
          prior.kind !== v.kind ||
          prior.billId !== (v.billId || null) ||
          prior.saleId !== (v.saleId || null) ||
          prior.date.toISOString().slice(0, 10) !== v.date ||
          prior.method !== v.method ||
          prior.account !== v.account ||
          prior.notes !== v.notes
        )
          throw new HttpError(
            409,
            "Idempotency key already used for another request.",
          );
        return prior;
      }
      if (v.kind === "SUPPLIER_PAYMENT" && (!v.billId || v.saleId))
        throw new Error("Supplier payments require exactly one bill.");
      if (v.kind.startsWith("CUSTOMER_") && (!v.saleId || v.billId))
        throw new Error("Customer payments require exactly one sale.");
      if (v.kind.startsWith("OWNER_") && (v.saleId || v.billId))
        throw new Error(
          "Owner movements cannot be allocated to sales or bills.",
        );
      const data = {
        ...v,
        amount: fils(v.amount),
        billId: v.billId || null,
        saleId: v.saleId || null,
        date: new Date(v.date),
      };
      await allocation(tx, data);
      const result = await tx.payment.create({ data });
      await audit(tx, actorId, "payment.record_pending", result.id, result);
      return result;
    }
    if (module === "adjustments") {
      const v = adjustmentSchema.parse(input);
      if (v.date > todayDubai())
        throw new Error("A posted credit cannot be future-dated.");
      if (Boolean(v.billId) === Boolean(v.saleId))
        throw new Error("Choose exactly one bill or sale.");
      if (v.billId) {
        const b = await tx.bill.findUniqueOrThrow({
          where: { id: v.billId },
          include: { payments: true, adjustments: true },
        });
        if (
          fils(v.amount) >
          b.amount -
            sum(b.adjustments.map((a) => a.amount)) -
            sum(
              b.payments
                .filter((p) => p.status === "VERIFIED")
                .map((p) => p.amount),
            )
        )
          throw new Error("Credit exceeds unpaid bill balance.");
      }
      if (v.saleId) {
        const s = await tx.sale.findUniqueOrThrow({
          where: { id: v.saleId },
          include: { adjustments: true },
        });
        if (fils(v.amount) > s.amount - sum(s.adjustments.map((a) => a.amount)))
          throw new Error("Credit exceeds adjusted sale amount.");
      }
      const result = await tx.adjustment.create({
        data: {
          ...v,
          billId: v.billId || null,
          saleId: v.saleId || null,
          amount: fils(v.amount),
          date: new Date(v.date),
        },
      });
      await audit(tx, actorId, "credit.post", result.id, result);
      return result;
    }
    if (module === "settings") {
      const v = settingsSchema.parse(input);
      v.plans.forEach((p) => splitInstallments(100n, p.weights));
      const data = { ...v, shippingEstimate: fils(v.shippingEstimate) };
      const result = await tx.setting.upsert({
        where: { id: "business" },
        create: { ...data },
        update: data,
      });
      await audit(tx, actorId, "settings.update", "business", data);
      return result;
    }
    if (module === "actions") {
      const v = actionSchema.parse(input);
      if (v.action === "verify") {
        const payment = await tx.payment.findUniqueOrThrow({
          where: { id: v.id },
        });
        if (payment.status !== "PENDING")
          throw new Error("Only pending payments can be verified.");
        if (payment.date.toISOString().slice(0, 10) > todayDubai())
          throw new Error("Future-dated payments cannot be verified.");
        await allocation(tx, payment);
        const result = await tx.payment.update({
          where: { id: v.id },
          data: { status: "VERIFIED", verifiedAt: new Date() },
        });
        await audit(tx, actorId, "payment.verify", v.id, {});
        return result;
      }
      if (v.action === "reverse") {
        const p = await tx.payment.findUniqueOrThrow({ where: { id: v.id } });
        if (p.status === "REVERSED") throw new Error("Already reversed.");
        if (p.saleId && p.status === "VERIFIED") {
          const s = await tx.sale.findUniqueOrThrow({
            where: { id: p.saleId },
            include: { payments: true },
          });
          const after = netReceipts(s.payments.filter((x) => x.id !== p.id));
          if (after < 0n) throw new Error("Reverse linked refunds first.");
        }
        const result = await tx.payment.update({
          where: { id: v.id },
          data: {
            status: "REVERSED",
            reversedAt: new Date(),
            reversalReason: v.reason,
          },
        });
        await audit(tx, actorId, "payment.reverse", v.id, { reason: v.reason });
        return result;
      }
      if (v.action === "reconcile") {
        const p = await tx.payment.findUniqueOrThrow({ where: { id: v.id } });
        if (p.status !== "VERIFIED")
          throw new Error("Verify the payment before reconciling it.");
        const result = await tx.payment.update({
          where: { id: v.id },
          data: { reconciliation: "MATCHED", reconciliationNote: v.note },
        });
        await audit(tx, actorId, "payment.reconcile", v.id, { note: v.note });
        return result;
      }
      if (v.action === "saleStatus") {
        if (v.date > todayDubai())
          throw new Error(
            "A completed sale or delivery cannot be future-dated.",
          );
        const s = await tx.sale.findUniqueOrThrow({ where: { id: v.id } });
        if (
          (v.status === "SOLD" && s.status !== "AGREED") ||
          (v.status === "DELIVERED" && s.status !== "SOLD")
        )
          throw new Error("Sales must move from agreed to sold to delivered.");
        if (new Date(v.date) < (s.soldAt || s.agreedAt))
          throw new Error(
            "Status date cannot precede the previous agreement/sale date.",
          );
        const result = await tx.sale.update({
          where: { id: v.id },
          data: {
            status: v.status,
            ...(v.status === "SOLD"
              ? { soldAt: new Date(v.date) }
              : { deliveredAt: new Date(v.date) }),
          },
        });
        await tx.vehicle.update({
          where: { id: s.vehicleId },
          data: { status: v.status },
        });
        await audit(tx, actorId, "sale." + v.status.toLowerCase(), v.id, {
          date: v.date,
        });
        return result;
      }
      if (v.action === "archive") {
        if (v.entity === "vehicle") {
          const vehicle = await tx.vehicle.findUniqueOrThrow({
            where: { id: v.id },
            include: { bills: true, sale: true },
          });
          if (vehicle.bills.length || vehicle.sale)
            throw new Error("Financially linked vehicles must be retained.");
          await tx.vehicle.update({
            where: { id: v.id },
            data: { archived: true },
          });
        } else {
          const p = await tx.party.findUniqueOrThrow({
            where: { id: v.id },
            include: { bills: true, sales: true, vehicles: true },
          });
          if (p.bills.length || p.sales.length || p.vehicles.length)
            throw new Error("Linked contacts must be retained.");
          await tx.party.update({
            where: { id: v.id },
            data: { archived: true },
          });
        }
        await audit(tx, actorId, "archive", v.id, { entity: v.entity });
        return { ok: true };
      }
    }
    throw new HttpError(404, "Unknown operation.");
  });
}
export async function snapshot() {
  return db.$transaction(
    async (tx) => {
      const [
        vehicles,
        parties,
        bills,
        sales,
        payments,
        adjustments,
        documents,
        settings,
        audits,
      ] = await Promise.all([
        tx.vehicle.findMany({
          where: { archived: false },
          orderBy: { createdAt: "desc" },
        }),
        tx.party.findMany({
          where: { archived: false },
          orderBy: { name: "asc" },
        }),
        tx.bill.findMany({ orderBy: { issuedAt: "desc" } }),
        tx.sale.findMany({ orderBy: { agreedAt: "desc" } }),
        tx.payment.findMany({ orderBy: { createdAt: "desc" } }),
        tx.adjustment.findMany({ orderBy: { createdAt: "desc" } }),
        tx.document.findMany({
          select: {
            id: true,
            name: true,
            mime: true,
            size: true,
            entityType: true,
            entityId: true,
            category: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        tx.setting.findUnique({ where: { id: "business" } }),
        tx.audit.findMany({ take: 100, orderBy: { createdAt: "desc" } }),
      ]);
      return {
        vehicles,
        parties,
        bills,
        sales,
        payments,
        adjustments,
        documents,
        settings: settings || {
          shippingEstimate: 1200000n,
          categories,
          plans: [
            { name: "60 / 40", weights: [60, 40] },
            { name: "50 / 30 / 20", weights: [50, 30, 20] },
          ],
          vatNote: "VAT registration and treatment not configured",
          demo: false,
        },
        audits,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
