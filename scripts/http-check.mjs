// Integration harness: run only against a disposable demo instance.
import "dotenv/config";
import assert from "node:assert/strict";
const base = process.env.APP_ORIGIN || "http://127.0.0.1:3000";
if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD)
  throw new Error(
    "Set TEST_EMAIL and TEST_PASSWORD for a separate fictional demo instance.",
  );
let count = 0;
const check = (v) => {
  assert.ok(v);
  count++;
};
const post = (path, body, cookie = "", origin = base) =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin, cookie },
    body: JSON.stringify(body),
  });
for (const path of [
  "/api/data",
  "/api/export?type=vehicles",
  "/api/documents/not-a-file",
])
  check((await fetch(base + path)).status === 401);
check(
  (
    await post(
      "/api/auth",
      { email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD },
      "",
      "https://wrong-origin.invalid",
    )
  ).status === 403,
);
const login = await post("/api/auth", {
  email: process.env.TEST_EMAIL,
  password: process.env.TEST_PASSWORD,
});
check(login.status === 200);
const cookie = login.headers.get("set-cookie").split(";")[0];
check(login.headers.get("set-cookie").includes("HttpOnly"));
check(
  login.headers.get("set-cookie").includes("Secure") ===
    (process.env.COOKIE_SECURE === "true"),
);
check(login.headers.get("set-cookie").includes("SameSite=strict"));
const data = await (
  await fetch(base + "/api/data", { headers: { cookie } })
).json();
check(data.settings.demo);
check(data.report.summary.revenue === "4800000");
check((await post("/api/records/vehicles", {}, cookie)).status === 400);
const id = "HTTP-" + Date.now();
const vehicle = {
  code: id,
  make: "DEMO",
  model: "HTTP persistence test",
  year: "",
  acquisition: "INVENTORY",
  location: "JAPAN",
  status: "JAPAN_POOL",
  committedAt: "",
  shippingEstimate: "12000",
  notes: "Fictional automated HTTP test.",
};
let response = await post("/api/records/vehicles", vehicle, cookie);
check(response.status === 200);
const row = await response.json();
check(
  (
    await (await fetch(base + "/api/data", { headers: { cookie } })).json()
  ).vehicles.some((v) => v.id === row.id),
);
check((await post("/api/records/vehicles", vehicle, cookie)).status === 409);
const invalid = new FormData();
invalid.set("entityType", "vehicle");
invalid.set("entityId", row.id);
invalid.set("category", "OTHER");
invalid.set(
  "file",
  new File(["<script>alert(1)</script>"], "unsafe.html", { type: "image/png" }),
);
check(
  (
    await fetch(base + "/api/documents", {
      method: "POST",
      headers: { origin: base, cookie },
      body: invalid,
    })
  ).status === 400,
);
const valid = new FormData();
valid.set("entityType", "vehicle");
valid.set("entityId", row.id);
valid.set("category", "OTHER");
valid.set(
  "file",
  new File(["%PDF-1.4\n% Fictional HTTP test document\n%%EOF"], "qa-test.pdf", {
    type: "application/pdf",
  }),
);
response = await fetch(base + "/api/documents", {
  method: "POST",
  headers: { origin: base, cookie },
  body: valid,
});
check(response.status === 200);
const document = await response.json();
check((await fetch(base + "/api/documents/" + document.id)).status === 401);
response = await fetch(base + "/api/documents/" + document.id, {
  headers: { cookie },
});
check(response.status === 200);
check(response.headers.get("content-type") === "application/pdf");
check(response.headers.get("content-disposition").startsWith("attachment;"));
check((await response.text()).startsWith("%PDF-1.4"));
response = await fetch(base + "/api/export?type=cash", { headers: { cookie } });
check(response.status === 200);
const csv = await response.text();
check(csv.includes("DEMO-TRANSFER-001"));
check(!csv.includes("DEMO-TRANSFER-004"));
check(
  (
    await post(
      "/api/import",
      { data: { vehicles: [vehicle] }, confirm: false },
      cookie,
    )
  ).status === 400,
);
const fresh = { ...vehicle, code: id + "-IMPORT" };
response = await post(
  "/api/import",
  { data: { vehicles: [fresh] }, confirm: false },
  cookie,
);
check(response.status === 200);
check(
  !(
    await (await fetch(base + "/api/data", { headers: { cookie } })).json()
  ).vehicles.some((v) => v.code === fresh.code),
);
response = await post(
  "/api/import",
  { data: { vehicles: [fresh] }, confirm: true },
  cookie,
);
check(response.status === 200);
check(
  (
    await (await fetch(base + "/api/data", { headers: { cookie } })).json()
  ).vehicles.some((v) => v.code === fresh.code),
);
check(
  (
    await fetch(base + "/api/auth", {
      method: "DELETE",
      headers: { origin: base, cookie },
    })
  ).status === 200,
);
check(
  (await fetch(base + "/api/data", { headers: { cookie } })).status === 401,
);
console.log(
  "PASS: " +
    count +
    " HTTP assertions: authentication, cookies, origin enforcement, persistence, validation, duplicates, private files, unsafe upload rejection, verified-only cash export, import preview/confirm, and session revocation.",
);
