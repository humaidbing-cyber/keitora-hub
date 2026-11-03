import { snapshot } from "./service";
import { sum, netReceipts, billBalance, receivable, todayDubai } from "./money";
type Data = Awaited<ReturnType<typeof snapshot>>;
export function reports(d: Data) {
  const today = todayDubai();
  const dateKey = (d: Date) => d.toISOString().slice(0, 10);
  const ps = (id: string, key: "billId" | "saleId") =>
    d.payments.filter((p) => p[key] === id);
  const cs = (id: string, key: "billId" | "saleId") =>
    d.adjustments.filter((p) => p[key] === id).map((a) => a.amount);
  const name = (id: string) => d.parties.find((p) => p.id === id)?.name || "—";
  const vehicle = (id: string | null) =>
    d.vehicles.find((v) => v.id === id)?.code || "Business";
  const bills = d.bills.map((b) => ({
    ...b,
    supplierName: name(b.supplierId),
    vehicleCode: vehicle(b.vehicleId),
    net: b.amount - sum(cs(b.id, "billId")),
    balance: billBalance(b.amount, cs(b.id, "billId"), ps(b.id, "billId")),
  }));
  const sales = d.sales.map((s) => {
    const revenue = s.amount - sum(cs(s.id, "saleId"));
    const cost = sum(
      bills.filter((b) => b.vehicleId === s.vehicleId).map((b) => b.net),
    );
    return {
      ...s,
      customerName: name(s.customerId),
      vehicleCode: vehicle(s.vehicleId),
      net: revenue,
      cost,
      margin: revenue - cost,
      received: netReceipts(ps(s.id, "saleId")),
      balance: receivable(s.amount, cs(s.id, "saleId"), ps(s.id, "saleId")),
    };
  });
  const earned = sales.filter((s) => s.status !== "AGREED");
  const revenue = sum(earned.map((s) => s.net));
  const costOfSales = sum(earned.map((s) => s.cost));
  const operating = sum(bills.filter((b) => !b.vehicleId).map((b) => b.net));
  const verified = d.payments.filter((p) => p.status === "VERIFIED");
  const incoming = (kind: string) =>
    ["CUSTOMER_RECEIPT", "OWNER_CONTRIBUTION"].includes(kind);
  const cashIn = sum(
    verified.filter((p) => incoming(p.kind)).map((p) => p.amount),
  );
  const cashOut = sum(
    verified.filter((p) => !incoming(p.kind)).map((p) => p.amount),
  );
  const suppliers = d.parties
    .filter((p) => p.kind === "SUPPLIER")
    .map((p) => {
      const bs = bills.filter((b) => b.supplierId === p.id);
      const overdue = bs.filter(
        (b) => b.dueAt && dateKey(b.dueAt) < today && b.balance > 0n,
      );
      const aging = [0n, 0n, 0n, 0n];
      for (const b of bs) {
        const days = b.dueAt
          ? Math.floor(
              (Date.parse(today) - Date.parse(dateKey(b.dueAt))) / 86400000,
            )
          : 0;
        aging[days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3] += b.balance;
      }
      return {
        ...p,
        billed: sum(bs.map((b) => b.net)),
        balance: sum(bs.map((b) => b.balance)),
        overdue: sum(overdue.map((b) => b.balance)),
        aging,
      };
    });
  const customers = d.parties
    .filter((p) => p.kind === "CUSTOMER")
    .map((p) => {
      const ss = sales.filter((s) => s.customerId === p.id);
      return {
        ...p,
        agreed: sum(ss.map((s) => s.net)),
        received: sum(ss.map((s) => s.received)),
        balance: sum(ss.map((s) => s.balance)),
      };
    });
  const vehicles = d.vehicles.map((v) => {
    const s = sales.find((s) => s.vehicleId === v.id);
    const costs = sum(
      bills.filter((b) => b.vehicleId === v.id).map((b) => b.net),
    );
    return {
      ...v,
      cost: costs,
      supplierName: name(v.supplierId || ""),
      saleId: s?.id || null,
      saleType: s?.type || null,
      customerName: s?.customerName || null,
      agreedAmount: s?.net ?? null,
      margin: s ? s.net - costs : null,
      marginType:
        s?.status === "AGREED"
          ? "Estimated on confirmed costs"
          : "Realized on confirmed costs",
    };
  });
  const monthly: Record<
    string,
    {
      month: string;
      revenue: bigint;
      directCosts: bigint;
      expenses: bigint;
      cashIn: bigint;
      cashOut: bigint;
    }
  > = {};
  const month = (date: Date) => {
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dubai",
      year: "numeric",
      month: "2-digit",
    }).format(date);
    return (
      monthly[key] ??
      (monthly[key] = {
        month: key,
        revenue: 0n,
        directCosts: 0n,
        expenses: 0n,
        cashIn: 0n,
        cashOut: 0n,
      })
    );
  };
  for (const s of earned) {
    month(s.soldAt!).revenue += s.amount;
    for (const a of d.adjustments.filter((a) => a.saleId === s.id))
      month(a.date > s.soldAt! ? a.date : s.soldAt!).revenue -= a.amount;
  }
  for (const b of bills) {
    const s = earned.find((s) => s.vehicleId === b.vehicleId);
    if (!b.vehicleId || s) {
      const date = s && s.soldAt! > b.issuedAt ? s.soldAt! : b.issuedAt;
      const key = b.vehicleId ? "directCosts" : "expenses";
      month(date)[key] += b.amount;
      for (const a of d.adjustments.filter((a) => a.billId === b.id))
        month(a.date > date ? a.date : date)[key] -= a.amount;
    }
  }
  for (const p of verified)
    month(p.date)[incoming(p.kind) ? "cashIn" : "cashOut"] += p.amount;
  return {
    bills,
    sales,
    vehicles,
    suppliers,
    customers,
    monthly: Object.values(monthly).sort((a, b) =>
      a.month.localeCompare(b.month),
    ),
    comparison: ["AS_IS", "CUSTOMIZED"].map((type) => {
      const ss = earned.filter((s) => s.type === type);
      return {
        type,
        count: ss.length,
        revenue: sum(ss.map((s) => s.net)),
        cost: sum(ss.map((s) => s.cost)),
        margin: sum(ss.map((s) => s.margin)),
      };
    }),
    summary: {
      revenue,
      costOfSales,
      grossProfit: revenue - costOfSales,
      operatingExpenses: operating,
      netProfit: revenue - costOfSales - operating,
      allConfirmedCosts: sum(bills.map((b) => b.net)),
      receivables: sum(
        sales.filter((s) => s.balance > 0n).map((s) => s.balance),
      ),
      refundsDue: -sum(
        sales.filter((s) => s.balance < 0n).map((s) => s.balance),
      ),
      payables: sum(bills.map((b) => b.balance)),
      cashIn,
      cashOut,
      cashMovement: cashIn - cashOut,
      personalMovement: sum(
        verified
          .filter((p) => p.account === "PERSONAL")
          .map((p) => (incoming(p.kind) ? p.amount : -p.amount)),
      ),
      unearnedDeposits: sum(
        sales.filter((s) => s.status === "AGREED").map((s) => s.received),
      ),
      pending: sum(
        d.payments.filter((p) => p.status === "PENDING").map((p) => p.amount),
      ),
      owned: vehicles.filter(
        (v) => !["JAPAN_POOL", "SOLD", "DELIVERED"].includes(v.status),
      ).length,
      pool: vehicles.filter((v) => v.status === "JAPAN_POOL").length,
      soldAwaitingDelivery: sales.filter((s) => s.status === "SOLD").length,
      delivered: sales.filter((s) => s.status === "DELIVERED").length,
    },
  };
}
