export function fils(value: string): bigint {
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(value))
    throw new Error("Enter a positive amount with at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function decimal(value: bigint): string {
  const n = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${n / 100n}.${(n % 100n).toString().padStart(2, "0")}`;
}
export function aed(value: bigint | string): string {
  const n = BigInt(value);
  const s = decimal(n);
  const [w, f] = s.split(".");
  return `AED ${w.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${f}`;
}
export function splitInstallments(amount: bigint, weights: number[]): bigint[] {
  if (
    !weights.length ||
    weights.some((w) => !Number.isInteger(w) || w <= 0) ||
    weights.reduce((a, b) => a + b, 0) !== 100
  )
    throw new Error("Installment percentages must total 100.");
  let allocated = 0n;
  return weights.map((w, i) => {
    const part =
      i === weights.length - 1
        ? amount - allocated
        : (amount * BigInt(w)) / 100n;
    allocated += part;
    return part;
  });
}
type P = { kind: string; status: string; amount: bigint };
export const sum = (values: bigint[]) => values.reduce((a, b) => a + b, 0n);
export function netReceipts(payments: P[]) {
  return sum(
    payments
      .filter((p) => p.status === "VERIFIED")
      .map((p) => (p.kind === "CUSTOMER_REFUND" ? -p.amount : p.amount)),
  );
}
export function billBalance(amount: bigint, credits: bigint[], payments: P[]) {
  return (
    amount -
    sum(credits) -
    sum(payments.filter((p) => p.status === "VERIFIED").map((p) => p.amount))
  );
}
export function receivable(amount: bigint, credits: bigint[], payments: P[]) {
  return amount - sum(credits) - netReceipts(payments);
}
export function assertAllocation(
  kind: string,
  amount: bigint,
  net: bigint,
  agreement: bigint,
) {
  if (amount <= 0n) throw new Error("Amount must be positive.");
  if (kind === "CUSTOMER_REFUND") {
    if (amount > net) throw new Error("Refund exceeds verified net receipts.");
  } else if (net + amount > agreement)
    throw new Error("Payment exceeds the outstanding balance.");
}
export function vehicleMargin(revenue: bigint, costs: bigint[]) {
  return revenue - sum(costs);
}
export const jsonSafe = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
export const dubaiDate = (date: Date | string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
export const todayDubai = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
