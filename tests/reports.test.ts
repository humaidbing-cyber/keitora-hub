import { describe, it, expect, vi, afterEach } from "vitest";
import { reports } from "../src/lib/reports";
function fixture() {
  return {
    parties: [
      { id: "supplier", kind: "SUPPLIER", name: "Fictional test supplier" },
    ],
    vehicles: [],
    bills: [
      {
        id: "bill",
        reference: "TEST",
        supplierId: "supplier",
        vehicleId: null,
        amount: 10000n,
        issuedAt: new Date("2026-10-01"),
        dueAt: new Date("2026-11-01"),
      },
    ],
    sales: [],
    payments: [],
    adjustments: [],
  } as unknown as Parameters<typeof reports>[0];
}
afterEach(() => vi.useRealTimers());
describe("Dubai payable aging", () => {
  it("keeps a bill current throughout its Dubai due date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T19:59:00Z"));
    const r = reports(fixture());
    expect(r.suppliers[0].overdue).toBe(0n);
    expect(r.suppliers[0].aging).toEqual([10000n, 0n, 0n, 0n]);
  });
  it("moves the balance to 1–30 days overdue at the next Dubai date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T20:01:00Z"));
    const r = reports(fixture());
    expect(r.suppliers[0].overdue).toBe(10000n);
    expect(r.suppliers[0].aging).toEqual([0n, 10000n, 0n, 0n]);
  });
});
