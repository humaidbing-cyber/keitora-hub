import { describe, it, expect } from "vitest";
import {
  fils,
  decimal,
  splitInstallments,
  billBalance,
  receivable,
  netReceipts,
  assertAllocation,
  vehicleMargin,
  aed,
} from "../src/lib/money";
const payment = (
  amount: bigint,
  status = "VERIFIED",
  kind = "CUSTOMER_RECEIPT",
) => ({ amount, status, kind });
describe("exact financial arithmetic", () => {
  it("parses decimal amounts exactly and rejects malformed input", () => {
    expect(fils("0.29")).toBe(29n);
    expect(fils("12000")).toBe(1200000n);
    for (const v of ["1.234", "-1", "1e3", "NaN", "Infinity", "0,20"])
      expect(() => fils(v)).toThrow();
  });
  it("formats negative and large values without Number conversion", () => {
    expect(decimal(-1n)).toBe("-0.01");
    expect(aed(99999999999999n)).toBe("AED 999,999,999,999.99");
  });
  it("preserves every fils for 60/40 and 50/30/20", () => {
    expect(splitInstallments(101n, [60, 40])).toEqual([60n, 41n]);
    expect(splitInstallments(101n, [50, 30, 20])).toEqual([50n, 30n, 21n]);
    expect(() => splitInstallments(100n, [50, 40])).toThrow();
  });
  it("keeps unpaid purchases and partial supplier payments payable", () => {
    expect(billBalance(1800000n, [], [])).toBe(1800000n);
    expect(billBalance(1800000n, [], [payment(1000000n)])).toBe(800000n);
  });
  it("ignores unverified and reversed payments", () => {
    expect(
      receivable(
        10000n,
        [],
        [payment(5000n, "PENDING"), payment(2000n, "REVERSED")],
      ),
    ).toBe(10000n);
  });
  it("treats refunds as decreases to verified receipts", () => {
    const ps = [payment(6000n), payment(1000n, "VERIFIED", "CUSTOMER_REFUND")];
    expect(netReceipts(ps)).toBe(5000n);
    expect(receivable(10000n, [2000n], ps)).toBe(3000n);
  });
  it("supports customer credits creating refund obligations", () =>
    expect(receivable(10000n, [5000n], [payment(6000n)])).toBe(-1000n));
  it("rejects excessive payments and refunds", () => {
    expect(() =>
      assertAllocation("CUSTOMER_RECEIPT", 6000n, 5000n, 10000n),
    ).toThrow();
    expect(() =>
      assertAllocation("CUSTOMER_REFUND", 6000n, 5000n, 10000n),
    ).toThrow();
    expect(() =>
      assertAllocation("SUPPLIER_PAYMENT", 0n, 0n, 10000n),
    ).toThrow();
  });
  it("calculates margin from all confirmed costs regardless of payments", () =>
    expect(vehicleMargin(4800000n, [1800000n, 1150000n, 250000n])).toBe(
      1600000n,
    ));
});
