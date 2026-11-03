import { describe, it, expect } from "vitest";
import { importSchema } from "../src/lib/onboarding";
const vehicle = {
  code: "TEST-ACTUAL-SUPPLIED-ID",
  make: "Honda",
  model: "Acty",
  year: "1997",
  chassis: "",
  acquisition: "INVENTORY",
  location: "UAE",
  status: "UAE_INVENTORY",
  committedAt: "2026-09-01",
  shippingEstimate: "12000",
  notes: "",
};
describe("safe vehicle onboarding", () => {
  it("accepts an identity without inventing unknown chassis or costs", () => {
    const v = importSchema.parse({ vehicles: [vehicle] });
    expect(v.vehicles[0].chassis).toBe("");
    expect(v.vehicles[0].shippingEstimate).toBe("12000");
  });
  it("rejects duplicate identities within the batch", () =>
    expect(() =>
      importSchema.parse({ vehicles: [vehicle, vehicle] }),
    ).toThrow());
  it("rejects sold/delivered imports without real agreements", () =>
    expect(() =>
      importSchema.parse({ vehicles: [{ ...vehicle, status: "SOLD" }] }),
    ).toThrow());
  it("requires actual commitment dates on owned vehicles", () =>
    expect(() =>
      importSchema.parse({ vehicles: [{ ...vehicle, committedAt: "" }] }),
    ).toThrow());
  it("allows uncommitted Japan pool candidates", () =>
    expect(
      importSchema.parse({
        vehicles: [
          {
            ...vehicle,
            status: "JAPAN_POOL",
            location: "JAPAN",
            committedAt: "",
          },
        ],
      }).vehicles,
    ).toHaveLength(1));
  it("rejects impossible dates", () =>
    expect(() =>
      importSchema.parse({
        vehicles: [{ ...vehicle, committedAt: "2026-02-31" }],
      }),
    ).toThrow());
  it("rejects template placeholders", () =>
    expect(() =>
      importSchema.parse({
        vehicles: [{ ...vehicle, code: "REPLACE-WITH-ACTUAL-ID" }],
      }),
    ).toThrow());
});
