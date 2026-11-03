import "dotenv/config";
import { db } from "../src/lib/db";
import { mutate } from "../src/lib/service";
import { categories } from "../src/lib/validation";
import { randomUUID } from "node:crypto";
export async function seedDemo() {
  if (process.env.DEMO_MODE !== "true")
    throw new Error(
      "Opt in with DEMO_MODE=true. Use a separate empty demo database.",
    );
  if (
    (await db.vehicle.count()) ||
    (await db.party.count()) ||
    (await db.bill.count()) ||
    (await db.sale.count()) ||
    (await db.payment.count()) ||
    (await db.adjustment.count()) ||
    (await db.document.count())
  )
    throw new Error("Demo seed refused: business tables must be empty.");
  const actorId = "demo-seeder";
  await db.setting.upsert({
    where: { id: "business" },
    create: {
      demo: true,
      categories,
      plans: [
        { name: "60 / 40", weights: [60, 40] },
        { name: "50 / 30 / 20", weights: [50, 30, 20] },
      ],
    },
    update: { demo: true },
  });
  const supplier = (await mutate(
    "parties",
    {
      kind: "SUPPLIER",
      name: "DEMO · Sakura Vehicle Supply",
      group: "JAPAN",
      notes: "Fictional demonstration supplier.",
    },
    actorId,
  )) as { id: string };
  const local = (await mutate(
    "parties",
    {
      kind: "SUPPLIER",
      name: "DEMO · Import & Local Services",
      group: "IMPORT_PARTNER",
    },
    actorId,
  )) as { id: string };
  const customer = (await mutate(
    "parties",
    {
      kind: "CUSTOMER",
      name: "DEMO · Example Customer",
      group: "LOCAL",
      notes: "Fictional example. Not a real customer.",
    },
    actorId,
  )) as { id: string };
  const createVehicle = (
    code: string,
    model: string,
    status: string,
    location: string,
  ) =>
    mutate(
      "vehicles",
      {
        code,
        make: "Honda",
        model,
        year: "1997",
        acquisition: "INVENTORY",
        status,
        location,
        committedAt: status === "JAPAN_POOL" ? "" : "2026-09-01",
        supplierId: supplier.id,
        shippingEstimate: "12000",
        notes: "Fictional demo vehicle. No real chassis or identity.",
      },
      actorId,
    ) as Promise<{ id: string }>;
  const a = await createVehicle(
    "DEMO-001",
    "Acty Truck",
    "UAE_INVENTORY",
    "UAE",
  );
  const b = await createVehicle("DEMO-002", "Acty Van", "UAE_INVENTORY", "UAE");
  const c = await createVehicle(
    "DEMO-003",
    "Acty Truck",
    "IN_TRANSIT",
    "IN_TRANSIT",
  );
  await createVehicle("DEMO-POOL-01", "Acty Van", "JAPAN_POOL", "JAPAN");
  const bill = (
    reference: string,
    vehicleId: string,
    amount: string,
    supplierId = supplier.id,
    category = "PURCHASE",
  ) =>
    mutate(
      "bills",
      {
        reference,
        supplierId,
        vehicleId,
        amount,
        originalAmount: amount,
        currency: "AED",
        category,
        description: "Fictional demo cost",
        issuedAt: "2026-09-04",
        dueAt: "2026-10-15",
      },
      actorId,
    ) as Promise<{ id: string }>;
  const purchase = await bill("DEMO-BILL-001", a.id, "18000");
  await bill("DEMO-BILL-002", a.id, "11500", local.id, "SHIPPING_IMPORT");
  await bill("DEMO-BILL-003", a.id, "2500", local.id, "PAINT");
  await bill("DEMO-BILL-004", b.id, "17000");
  await bill("DEMO-BILL-005", c.id, "15500");
  await bill("DEMO-AD-001", "", "200", local.id, "ADVERTISING");
  const sale = (await mutate(
    "sales",
    {
      reference: "DEMO-SALE-001",
      vehicleId: a.id,
      customerId: customer.id,
      type: "CUSTOMIZED",
      amount: "48000",
      agreedAt: "2026-10-01",
      weights: "60,40",
      dueDates: ["2026-10-01", "2026-11-15"],
      notes: "Fictional demo sale.",
    },
    actorId,
  )) as { id: string };
  await mutate(
    "actions",
    { action: "saleStatus", id: sale.id, status: "SOLD", date: "2026-10-20" },
    actorId,
  );
  const depositSale = (await mutate(
    "sales",
    {
      reference: "DEMO-SALE-002",
      vehicleId: b.id,
      customerId: customer.id,
      type: "AS_IS",
      amount: "39000",
      agreedAt: "2026-10-15",
      weights: "50,30,20",
      dueDates: ["2026-10-15", "2026-11-15", "2026-12-15"],
    },
    actorId,
  )) as { id: string };
  const payment = async (
    reference: string,
    kind: string,
    amount: string,
    saleId = "",
    billId = "",
    verify = true,
    account = "BUSINESS",
  ) => {
    const p = (await mutate(
      "payments",
      {
        idempotencyKey: randomUUID(),
        reference,
        kind,
        amount,
        saleId,
        billId,
        date: "2026-10-20",
        method: "BANK_TRANSFER",
        account,
      },
      actorId,
    )) as { id: string };
    if (verify)
      await mutate("actions", { action: "verify", id: p.id }, actorId);
    return p;
  };
  await payment("DEMO-TRANSFER-001", "CUSTOMER_RECEIPT", "28800", sale.id);
  await payment(
    "DEMO-TRANSFER-002",
    "CUSTOMER_RECEIPT",
    "19500",
    depositSale.id,
  );
  await payment(
    "DEMO-TRANSFER-003",
    "SUPPLIER_PAYMENT",
    "10000",
    "",
    purchase.id,
    true,
    "PERSONAL",
  );
  await payment(
    "DEMO-TRANSFER-004",
    "CUSTOMER_RECEIPT",
    "19200",
    sale.id,
    "",
    false,
  );
  await payment("DEMO-CAPITAL-001", "OWNER_CONTRIBUTION", "40000");
  console.log(
    "Fictional demo seeded. Use admin:create to set your own login. Real vehicle data was not created.",
  );
}
if (process.argv[1]?.endsWith("seed.ts"))
  seedDemo()
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
