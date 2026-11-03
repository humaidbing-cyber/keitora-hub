import "dotenv/config";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
async function main() {
  const schema = "integration_" + randomUUID().replaceAll("-", "");
  const url = new URL(process.env.DATABASE_URL || "");
  url.searchParams.set("schema", schema);
  process.env.DATABASE_URL = url.toString();
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env: process.env, stdio: "pipe" },
  );
  const { db } = await import("../src/lib/db");
  const { mutate, snapshot } = await import("../src/lib/service");
  const { reports } = await import("../src/lib/reports");
  const { seedDemo } = await import("./seed");
  let checks = 0;
  const check = (condition: unknown) => {
    assert.ok(condition);
    checks++;
  };
  try {
    process.env.DEMO_MODE = "true";
    await seedDemo();
    let d = await snapshot();
    let r = reports(d);
    check(r.summary.revenue === 4800000n);
    check(r.summary.grossProfit === 1600000n);
    check(r.summary.netProfit === 1580000n);
    check(r.summary.unearnedDeposits === 1950000n);
    check(r.summary.payables === 5470000n);
    check(r.summary.cashMovement === 7830000n);
    check(r.summary.owned === 2);
    check(r.summary.pool === 1);
    check(r.summary.soldAwaitingDelivery === 1);
    const supplier = d.parties.find((p) => p.group === "JAPAN")!;
    const bill = d.bills.find((b) => b.reference === "DEMO-BILL-001")!;
    check(r.bills.find((b) => b.id === bill.id)?.balance === 800000n);
    const payment = d.payments.find(
      (p) => p.reference === "DEMO-TRANSFER-001",
    )!;
    const payload = {
      idempotencyKey: payment.idempotencyKey,
      reference: payment.reference,
      kind: payment.kind,
      amount: "28800",
      saleId: payment.saleId,
      billId: "",
      date: "2026-10-20",
      method: "BANK_TRANSFER",
      account: "BUSINESS",
      notes: "",
    };
    const same = (await mutate("payments", payload, "test")) as { id: string };
    check(same.id === payment.id);
    await assert.rejects(
      mutate("payments", { ...payload, amount: "1" }, "test"),
    );
    checks++;
    await assert.rejects(
      mutate("payments", { ...payload, idempotencyKey: randomUUID() }, "test"),
    );
    checks++;
    await assert.rejects(
      mutate(
        "bills",
        {
          reference: "POOL-BILL",
          supplierId: supplier.id,
          vehicleId: d.vehicles.find((v) => v.status === "JAPAN_POOL")!.id,
          category: "PURCHASE",
          description: "Must fail",
          amount: "10",
          originalAmount: "10",
          currency: "AED",
          issuedAt: "2026-10-01",
        },
        "test",
      ),
    );
    checks++;
    const refund = (await mutate(
      "payments",
      {
        idempotencyKey: randomUUID(),
        reference: "TEST-REFUND",
        kind: "CUSTOMER_REFUND",
        amount: "1000",
        saleId: payment.saleId,
        date: "2026-10-21",
        method: "BANK_TRANSFER",
        account: "BUSINESS",
      },
      "test",
    )) as { id: string };
    await mutate("actions", { action: "verify", id: refund.id }, "test");
    d = await snapshot();
    r = reports(d);
    check(r.sales.find((s) => s.id === payment.saleId)?.received === 2780000n);
    check(r.summary.revenue === 4800000n);
    await assert.rejects(
      mutate(
        "actions",
        {
          action: "reverse",
          id: payment.id,
          reason: "Test reversal with outstanding refund",
        },
        "test",
      ),
    );
    checks++;
    await mutate(
      "actions",
      { action: "reverse", id: refund.id, reason: "Test refund reversal" },
      "test",
    );
    await mutate(
      "adjustments",
      {
        reference: "TEST-CREDIT",
        saleId: payment.saleId,
        amount: "1000",
        reason: "Demonstration price reduction",
        date: "2026-10-22",
      },
      "test",
    );
    r = reports(await snapshot());
    check(r.summary.revenue === 4700000n);
    check(r.summary.grossProfit === 1500000n);
    const pending = d.payments.find(
      (p) => p.reference === "DEMO-TRANSFER-004",
    )!;
    await assert.rejects(
      mutate("actions", { action: "verify", id: pending.id }, "test"),
    );
    checks++; // credit now makes the final installment excessive
    const base = {
      kind: "SUPPLIER_PAYMENT",
      billId: bill.id,
      amount: "5000",
      date: "2026-10-22",
      method: "BANK_TRANSFER",
      account: "BUSINESS",
    };
    const p1 = (await mutate(
      "payments",
      { ...base, reference: "RACE-1", idempotencyKey: randomUUID() },
      "test",
    )) as { id: string };
    const p2 = (await mutate(
      "payments",
      { ...base, reference: "RACE-2", idempotencyKey: randomUUID() },
      "test",
    )) as { id: string };
    const results = await Promise.allSettled([
      mutate("actions", { action: "verify", id: p1.id }, "test"),
      mutate("actions", { action: "verify", id: p2.id }, "test"),
    ]);
    check(results.filter((r) => r.status === "fulfilled").length === 1);
    r = reports(await snapshot());
    check(r.bills.find((b) => b.id === bill.id)?.balance === 300000n);
    await assert.rejects(
      db.bill.update({ where: { id: bill.id }, data: { amount: 1n } }),
    );
    checks++;
    await assert.rejects(db.audit.deleteMany());
    checks++;
    check(
      (await db.payment.findUnique({ where: { id: refund.id } }))?.status ===
        "REVERSED",
    );
    const person = d.payments.find((p) => p.account === "PERSONAL")!;
    await mutate(
      "actions",
      {
        action: "reconcile",
        id: person.id,
        note: "Business statement line DEMO-003",
      },
      "test",
    );
    check(
      (await db.payment.findUnique({ where: { id: person.id } }))
        ?.reconciliation === "MATCHED",
    );
    const total = (key: "revenue" | "directCosts" | "expenses") =>
      r.monthly.reduce((a, m) => a + m[key], 0n);
    check(total("revenue") === r.summary.revenue);
    check(total("directCosts") === r.summary.costOfSales);
    check(total("expenses") === r.summary.operatingExpenses);
    const future = (await mutate(
      "payments",
      {
        idempotencyKey: randomUUID(),
        reference: "FUTURE",
        kind: "OWNER_CONTRIBUTION",
        amount: "10",
        date: "2099-01-01",
        method: "BANK_TRANSFER",
        account: "BUSINESS",
      },
      "test",
    )) as { id: string };
    await assert.rejects(
      mutate("actions", { action: "verify", id: future.id }, "test"),
    );
    checks++;
    await mutate(
      "adjustments",
      {
        reference: "SUPPLIER-CREDIT",
        billId: bill.id,
        amount: "1000",
        reason: "Confirmed supplier cost credit",
        date: "2026-10-23",
      },
      "test",
    );
    r = reports(await snapshot());
    check(r.bills.find((b) => b.id === bill.id)?.balance === 200000n);
    check(r.summary.grossProfit === 1600000n);
    const profitBeforeOwner = r.summary.netProfit;
    const capital = d.payments.find((p) => p.kind === "OWNER_CONTRIBUTION")!;
    await mutate(
      "actions",
      {
        action: "reverse",
        id: capital.id,
        reason: "Owner contribution reversed for test",
      },
      "test",
    );
    r = reports(await snapshot());
    check(r.summary.netProfit === profitBeforeOwner);
    check(r.summary.cashMovement < 7830000n);
    console.log(
      `PASS: ${checks} PostgreSQL integration assertions (partial payments, unpaid purchases, deposits, refunds, duplicates, concurrency, immutability, reconciliation and profit).`,
    );
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
