import "dotenv/config";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
async function main() {
  if (
    (await db.setting.findUnique({ where: { id: "business" } }))?.demo !== true
  )
    throw new Error(
      "Access checks require a disposable fictional demo database.",
    );
  const base = process.env.APP_ORIGIN || "http://127.0.0.1:3000";
  const staff = await db.user.create({
    data: {
      email: `test-${randomUUID()}@example.invalid`,
      passwordHash: "not-a-usable-password-hash",
      role: "STAFF",
    },
  });
  try {
    const token = randomUUID();
    await db.session.create({
      data: {
        id: createHash("sha256").update(token).digest("hex"),
        userId: staff.id,
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    const cookie = "keitora_session=" + token;
    assert.equal(
      (await fetch(base + "/api/data", { headers: { cookie } })).status,
      403,
    );
    assert.equal(
      (await fetch(base + "/api/export?type=vehicles", { headers: { cookie } }))
        .status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/api/records/parties", {
          method: "POST",
          headers: { origin: base, cookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "CUSTOMER",
            name: "Should never be written",
          }),
        })
      ).status,
      403,
    );
    await db.session.update({
      where: { id: createHash("sha256").update(token).digest("hex") },
      data: { expiresAt: new Date(0) },
    });
    assert.equal(
      (await fetch(base + "/api/data", { headers: { cookie } })).status,
      401,
    );
    console.log(
      "PASS: 4 HTTP authorization assertions: staff reads/exports/writes denied and expired session denied.",
    );
  } finally {
    await db.user.delete({ where: { id: staff.id } });
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
