"use client";
import {
  useEffect,
  useState,
  useRef,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  LayoutDashboard,
  Truck,
  Globe2,
  Users,
  Building2,
  Receipt,
  Wallet,
  FolderOpen,
  BarChart3,
  Settings,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  ChevronRight,
  X,
  Menu,
  LogOut,
  ShieldCheck,
  Check,
  Clock3,
  Download,
  FileText,
  CircleHelp,
  SlidersHorizontal,
  RefreshCw,
  CircleAlert,
  CreditCard,
  Package,
  Banknote,
  MoreHorizontal,
} from "lucide-react";
import { aed, decimal, dubaiDate, todayDubai } from "@/lib/money";
import type { Data, Row } from "./types";
type Page =
  | "Overview"
  | "Inventory"
  | "Japan Pool"
  | "Sales"
  | "Customers"
  | "Suppliers"
  | "Expenses"
  | "Payments"
  | "Documents"
  | "Reports"
  | "Settings";
type Option = { value: string; label: string };
type Field = {
  name: string;
  label: string;
  type?: string;
  options?: Option[];
  required?: boolean;
  hint?: string;
  full?: boolean;
  value?: string;
};
type Dialog = {
  title: string;
  subtitle?: string;
  module: string;
  fields: Field[];
  initial?: Row;
  extra?: Row;
};
const nav = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Inventory", icon: Truck },
  { name: "Japan Pool", icon: Globe2 },
  { name: "Sales", icon: Receipt },
  { name: "Customers", icon: Users },
  { name: "Suppliers", icon: Building2 },
  { name: "Expenses", icon: Banknote },
  { name: "Payments", icon: Wallet },
  { name: "Documents", icon: FolderOpen },
  { name: "Reports", icon: BarChart3 },
  { name: "Settings", icon: Settings },
] as const;
const human = (s: string) =>
  s
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
const opt = (values: string[]) =>
  values.map((value) => ({ value, label: human(value) }));
const statuses = [
  "JAPAN_POOL",
  "COMMITTED",
  "AWAITING_SHIPMENT",
  "IN_TRANSIT",
  "UAE_INVENTORY",
  "SOLD",
  "DELIVERED",
];
const money = (s: string | bigint | null | undefined) =>
  s === null || s === undefined ? "—" : aed(s);
const shortMoney = (s: string) => {
  const full = money(s);
  return full.endsWith(".00") ? full.slice(0, -3) : full;
};
const record = (row: object) => row as unknown as Row;
async function request(url: string, body?: unknown, method = "POST") {
  const response = await fetch(url, {
    method,
    headers:
      body instanceof FormData ? {} : { "Content-Type": "application/json" },
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
}
function Brand() {
  return (
    <div className="brand">
      <div className="brand-image">
        <img
          src="/brand-logo.png"
          alt="Kei Tora Projects"
          width="260"
          height="260"
        />
      </div>
      <span>BUSINESS HUB</span>
    </div>
  );
}
function Badge({ value }: { value: string }) {
  return (
    <span
      className={
        "badge " +
        (["VERIFIED", "DELIVERED", "MATCHED", "UAE_INVENTORY"].includes(value)
          ? "green"
          : ["PENDING", "COMMITTED", "IN_TRANSIT", "AGREED", "SOLD"].includes(
                value,
              )
            ? "amber"
            : "")
      }
    >
      {human(value)}
    </span>
  );
}
function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Package size={28} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  icon: Icon,
  dark = false,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Wallet;
  dark?: boolean;
}) {
  return (
    <div className={"metric " + (dark ? "dark" : "")}>
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
export default function Hub() {
  const [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [auth, setAuth] = useState(false),
    [error, setError] = useState(""),
    [page, setPage] = useState<Page>("Overview"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [mobile, setMobile] = useState(false),
    [dialog, setDialog] = useState<Dialog | null>(null),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [reportTab, setReportTab] = useState("vehicles"),
    [detail, setDetail] = useState<string | null>(null),
    [importOpen, setImportOpen] = useState(false),
    [importText, setImportText] = useState('{"vehicles": []}'),
    [importPreview, setImportPreview] = useState<Row[] | null>(null),
    [importError, setImportError] = useState("");
  async function load() {
    try {
      const r = await fetch("/api/data", { cache: "no-store" });
      const d = await r.json();
      if (r.status === 401) {
        setAuth(false);
        setData(null);
        return;
      }
      if (!r.ok) throw new Error(d.error);
      setData(d);
      setAuth(true);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function go(p: Page) {
    setPage(p);
    setQuery("");
    setFilter("ALL");
    setDetail(null);
    setMobile(false);
  }
  const activeParties = (kind: string) =>
    data?.parties
      .filter((p) => p.kind === kind)
      .map((p) => ({ value: p.id, label: p.name })) || [];
  const vehicleOptions =
    data?.vehicles
      .filter((v) => v.status !== "JAPAN_POOL")
      .map((v) => ({
        value: v.id,
        label: v.code + " · " + v.make + " " + v.model,
      })) || [];
  const dateField = (name: string, label: string): Field => ({
    name,
    label,
    type: "date",
    required: true,
    value: todayDubai(),
  });
  function openVehicle(row?: Row, pool = false) {
    setDialog({
      title: row ? "Edit vehicle" : "Add vehicle",
      subtitle:
        "Identity and acquisition only. Record confirmed costs as bills.",
      module: "vehicles",
      initial: row
        ? {
            ...row,
            year: row.year ? String(row.year) : "",
            committedAt: row.committedAt
              ? String(row.committedAt).slice(0, 10)
              : "",
            shippingEstimate: decimal(BigInt(String(row.shippingEstimate))),
          }
        : {
            status: pool ? "JAPAN_POOL" : "UAE_INVENTORY",
            location: pool ? "JAPAN" : "UAE",
            shippingEstimate: decimal(
              BigInt(data?.settings.shippingEstimate || "1200000"),
            ),
          },
      fields: [
        {
          name: "code",
          label: "Unique vehicle ID",
          required: true,
          hint: "Use your own identifier, never a guessed chassis.",
        },
        { name: "make", label: "Make", required: true },
        { name: "model", label: "Model", required: true },
        { name: "year", label: "Model year", type: "number" },
        { name: "chassis", label: "Chassis / VIN (if known)" },
        {
          name: "acquisition",
          label: "Acquisition type",
          options: opt(["INVENTORY", "CUSTOMER_SOURCED"]),
          required: true,
        },
        {
          name: "location",
          label: "Location",
          options: opt(["JAPAN", "IN_TRANSIT", "UAE"]),
        },
        {
          name: "status",
          label: "Status",
          options: opt(
            row && ["SOLD", "DELIVERED"].includes(String(row.status))
              ? [String(row.status)]
              : statuses.slice(0, 5),
          ),
        },
        {
          name: "committedAt",
          label: "Purchase agreement date",
          type: "date",
          hint: "Required when committed or owned.",
        },
        {
          name: "supplierId",
          label: "Supplier",
          options: [
            { value: "", label: "Not assigned" },
            ...activeParties("SUPPLIER"),
          ],
        },
        {
          name: "shippingEstimate",
          label: "Shipping / import estimate (AED)",
          required: true,
          hint: "Estimate only. Creates no cost or liability.",
        },
        { name: "notes", label: "Notes", type: "textarea", full: true },
      ],
    });
  }
  function openParty(kind: string, row?: Row) {
    setDialog({
      title: row ? "Edit " + human(kind) : "Add " + human(kind),
      module: "parties",
      initial: row,
      extra: { kind },
      fields: [
        { name: "name", label: "Name", required: true },
        { name: "email", label: "Email", type: "email" },
        { name: "phone", label: "Phone" },
        {
          name: "group",
          label: "Supplier group",
          options: opt(["LOCAL", "JAPAN", "IMPORT_PARTNER"]),
        },
        { name: "notes", label: "Notes", type: "textarea", full: true },
      ].filter((field) => kind === "SUPPLIER" || field.name !== "group"),
    });
  }
  function openBill(vehicleId = "") {
    setDialog({
      title: "Record a confirmed bill",
      subtitle:
        "Posts an obligation, whether paid or unpaid. Use a credit for corrections.",
      module: "bills",
      initial: { vehicleId, currency: "AED" },
      fields: [
        { name: "reference", label: "Unique bill reference", required: true },
        {
          name: "supplierId",
          label: "Supplier",
          options: activeParties("SUPPLIER"),
          required: true,
        },
        {
          name: "vehicleId",
          label: "Cost allocation",
          options: [
            { value: "", label: "Business expense (no vehicle)" },
            ...vehicleOptions,
          ],
        },
        {
          name: "category",
          label: "Category",
          options: opt((data?.settings.categories as string[]) || []),
          required: true,
        },
        {
          name: "description",
          label: "Description",
          required: true,
          full: true,
        },
        {
          name: "amount",
          label: "Confirmed amount in AED",
          required: true,
          hint: "For foreign bills, enter the confirmed AED equivalent.",
        },
        {
          name: "currency",
          label: "Original currency (ISO)",
          required: true,
          value: "AED",
        },
        {
          name: "originalAmount",
          label: "Original invoice amount",
          required: true,
        },
        dateField("issuedAt", "Bill date"),
        { name: "dueAt", label: "Due date", type: "date" },
        { name: "notes", label: "Notes", type: "textarea", full: true },
      ],
    });
  }
  function openSale(vehicleId = "") {
    setDialog({
      title: "Create a sale agreement",
      subtitle:
        "An agreement does not recognize revenue. Mark sold separately when the sale is completed.",
      module: "sales",
      initial: {
        vehicleId,
        weights:
          (
            data?.settings.plans as unknown as
              { weights: number[] }[] | undefined
          )?.[0]?.weights.join(",") || "60,40",
      },
      fields: [
        { name: "reference", label: "Agreement reference", required: true },
        {
          name: "vehicleId",
          label: "Vehicle",
          options: vehicleOptions.filter(
            (v) => !data?.sales.some((s) => s.vehicleId === v.value),
          ),
          required: true,
        },
        {
          name: "customerId",
          label: "Customer",
          options: activeParties("CUSTOMER"),
          required: true,
        },
        {
          name: "type",
          label: "Sale type",
          options: opt(["AS_IS", "CUSTOMIZED"]),
        },
        { name: "amount", label: "Agreed selling price (AED)", required: true },
        dateField("agreedAt", "Agreement date"),
        {
          name: "weights",
          label: "Installment percentages",
          required: true,
          hint: "60,40 or 50,30,20. Custom percentages must total 100.",
        },
        {
          name: "dueDates",
          label: "Installment due dates",
          required: true,
          hint: "One YYYY-MM-DD date per installment, separated by commas.",
          full: true,
        },
        { name: "notes", label: "Notes", type: "textarea", full: true },
      ],
    });
  }
  function openPayment(initial?: Row) {
    setDialog({
      title: "Record a payment",
      subtitle:
        "Saved as pending. Verify only after checking the actual transaction. Use a unique bank reference.",
      module: "payments",
      initial,
      extra: { idempotencyKey: crypto.randomUUID() },
      fields: [
        {
          name: "kind",
          label: "Movement type",
          options: opt([
            "CUSTOMER_RECEIPT",
            "SUPPLIER_PAYMENT",
            "CUSTOMER_REFUND",
            "OWNER_CONTRIBUTION",
            "OWNER_WITHDRAWAL",
          ]),
        },
        {
          name: "reference",
          label: "Unique transaction reference",
          required: true,
        },
        {
          name: "saleId",
          label: "Sale (customer payments)",
          options: [
            { value: "", label: "No sale" },
            ...(data?.report.sales.map((s) => ({
              value: s.id,
              label: s.reference + " · " + s.customerName,
            })) || []),
          ],
        },
        {
          name: "billId",
          label: "Bill (supplier payments)",
          options: [
            { value: "", label: "No bill" },
            ...(data?.report.bills.map((b) => ({
              value: b.id,
              label: b.reference + " · " + b.supplierName,
            })) || []),
          ],
        },
        { name: "amount", label: "Amount (AED)", required: true },
        dateField("date", "Payment date"),
        {
          name: "method",
          label: "Payment method",
          options: opt(["BANK_TRANSFER", "CASH"]),
        },
        {
          name: "account",
          label: "Paid through",
          options: [
            { value: "BUSINESS", label: "Business account / cash" },
            {
              value: "PERSONAL",
              label: "Personal account — business activity only",
            },
          ],
        },
        { name: "notes", label: "Notes", type: "textarea", full: true },
      ],
    });
  }
  function openCredit(billId = "", saleId = "") {
    setDialog({
      title: "Post a credit adjustment",
      subtitle:
        "Preserves the original posting. A customer credit can create a refund obligation; record the refund separately.",
      module: "adjustments",
      initial: { billId, saleId },
      fields: [
        { name: "reference", label: "Unique credit reference", required: true },
        { name: "amount", label: "Credit amount (AED)", required: true },
        {
          name: "billId",
          label: "Bill",
          options: [
            { value: "", label: "No bill" },
            ...(data?.bills.map((b) => ({ value: b.id, label: b.reference })) ||
              []),
          ],
        },
        {
          name: "saleId",
          label: "Sale",
          options: [
            { value: "", label: "No sale" },
            ...(data?.sales.map((s) => ({ value: s.id, label: s.reference })) ||
              []),
          ],
        },
        dateField("date", "Credit date"),
        {
          name: "reason",
          label: "Reason",
          type: "textarea",
          required: true,
          full: true,
        },
      ],
    });
  }
  function actionDialog(
    title: string,
    extra: Row,
    fields: Field[],
    subtitle?: string,
  ) {
    setDialog({ title, module: "actions", extra, fields, subtitle });
  }
  async function save(form: HTMLFormElement) {
    if (!dialog) return;
    setBusy(true);
    setError("");
    try {
      const values = Object.fromEntries(new FormData(form));
      const payload: Row = {
        ...dialog.extra,
        ...(dialog.initial?.id ? { id: dialog.initial.id } : {}),
        ...values,
      };
      if (dialog.module === "sales")
        payload.dueDates = String(values.dueDates)
          .split(",")
          .map((s) => s.trim());
      if (dialog.module === "settings") {
        payload.categories = String(values.categories)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        payload.plans = JSON.parse(String(values.plans));
      }
      await request("/api/records/" + dialog.module, payload);
      setDialog(null);
      await load();
      setToast("Record saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  const matches = (row: object) =>
    !query || JSON.stringify(row).toLowerCase().includes(query.toLowerCase());
  if (loading)
    return (
      <div className="loading">
        <Brand />
        <span className="spinner" />
        <p>Opening your workspace…</p>
      </div>
    );
  if (!auth) return <Login onLogin={load} initialError={error} />;
  if (!data) return null;
  const r = data.report,
    s = r.summary;
  const add = (
    <button
      className="btn primary"
      onClick={() =>
        page === "Inventory" || page === "Japan Pool"
          ? openVehicle(undefined, page === "Japan Pool")
          : page === "Suppliers" || page === "Customers"
            ? openParty(page === "Suppliers" ? "SUPPLIER" : "CUSTOMER")
            : page === "Expenses"
              ? openBill()
              : page === "Sales"
                ? openSale()
                : page === "Payments"
                  ? openPayment()
                  : page === "Documents"
                    ? setDialog({
                        title: "Upload a private document",
                        module: "document",
                        fields: [],
                      })
                    : openPayment()
      }
    >
      <Plus size={16} />
      {page === "Overview"
        ? "Record payment"
        : page === "Inventory" || page === "Japan Pool"
          ? "Add vehicle"
          : page === "Sales"
            ? "New agreement"
            : page === "Expenses"
              ? "Record bill"
              : page === "Payments"
                ? "Record payment"
                : page === "Documents"
                  ? "Upload document"
                  : page === "Customers"
                    ? "Add customer"
                    : "Add supplier"}
    </button>
  );
  const currentVehicle = detail
    ? r.vehicles.find((v) => v.id === detail)
    : null;
  const currentParty = detail
    ? data.parties.find((p) => p.id === detail)
    : null;
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-shade" onClick={() => setMobile(false)} />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <Brand />
        <div className="workspace-tag">
          <span className="workspace-icon">K</span>
          <div>
            Keitora Projects<small>Private workspace</small>
          </div>
          <ShieldCheck size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(({ name, icon: Icon }, i) => (
            <button
              key={name}
              className={
                (page === name ? "active " : "") +
                (i === 8 ? "nav-separated" : "")
              }
              onClick={() => go(name)}
            >
              <Icon size={18} strokeWidth={1.6} />
              <span>{name}</span>
              {name === "Inventory" && <small>{s.owned}</small>}
              {name === "Japan Pool" && s.pool > 0 && (
                <span className="nav-dot" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-note">
            <ShieldCheck size={16} />
            <span>
              Yours. Private. Organized.<small>AED · Asia/Dubai</small>
            </span>
          </div>
          <button
            className="profile"
            onClick={async () => {
              await request("/api/auth", undefined, "DELETE");
              setAuth(false);
              setData(null);
            }}
          >
            <span className="avatar">KP</span>
            <span>
              Administrator<small>Keitora Projects</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span className="muted">Workspace</span>
            <ChevronRight size={13} />
            <span>{page}</span>
          </div>
          <div className="topbar-right">
            <span className="live-dot" />
            <span>Private workspace</span>
            <span className="divider" />
            <span className="avatar small">KP</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                KEITORA HUB <span>/</span>{" "}
                {page === "Overview" ? "THE BIG PICTURE" : "WORKSPACE"}
              </div>
              <h1>
                {currentVehicle
                  ? currentVehicle.code
                  : currentParty
                    ? currentParty.name
                    : page === "Japan Pool"
                      ? "Japan vehicle pool"
                      : page}
              </h1>
              <p>
                {page === "Overview"
                  ? "Your business, in a clearer view."
                  : page === "Inventory"
                    ? "Every vehicle. Every confirmed cost. One place."
                    : page === "Japan Pool"
                      ? "Potential vehicles with your supplier. No commitment, no liability."
                      : page === "Expenses"
                        ? "Confirmed costs and obligations, separate from cash paid."
                        : page === "Sales"
                          ? "From agreement to delivery, with every receipt accounted for."
                          : page === "Payments"
                            ? "Record, verify, and reconcile your business cash movements."
                            : page === "Reports"
                              ? "Clear numbers, with the accounting basis made explicit."
                              : page === "Documents"
                                ? "Your photos, bills, and Canva documents. Privately stored."
                                : page === "Settings"
                                  ? "Your defaults, preferences, and audit history."
                                  : "Relationships, records, and outstanding balances."}
              </p>
            </div>
            <div className="heading-actions">
              {page === "Overview" && (
                <span className="date-pill">
                  <Clock3 size={14} />
                  {dubaiDate(new Date())}
                </span>
              )}
              {!["Reports", "Settings"].includes(page) && add}
            </div>
          </div>
          {data.settings.demo && (
            <div className="demo-banner">
              <span className="demo-label">DEMO WORKSPACE</span>
              <span>
                All vehicles, contacts, and financial records shown here are
                fictional.
              </span>
              <button onClick={() => go("Settings")}>
                About demo mode <ArrowRight size={14} />
              </button>
            </div>
          )}
          {error && !dialog && (
            <div className="alert" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={15} />
              </button>
            </div>
          )}
          {page === "Overview" && (
            <>
              {!data.settings.demo && (
                <div className="onboarding-banner">
                  <Package size={20} />
                  <div>
                    <strong>Start with your nine known vehicles</strong>
                    <p>
                      9 in the UAE · 2 sold awaiting delivery · details not yet
                      imported. These are context, not recorded totals.
                    </p>
                  </div>
                  <button
                    className="btn"
                    onClick={() => {
                      setImportOpen(true);
                      setImportPreview(null);
                    }}
                  >
                    Import details <ArrowRight size={15} />
                  </button>
                </div>
              )}
              <div className="section-heading">
                <h2>Business at a glance</h2>
                <span>
                  All recorded activity <span className="dot-separator">·</span>{" "}
                  AED
                </span>
              </div>
              <div className="metrics four">
                <Metric
                  label="Sales revenue"
                  value={shortMoney(s.revenue)}
                  note="Recognized when marked sold"
                  icon={ArrowUpRight}
                />
                <Metric
                  label="Gross sales profit"
                  value={shortMoney(s.grossProfit)}
                  note="Revenue less confirmed direct costs"
                  icon={BarChart3}
                />
                <Metric
                  label="Customer receivables"
                  value={shortMoney(s.receivables)}
                  note={
                    s.refundsDue !== "0"
                      ? money(s.refundsDue) + " in refunds due"
                      : "Agreements less verified net receipts"
                  }
                  icon={ArrowDownLeft}
                />
                <Metric
                  label="Supplier payables"
                  value={shortMoney(s.payables)}
                  note="Confirmed bills less credits and payments"
                  icon={Building2}
                />
              </div>
              <div className="dashboard-middle">
                <section className="card inventory-snapshot">
                  <div className="card-heading">
                    <div>
                      <h2>Your vehicle portfolio</h2>
                      <p>A place for every stage.</p>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => go("Inventory")}
                    >
                      View inventory <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="portfolio-counts">
                    <div>
                      <span className="count-icon">
                        <Truck size={22} strokeWidth={1.4} />
                      </span>
                      <strong>{s.owned.toString().padStart(2, "0")}</strong>
                      <span>Owned & unsold</span>
                    </div>
                    <div>
                      <span className="count-icon">
                        <Receipt size={22} strokeWidth={1.4} />
                      </span>
                      <strong>
                        {s.soldAwaitingDelivery.toString().padStart(2, "0")}
                      </strong>
                      <span>Sold · awaiting delivery</span>
                    </div>
                    <div>
                      <span className="count-icon">
                        <Globe2 size={22} strokeWidth={1.4} />
                      </span>
                      <strong>{s.pool.toString().padStart(2, "0")}</strong>
                      <span>In the Japan pool</span>
                    </div>
                  </div>
                  <div className="card-foot">
                    <span className="live-dot" />
                    Japan Pool is excluded from owned inventory and liabilities.
                    <button
                      className="text-btn"
                      onClick={() => go("Japan Pool")}
                      aria-label="View Japan Pool"
                    >
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </section>
                <section className="cash-card">
                  <div className="cash-title">
                    <span className="cash-icon">
                      <Wallet size={19} />
                    </span>
                    <span>Recorded cash movement</span>
                    <ArrowUpRight size={18} />
                  </div>
                  <div className="cash-amount">
                    {shortMoney(s.cashMovement)}
                  </div>
                  <p>Verified movements · all time</p>
                  <div className="cash-split">
                    <div>
                      <span>
                        <ArrowDownLeft size={12} />
                        Money in
                      </span>
                      <strong>{shortMoney(s.cashIn)}</strong>
                    </div>
                    <div>
                      <span>
                        <ArrowUpRight size={12} />
                        Money out
                      </span>
                      <strong>{shortMoney(s.cashOut)}</strong>
                    </div>
                  </div>
                  <button onClick={() => go("Payments")}>
                    View payments <ArrowRight size={14} />
                  </button>
                </section>
              </div>
              <div className="dashboard-lower">
                <section className="card">
                  <div className="card-heading">
                    <div>
                      <h2>Recent vehicles</h2>
                      <p>Your latest recorded additions.</p>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => go("Inventory")}
                    >
                      View all <ArrowRight size={15} />
                    </button>
                  </div>
                  {r.vehicles.length ? (
                    <div className="recent-list">
                      {r.vehicles.slice(0, 4).map((v) => (
                        <button
                          className="recent-row"
                          key={v.id}
                          onClick={() => {
                            go(
                              v.status === "JAPAN_POOL"
                                ? "Japan Pool"
                                : "Inventory",
                            );
                            setDetail(v.id);
                          }}
                        >
                          <span className="vehicle-icon">
                            <Truck size={24} strokeWidth={1.2} />
                          </span>
                          <span className="vehicle-name">
                            <strong>
                              {v.make} {v.model}
                            </strong>
                            <small>
                              {v.code} <span>·</span>{" "}
                              {v.year || "Year not recorded"}
                            </small>
                          </span>
                          <Badge value={v.status} />
                          <ChevronRight size={15} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="Your inventory starts here"
                      description="Add a vehicle or safely import your actual vehicle details."
                      action={
                        <button className="btn" onClick={() => openVehicle()}>
                          Add your first vehicle
                        </button>
                      }
                    />
                  )}
                </section>
                <section className="card attention">
                  <div className="card-heading">
                    <div>
                      <h2>Worth your attention</h2>
                      <p>A few things to keep moving.</p>
                    </div>
                    <span className="subtle-icon">
                      <CircleAlert size={18} />
                    </span>
                  </div>
                  <button onClick={() => go("Payments")}>
                    <span className="attention-icon amber">
                      <Clock3 size={17} />
                    </span>
                    <span>
                      <strong>
                        {
                          data.payments.filter((p) => p.status === "PENDING")
                            .length
                        }{" "}
                        payments to verify
                      </strong>
                      <small>Pending entries do not affect balances</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                  <button
                    onClick={() => {
                      go("Expenses");
                      setFilter("OVERDUE");
                    }}
                  >
                    <span className="attention-icon">
                      <Receipt size={17} />
                    </span>
                    <span>
                      <strong>
                        {
                          r.bills.filter(
                            (b) =>
                              b.dueAt &&
                              b.dueAt.slice(0, 10) < todayDubai() &&
                              BigInt(b.balance) > 0n,
                          ).length
                        }{" "}
                        overdue supplier bills
                      </strong>
                      <small>Review due dates and outstanding amounts</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                  <button
                    onClick={() => {
                      go("Payments");
                      setFilter("PERSONAL");
                    }}
                  >
                    <span className="attention-icon">
                      <CreditCard size={17} />
                    </span>
                    <span>
                      <strong>
                        {
                          data.payments.filter(
                            (p) =>
                              p.account === "PERSONAL" &&
                              p.status === "VERIFIED" &&
                              p.reconciliation !== "MATCHED",
                          ).length
                        }{" "}
                        personal-account entries to reconcile
                      </strong>
                      <small>Business activity recorded by you only</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                  <div className="attention-note">
                    <ShieldCheck size={15} />
                    <span>Estimates are never posted as actual costs.</span>
                  </div>
                </section>
              </div>
              <div className="metrics four secondary-metrics">
                <Metric
                  label="All confirmed costs"
                  value={money(s.allConfirmedCosts)}
                  note="All vehicle and business bills · paid or unpaid"
                  icon={Receipt}
                />
                <Metric
                  label="Confirmed business expenses"
                  value={money(s.operatingExpenses)}
                  note="Excludes vehicle-attributable costs"
                  icon={Banknote}
                />
                <Metric
                  label="Net operating profit"
                  value={money(s.netProfit)}
                  note="Gross sales profit less business expenses"
                  icon={BarChart3}
                />
                <Metric
                  label="Unearned customer deposits"
                  value={money(s.unearnedDeposits)}
                  note="Verified net receipts on unsold agreements"
                  icon={Wallet}
                />
              </div>
              <div className="basis-note">
                <CircleHelp size={15} />
                <span>
                  Profit uses confirmed accrual-style costs, including unpaid
                  bills. Cash movement includes verified receipts, refunds,
                  supplier and owner movements. It is not a bank balance or
                  formal tax account.
                </span>
              </div>
            </>
          )}
          {["Inventory", "Japan Pool"].includes(page) &&
            (currentVehicle ? (
              <>
                <button
                  className="text-btn back"
                  onClick={() => setDetail(null)}
                >
                  ← Back to {page.toLowerCase()}
                </button>
                <div className="detail-grid">
                  <section className="card detail-card">
                    <div className="card-heading">
                      <h2>
                        {currentVehicle.make} {currentVehicle.model}
                      </h2>
                      <Badge value={currentVehicle.status} />
                    </div>
                    <dl>
                      {Object.entries({
                        ID: currentVehicle.code,
                        Year: currentVehicle.year || "Not recorded",
                        Chassis: currentVehicle.chassis || "Not recorded",
                        Acquisition: human(currentVehicle.acquisition),
                        Location: human(currentVehicle.location),
                        Supplier: currentVehicle.supplierName,
                        "Agreement date": currentVehicle.committedAt
                          ? dubaiDate(currentVehicle.committedAt)
                          : "Not committed",
                        "Shipping estimate": money(
                          currentVehicle.shippingEstimate,
                        ),
                        Customer: currentVehicle.customerName || "Not linked",
                        "Sale type": currentVehicle.saleType
                          ? human(currentVehicle.saleType)
                          : "Not agreed",
                        Notes: currentVehicle.notes || "—",
                      }).map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="row-actions">
                      <button
                        className="btn"
                        onClick={() => openVehicle(record(currentVehicle))}
                      >
                        Edit details
                      </button>
                      {!currentVehicle.saleId &&
                        currentVehicle.status !== "JAPAN_POOL" && (
                          <button
                            className="btn"
                            onClick={() => openSale(currentVehicle.id)}
                          >
                            Create agreement
                          </button>
                        )}
                      <button
                        className="btn"
                        onClick={() =>
                          actionDialog(
                            "Archive vehicle",
                            {
                              action: "archive",
                              entity: "vehicle",
                              id: currentVehicle.id,
                            },
                            [],
                            "Only vehicles with no financial links may be archived.",
                          )
                        }
                      >
                        Archive
                      </button>
                    </div>
                  </section>
                  <section className="card detail-card">
                    <h2>Vehicle financials</h2>
                    <div className="detail-stat">
                      <span>Confirmed direct costs · paid or unpaid</span>
                      <strong>{money(currentVehicle.cost)}</strong>
                    </div>
                    <div className="detail-stat">
                      <span>Agreed selling price</span>
                      <strong>{money(currentVehicle.agreedAmount)}</strong>
                    </div>
                    <div className="detail-stat">
                      <span>{currentVehicle.marginType}</span>
                      <strong>{money(currentVehicle.margin)}</strong>
                    </div>
                    <p className="helper">
                      Shipping estimate is excluded. Unrecorded future costs can
                      change the final margin.
                    </p>
                    <button
                      className="btn primary"
                      disabled={currentVehicle.status === "JAPAN_POOL"}
                      onClick={() => openBill(currentVehicle.id)}
                    >
                      <Plus size={15} />
                      Record vehicle cost
                    </button>
                    <h3 className="subheading">Cost breakdown</h3>
                    {r.bills
                      .filter((b) => b.vehicleId === currentVehicle.id)
                      .map((b) => (
                        <div className="simple-row" key={b.id}>
                          <span>
                            {human(b.category)}
                            <small>
                              {b.reference} · {b.description}
                            </small>
                          </span>
                          <strong>{money(b.net)}</strong>
                        </div>
                      ))}
                    <h3 className="subheading">Attached documents</h3>
                    <DocumentLinks
                      docs={data.documents.filter(
                        (d) =>
                          d.entityType === "vehicle" &&
                          d.entityId === currentVehicle.id,
                      )}
                    />
                  </section>
                </div>
              </>
            ) : (
              <>
                <Toolbar
                  query={query}
                  setQuery={setQuery}
                  placeholder="Search ID, make, model, chassis…"
                >
                  <select
                    aria-label="Filter vehicle status"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="ALL">All statuses</option>
                    {opt(
                      page === "Japan Pool"
                        ? ["JAPAN_POOL"]
                        : statuses.slice(1),
                    ).map((o) => (
                      <option value={o.value} key={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <a className="btn" href="/api/export?type=vehicles">
                    <Download size={15} />
                    Export CSV
                  </a>
                  <button
                    className="btn"
                    onClick={() => {
                      setImportOpen(true);
                      setImportPreview(null);
                    }}
                  >
                    Import
                  </button>
                </Toolbar>
                <div className="inventory-summary">
                  <span>
                    {page === "Japan Pool" ? s.pool : s.owned}{" "}
                    {page === "Japan Pool"
                      ? "potential vehicles"
                      : "owned & unsold"}
                  </span>
                  <span>
                    {page === "Japan Pool"
                      ? "Not owned · no financial commitment"
                      : s.soldAwaitingDelivery +
                        " sold awaiting delivery · " +
                        s.delivered +
                        " delivered"}
                  </span>
                </div>
                <DataTable
                  columns={[
                    "Vehicle",
                    "Acquisition",
                    "Location",
                    "Status",
                    page === "Japan Pool"
                      ? "Shipping estimate"
                      : "Confirmed costs",
                    "",
                  ]}
                  rows={r.vehicles.filter(
                    (v) =>
                      (page === "Japan Pool"
                        ? v.status === "JAPAN_POOL"
                        : v.status !== "JAPAN_POOL") &&
                      (filter === "ALL" || v.status === filter) &&
                      matches(v),
                  )}
                  render={(v) => (
                    <>
                      <td>
                        <button
                          className="table-link vehicle-cell"
                          onClick={() => setDetail(v.id)}
                        >
                          <span className="vehicle-icon">
                            <Truck size={23} />
                          </span>
                          <span>
                            <strong>
                              {v.make} {v.model}
                            </strong>
                            <small>
                              {v.code} · {v.year || "—"}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>{human(v.acquisition)}</td>
                      <td>{human(v.location)}</td>
                      <td>
                        <Badge value={v.status} />
                      </td>
                      <td className="money">
                        {money(
                          page === "Japan Pool" ? v.shippingEstimate : v.cost,
                        )}
                      </td>
                      <td>
                        <button
                          className="icon-btn"
                          aria-label={"Open " + v.code}
                          onClick={() => setDetail(v.id)}
                        >
                          <ArrowUpRight size={17} />
                        </button>
                      </td>
                    </>
                  )}
                  empty={
                    <Empty
                      title="No vehicles to show"
                      description="Add a vehicle using details you have confirmed."
                      action={
                        <button
                          className="btn"
                          onClick={() =>
                            openVehicle(undefined, page === "Japan Pool")
                          }
                        >
                          Add vehicle
                        </button>
                      }
                    />
                  }
                />
              </>
            ))}
          {["Suppliers", "Customers"].includes(page) &&
            (currentParty ? (
              <>
                <button
                  className="text-btn back"
                  onClick={() => setDetail(null)}
                >
                  ← Back to {page.toLowerCase()}
                </button>
                <div className="card detail-card">
                  <div className="card-heading">
                    <h2>{currentParty.name}</h2>
                    <button
                      className="btn"
                      onClick={() =>
                        openParty(currentParty.kind, record(currentParty))
                      }
                    >
                      Edit profile
                    </button>
                  </div>
                  <p>
                    {currentParty.email || "No email"} ·{" "}
                    {currentParty.phone || "No phone"} ·{" "}
                    {human(currentParty.group)}
                  </p>
                  <p>{currentParty.notes}</p>
                  <div className="row-actions">
                    <button
                      className="btn"
                      onClick={() =>
                        actionDialog(
                          "Archive contact",
                          {
                            action: "archive",
                            entity: "party",
                            id: currentParty.id,
                          },
                          [],
                          "Only contacts with no linked records can be archived.",
                        )
                      }
                    >
                      Archive contact
                    </button>
                  </div>
                  <h3 className="subheading">
                    {currentParty.kind === "SUPPLIER"
                      ? "Bills and payable aging"
                      : "Agreements and customer balances"}
                  </h3>
                  {currentParty.kind === "SUPPLIER"
                    ? r.bills
                        .filter((b) => b.supplierId === currentParty.id)
                        .map((b) => (
                          <div className="simple-row" key={b.id}>
                            <span>
                              {b.reference}
                              <small>
                                {b.dueAt
                                  ? "Due " + dubaiDate(b.dueAt)
                                  : "No due date"}{" "}
                                · {b.description}
                              </small>
                            </span>
                            <strong>{money(b.balance)}</strong>
                            <button
                              className="btn"
                              onClick={() =>
                                openPayment({
                                  kind: "SUPPLIER_PAYMENT",
                                  billId: b.id,
                                })
                              }
                            >
                              Record payment
                            </button>
                          </div>
                        ))
                    : r.sales
                        .filter((s) => s.customerId === currentParty.id)
                        .map((s) => (
                          <div className="simple-row" key={s.id}>
                            <span>
                              {s.reference}
                              <small>
                                {s.vehicleCode} · {human(s.status)}
                              </small>
                            </span>
                            <strong>{money(s.balance)}</strong>
                            <button
                              className="btn"
                              onClick={() =>
                                openPayment({
                                  kind: "CUSTOMER_RECEIPT",
                                  saleId: s.id,
                                })
                              }
                            >
                              Record receipt
                            </button>
                          </div>
                        ))}
                  {currentParty.kind === "SUPPLIER" && (
                    <div className="aging">
                      <h3>Payable aging</h3>
                      {r.suppliers
                        .find((p) => p.id === currentParty.id)
                        ?.aging.map((v, i) => (
                          <div key={i}>
                            <span>
                              {
                                [
                                  "Current / no due date",
                                  "1–30 days overdue",
                                  "31–60 days overdue",
                                  "61+ days overdue",
                                ][i]
                              }
                            </span>
                            <strong>{money(v)}</strong>
                          </div>
                        ))}
                    </div>
                  )}
                  <DocumentLinks
                    docs={data.documents.filter(
                      (d) =>
                        d.entityType === "party" &&
                        d.entityId === currentParty.id,
                    )}
                  />
                </div>
              </>
            ) : (
              <>
                <Toolbar
                  query={query}
                  setQuery={setQuery}
                  placeholder={"Search " + page.toLowerCase() + "…"}
                >
                  <a
                    className="btn"
                    href={"/api/export?type=" + page.toLowerCase()}
                  >
                    <Download size={15} />
                    Export CSV
                  </a>
                </Toolbar>
                {page === "Suppliers" ? (
                  <DataTable
                    columns={[
                      "Supplier",
                      "Group",
                      "Confirmed bills",
                      "Outstanding",
                      "Overdue",
                      "",
                    ]}
                    rows={r.suppliers.filter(matches)}
                    render={(p) => (
                      <>
                        <td>
                          <button
                            className="table-link"
                            onClick={() => setDetail(p.id)}
                          >
                            <strong>{p.name}</strong>
                            <small>
                              {p.email || p.phone || "No contact details"}
                            </small>
                          </button>
                        </td>
                        <td>
                          <Badge value={p.group} />
                        </td>
                        <td className="money">{money(p.billed)}</td>
                        <td className="money">{money(p.balance)}</td>
                        <td className="money">{money(p.overdue)}</td>
                        <td>
                          <button
                            className="icon-btn"
                            aria-label={"View " + p.name}
                            onClick={() => setDetail(p.id)}
                          >
                            <ArrowUpRight size={17} />
                          </button>
                        </td>
                      </>
                    )}
                    empty={
                      <Empty
                        title="No suppliers yet"
                        description="Add your Japanese supplier, shipping partner, and local suppliers separately."
                      />
                    }
                  />
                ) : (
                  <DataTable
                    columns={[
                      "Customer",
                      "Agreed sales",
                      "Verified net receipts",
                      "Balance",
                      "",
                    ]}
                    rows={r.customers.filter(matches)}
                    render={(p) => (
                      <>
                        <td>
                          <button
                            className="table-link"
                            onClick={() => setDetail(p.id)}
                          >
                            <strong>{p.name}</strong>
                            <small>
                              {p.email || p.phone || "No contact details"}
                            </small>
                          </button>
                        </td>
                        <td className="money">{money(p.agreed)}</td>
                        <td className="money">{money(p.received)}</td>
                        <td className="money">{money(p.balance)}</td>
                        <td>
                          <button
                            className="icon-btn"
                            aria-label={"View " + p.name}
                            onClick={() => setDetail(p.id)}
                          >
                            <ArrowUpRight size={17} />
                          </button>
                        </td>
                      </>
                    )}
                    empty={
                      <Empty
                        title="No customers yet"
                        description="Add a confirmed customer before creating a vehicle sale agreement."
                      />
                    }
                  />
                )}
              </>
            ))}
          {page === "Expenses" && (
            <>
              <div className="metrics three">
                <Metric
                  label="All confirmed costs"
                  value={money(s.allConfirmedCosts)}
                  note="Vehicle costs plus business expenses, net of credits"
                  icon={Receipt}
                />
                <Metric
                  label="Supplier payables"
                  value={money(s.payables)}
                  note="Verified payments reduce this balance"
                  icon={Building2}
                />
                <Metric
                  label="Business expenses"
                  value={money(s.operatingExpenses)}
                  note="Actual spending only · no assumed rent or salary"
                  icon={Banknote}
                />
              </div>
              <Toolbar
                query={query}
                setQuery={setQuery}
                placeholder="Search bill, supplier, category…"
              >
                <select
                  aria-label="Expense filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {opt([
                    "ALL",
                    "BUSINESS",
                    "VEHICLE",
                    "UNPAID",
                    "PARTIALLY_PAID",
                    "FULLY_PAID",
                    "OVERDUE",
                  ]).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <a className="btn" href="/api/export?type=bills">
                  <Download size={15} />
                  Export CSV
                </a>
                <button className="btn" onClick={() => openCredit()}>
                  Post credit
                </button>
              </Toolbar>
              <DataTable
                columns={[
                  "Bill / category",
                  "Supplier / vehicle",
                  "Confirmed AED",
                  "Balance",
                  "Due",
                  "Actions",
                ]}
                rows={r.bills.filter(
                  (b) =>
                    matches(b) &&
                    (filter === "ALL" ||
                      (filter === "BUSINESS" && !b.vehicleId) ||
                      (filter === "VEHICLE" && b.vehicleId) ||
                      (filter === "UNPAID" &&
                        b.balance === b.net &&
                        BigInt(b.balance) > 0n) ||
                      (filter === "PARTIALLY_PAID" &&
                        BigInt(b.balance) > 0n &&
                        BigInt(b.balance) < BigInt(b.net)) ||
                      (filter === "FULLY_PAID" && b.balance === "0") ||
                      (filter === "OVERDUE" &&
                        b.dueAt &&
                        b.dueAt.slice(0, 10) < todayDubai() &&
                        BigInt(b.balance) > 0n)),
                )}
                render={(b) => (
                  <>
                    <td>
                      <strong>{b.reference}</strong>
                      <small>
                        {human(b.category)} · {b.description}
                      </small>
                      <small>
                        {b.currency} {b.originalAmount} original
                      </small>
                    </td>
                    <td>
                      {b.supplierName}
                      <small>{b.vehicleCode}</small>
                    </td>
                    <td className="money">{money(b.net)}</td>
                    <td className="money">
                      {money(b.balance)}
                      <small>
                        {b.balance === "0"
                          ? "Fully paid"
                          : b.balance === b.net
                            ? "Unpaid"
                            : "Partially paid"}
                      </small>
                    </td>
                    <td>{b.dueAt ? dubaiDate(b.dueAt) : "—"}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn compact"
                          onClick={() =>
                            openPayment({
                              kind: "SUPPLIER_PAYMENT",
                              billId: b.id,
                            })
                          }
                        >
                          Pay
                        </button>
                        <button
                          className="text-btn"
                          onClick={() => openCredit(b.id)}
                        >
                          Credit
                        </button>
                      </div>
                      <DocumentLinks
                        docs={data.documents.filter(
                          (d) => d.entityType === "bill" && d.entityId === b.id,
                        )}
                      />
                    </td>
                  </>
                )}
                empty={
                  <Empty
                    title="No confirmed bills"
                    description="Record actual supplier bills. Shipping and advertising estimates are never posted automatically."
                  />
                }
              />
            </>
          )}
          {page === "Sales" && (
            <>
              <Toolbar
                query={query}
                setQuery={setQuery}
                placeholder="Search agreement, vehicle, customer…"
              >
                <select
                  aria-label="Sale status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {opt(["ALL", "AGREED", "SOLD", "DELIVERED"]).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <a className="btn" href="/api/export?type=sales">
                  <Download size={15} />
                  Export CSV
                </a>
                <button className="btn" onClick={() => openCredit()}>
                  Post credit
                </button>
              </Toolbar>
              {r.sales
                .filter(
                  (s) =>
                    matches(s) && (filter === "ALL" || s.status === filter),
                )
                .map((s) => (
                  <section className="card sale-card" key={s.id}>
                    <div className="card-heading">
                      <div>
                        <div className="sale-title">
                          <h2>{s.vehicleCode}</h2>
                          <Badge value={s.status} />
                        </div>
                        <p>
                          {s.reference} · {s.customerName} · {human(s.type)}
                        </p>
                      </div>
                      <div className="row-actions">
                        <button
                          className="btn"
                          onClick={() =>
                            openPayment({
                              kind: "CUSTOMER_RECEIPT",
                              saleId: s.id,
                            })
                          }
                        >
                          Record receipt
                        </button>
                        {s.status !== "DELIVERED" && (
                          <button
                            className="btn primary"
                            onClick={() =>
                              actionDialog(
                                s.status === "AGREED"
                                  ? "Mark sale as sold"
                                  : "Mark vehicle delivered",
                                {
                                  action: "saleStatus",
                                  id: s.id,
                                  status:
                                    s.status === "AGREED"
                                      ? "SOLD"
                                      : "DELIVERED",
                                },
                                [
                                  dateField(
                                    "date",
                                    s.status === "AGREED"
                                      ? "Sale date"
                                      : "Delivery date",
                                  ),
                                ],
                                s.status === "AGREED"
                                  ? "Recognizes sale revenue and the vehicle’s confirmed costs."
                                  : "Delivery is tracked separately from sale and payments.",
                              )
                            }
                          >
                            {s.status === "AGREED"
                              ? "Mark sold"
                              : "Mark delivered"}
                            <ArrowRight size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="sale-finances">
                      <div>
                        <span>Agreed price · net of credits</span>
                        <strong>{money(s.net)}</strong>
                      </div>
                      <div>
                        <span>Verified net receipts</span>
                        <strong>{money(s.received)}</strong>
                      </div>
                      <div>
                        <span>
                          {BigInt(s.balance) < 0n
                            ? "Refund due"
                            : "Customer balance"}
                        </span>
                        <strong>
                          {money(
                            BigInt(s.balance) < 0n
                              ? -BigInt(s.balance)
                              : s.balance,
                          )}
                        </strong>
                      </div>
                      <div>
                        <span>
                          {s.status === "AGREED" ? "Estimated" : "Realized"}{" "}
                          margin · recorded costs
                        </span>
                        <strong>{money(s.margin)}</strong>
                      </div>
                    </div>
                    <div className="installments">
                      <span>Original payment schedule</span>
                      {(
                        s.installments as unknown as {
                          amount: string;
                          dueAt: string;
                        }[]
                      ).map((p, i) => (
                        <div key={i}>
                          <span className="step">{i + 1}</span>
                          <strong>{money(p.amount)}</strong>
                          <small>Due {dubaiDate(p.dueAt)}</small>
                        </div>
                      ))}
                    </div>
                    <div className="card-foot">
                      <span>
                        Agreed {dubaiDate(s.agreedAt)}
                        {s.soldAt ? " · Sold " + dubaiDate(s.soldAt) : ""}
                        {s.deliveredAt
                          ? " · Delivered " + dubaiDate(s.deliveredAt)
                          : ""}
                      </span>
                      <div className="row-actions">
                        <button
                          className="text-btn"
                          onClick={() => openCredit("", s.id)}
                        >
                          Issue credit
                        </button>
                        <button
                          className="text-btn"
                          onClick={() =>
                            openPayment({
                              kind: "CUSTOMER_REFUND",
                              saleId: s.id,
                            })
                          }
                        >
                          Record refund
                        </button>
                      </div>
                    </div>
                    {s.notes && <p className="helper pad">{s.notes}</p>}
                    <DocumentLinks
                      docs={data.documents.filter(
                        (d) => d.entityType === "sale" && d.entityId === s.id,
                      )}
                    />
                  </section>
                ))}
              {!r.sales.filter(
                (s) => matches(s) && (filter === "ALL" || s.status === filter),
              ).length && (
                <Empty
                  title="No sale agreements to show"
                  description="Create an agreement after adding a vehicle and customer. Deposits stay unearned until the sale is marked sold."
                />
              )}
              <p className="basis-note">
                Credits adjust the agreed total; the original installment
                schedule is retained for audit. Apply revised terms through a
                signed attachment and notes. Schedule amounts are not
                automatically marked paid.
              </p>
            </>
          )}
          {page === "Payments" && (
            <>
              <div className="metrics three">
                <Metric
                  label="Verified cash movement"
                  value={money(s.cashMovement)}
                  note="Recorded business activity · includes owner movements"
                  icon={Wallet}
                />
                <Metric
                  label="Personal-account movement"
                  value={money(s.personalMovement)}
                  note="Included above · not a personal bank statement"
                  icon={CreditCard}
                />
                <Metric
                  label="Pending verification"
                  value={money(s.pending)}
                  note="Gross pending entries · excluded from cash and balances"
                  icon={Clock3}
                />
              </div>
              <Toolbar
                query={query}
                setQuery={setQuery}
                placeholder="Search reference, amount, notes…"
              >
                <select
                  aria-label="Payment filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {opt([
                    "ALL",
                    "PENDING",
                    "VERIFIED",
                    "REVERSED",
                    "PERSONAL",
                    "UNRECONCILED",
                  ]).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <a className="btn" href="/api/export?type=payments">
                  <Download size={15} />
                  Export CSV
                </a>
              </Toolbar>
              <DataTable
                columns={[
                  "Reference / date",
                  "Movement / allocation",
                  "Amount",
                  "Status",
                  "Account / reconciliation",
                  "Actions",
                ]}
                rows={data.payments.filter(
                  (p) =>
                    matches(p) &&
                    (filter === "ALL" ||
                      p.status === filter ||
                      p.account === filter ||
                      (filter === "UNRECONCILED" &&
                        p.reconciliation === "UNRECONCILED" &&
                        p.status === "VERIFIED")),
                )}
                render={(p) => (
                  <>
                    <td>
                      <strong>{p.reference}</strong>
                      <small>
                        {dubaiDate(p.date)} · {human(p.method)}
                      </small>
                      {p.reversalReason && (
                        <small>Reversed: {p.reversalReason}</small>
                      )}
                    </td>
                    <td>
                      {human(p.kind)}
                      <small>
                        {p.saleId
                          ? data.sales.find((s) => s.id === p.saleId)?.reference
                          : p.billId
                            ? data.bills.find((b) => b.id === p.billId)
                                ?.reference
                            : "Owner movement"}
                      </small>
                    </td>
                    <td className="money">{money(p.amount)}</td>
                    <td>
                      <Badge value={p.status} />
                    </td>
                    <td>
                      {human(p.account)}
                      <small>{human(p.reconciliation)}</small>
                      {p.reconciliationNote && (
                        <small>{p.reconciliationNote}</small>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        {p.status === "PENDING" && (
                          <button
                            className="btn compact"
                            onClick={() =>
                              actionDialog(
                                "Verify this payment?",
                                { action: "verify", id: p.id },
                                [],
                                "Confirm you checked " +
                                  p.reference +
                                  " for " +
                                  money(p.amount) +
                                  " against the actual transaction. This updates balances and cash movement.",
                              )
                            }
                          >
                            Verify
                          </button>
                        )}
                        {p.status === "VERIFIED" &&
                          p.reconciliation !== "MATCHED" && (
                            <button
                              className="btn compact"
                              onClick={() =>
                                actionDialog(
                                  "Reconcile payment",
                                  { action: "reconcile", id: p.id },
                                  [
                                    {
                                      name: "note",
                                      label:
                                        "Statement line / evidence reference",
                                      required: true,
                                      type: "textarea",
                                      hint: "Record the business line only. Do not upload unrelated personal transactions.",
                                    },
                                  ],
                                )
                              }
                            >
                              Reconcile
                            </button>
                          )}
                        {p.status !== "REVERSED" && (
                          <button
                            className="text-btn"
                            onClick={() =>
                              actionDialog(
                                "Reverse payment",
                                { action: "reverse", id: p.id },
                                [
                                  {
                                    name: "reason",
                                    label: "Reason for reversal",
                                    required: true,
                                    type: "textarea",
                                  },
                                ],
                                "The original record remains in the audit trail. Reversing a verified entry removes its effect from current balances.",
                              )
                            }
                          >
                            Reverse
                          </button>
                        )}
                      </div>
                      <DocumentLinks
                        docs={data.documents.filter(
                          (d) =>
                            d.entityType === "payment" && d.entityId === p.id,
                        )}
                      />
                    </td>
                  </>
                )}
                empty={
                  <Empty
                    title="No payments to show"
                    description="Record a business payment, then verify it against the actual transaction."
                  />
                }
              />
            </>
          )}
          {page === "Documents" && (
            <>
              <Toolbar
                query={query}
                setQuery={setQuery}
                placeholder="Search file names or document types…"
              >
                <span className="helper">
                  PDF, PNG, JPEG, WebP · max 10 MB · private downloads
                </span>
              </Toolbar>
              <div className="documents-grid">
                {data.documents.filter(matches).map((doc) => (
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href={"/api/documents/" + doc.id + "?view=1"}
                    className="card document-card"
                    key={doc.id}
                  >
                    <span className="file-icon">
                      <FileText size={28} strokeWidth={1.4} />
                    </span>
                    <Badge value={doc.category} />
                    <h3>{doc.name}</h3>
                    <p>
                      {doc.entityType} ·{" "}
                      {doc.entityType === "vehicle"
                        ? data.vehicles.find((v) => v.id === doc.entityId)
                            ?.code || "Archived vehicle"
                        : doc.entityType === "sale"
                          ? data.sales.find((s) => s.id === doc.entityId)
                              ?.reference
                          : doc.entityType === "bill"
                            ? data.bills.find((b) => b.id === doc.entityId)
                                ?.reference
                            : doc.entityType === "payment"
                              ? data.payments.find((p) => p.id === doc.entityId)
                                  ?.reference
                              : data.parties.find((p) => p.id === doc.entityId)
                                  ?.name}
                    </p>
                    <div>
                      <span>
                        {(doc.size / 1024).toFixed(0)} KB ·{" "}
                        {dubaiDate(doc.createdAt)}
                      </span>
                      <Download size={16} />
                    </div>
                  </a>
                ))}
              </div>
              {!data.documents.filter(matches).length && (
                <Empty
                  title="A home for your documents"
                  description="Upload vehicle photos, supplier bills, receipts, and externally created Canva quotations and invoices."
                  action={
                    <button
                      className="btn"
                      onClick={() =>
                        setDialog({
                          title: "Upload a private document",
                          module: "document",
                          fields: [],
                        })
                      }
                    >
                      Upload document
                    </button>
                  }
                />
              )}
            </>
          )}
          {page === "Reports" && (
            <>
              <div className="basis-note report-note">
                <CircleHelp size={18} />
                <span>
                  <strong>Management reports, not formal tax accounts.</strong>{" "}
                  Profit uses accrual-style confirmed costs; cash uses verified
                  recorded movements. All figures are AED. Foreign-currency
                  bills require a manually confirmed AED equivalent.{" "}
                  {data.settings.vatNote}
                </span>
              </div>
              <div className="report-tabs">
                {[
                  { id: "vehicles", label: "Vehicle profitability" },
                  { id: "comparison", label: "Sales types" },
                  { id: "monthly", label: "Monthly activity" },
                  { id: "suppliers", label: "Supplier balances" },
                  { id: "customers", label: "Customer balances" },
                  { id: "payments", label: "Cash movements" },
                ].map((t) => (
                  <button
                    className={reportTab === t.id ? "active" : ""}
                    key={t.id}
                    onClick={() => setReportTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="section-heading">
                <h2>
                  {reportTab === "payments"
                    ? "Cash basis · verified only"
                    : "Accrual-style · confirmed records"}
                </h2>
                <a
                  className="btn"
                  href={
                    "/api/export?type=" +
                    (reportTab === "payments" ? "cash" : reportTab)
                  }
                >
                  <Download size={15} />
                  Export CSV
                </a>
              </div>
              {reportTab === "vehicles" && (
                <DataTable
                  columns={[
                    "Vehicle",
                    "Status",
                    "Sale type",
                    "Confirmed costs",
                    "Agreed net price",
                    "Margin",
                    "Basis",
                  ]}
                  rows={r.vehicles}
                  render={(v) => (
                    <>
                      <td>
                        <strong>{v.code}</strong>
                        <small>
                          {v.make} {v.model}
                        </small>
                      </td>
                      <td>
                        <Badge value={v.status} />
                      </td>
                      <td>{v.saleType ? human(v.saleType) : "—"}</td>
                      <td className="money">{money(v.cost)}</td>
                      <td className="money">{money(v.agreedAmount)}</td>
                      <td className="money">{money(v.margin)}</td>
                      <td>{v.saleId ? v.marginType : "No sale agreed"}</td>
                    </>
                  )}
                />
              )}
              {reportTab === "comparison" && (
                <DataTable
                  columns={[
                    "Sale type",
                    "Sold vehicles",
                    "Revenue",
                    "Direct costs",
                    "Gross margin",
                  ]}
                  rows={r.comparison}
                  render={(c) => (
                    <>
                      <td>{human(c.type)}</td>
                      <td>{c.count}</td>
                      <td className="money">{money(c.revenue)}</td>
                      <td className="money">{money(c.cost)}</td>
                      <td className="money">{money(c.margin)}</td>
                    </>
                  )}
                />
              )}
              {reportTab === "monthly" && (
                <DataTable
                  columns={[
                    "Month · Dubai",
                    "Revenue",
                    "Cost of sales",
                    "Business expenses",
                    "Cash in",
                    "Cash out",
                  ]}
                  rows={r.monthly}
                  render={(m) => (
                    <>
                      <td>{m.month}</td>
                      <td className="money">{money(m.revenue)}</td>
                      <td className="money">{money(m.directCosts)}</td>
                      <td className="money">{money(m.expenses)}</td>
                      <td className="money">{money(m.cashIn)}</td>
                      <td className="money">{money(m.cashOut)}</td>
                    </>
                  )}
                />
              )}
              {reportTab === "suppliers" && (
                <DataTable
                  columns={[
                    "Supplier",
                    "Group",
                    "Payable",
                    "Current",
                    "1–30 days",
                    "31–60 days",
                    "61+ days",
                  ]}
                  rows={r.suppliers}
                  render={(p) => (
                    <>
                      <td>{p.name}</td>
                      <td>{human(p.group)}</td>
                      <td className="money">{money(p.balance)}</td>
                      {p.aging.map((v, i) => (
                        <td className="money" key={i}>
                          {money(v)}
                        </td>
                      ))}
                    </>
                  )}
                />
              )}
              {reportTab === "customers" && (
                <DataTable
                  columns={[
                    "Customer",
                    "Agreed",
                    "Verified net receipts",
                    "Receivable / (refund due)",
                  ]}
                  rows={r.customers}
                  render={(p) => (
                    <>
                      <td>{p.name}</td>
                      <td className="money">{money(p.agreed)}</td>
                      <td className="money">{money(p.received)}</td>
                      <td className="money">{money(p.balance)}</td>
                    </>
                  )}
                />
              )}
              {reportTab === "payments" && (
                <DataTable
                  columns={[
                    "Date",
                    "Reference",
                    "Kind",
                    "Amount",
                    "Account",
                    "Reconciliation",
                  ]}
                  rows={data.payments.filter((p) => p.status === "VERIFIED")}
                  render={(p) => (
                    <>
                      <td>{dubaiDate(p.date)}</td>
                      <td>{p.reference}</td>
                      <td>{human(p.kind)}</td>
                      <td className="money">{money(p.amount)}</td>
                      <td>{human(p.account)}</td>
                      <td>{human(p.reconciliation)}</td>
                    </>
                  )}
                />
              )}
              <p className="helper report-caption">
                Monthly revenue recognizes sales on the sold date. Later credits
                and late direct bills affect the month they are recorded. Cash
                movements include owner contributions and withdrawals; profit
                excludes them.
              </p>
            </>
          )}
          {page === "Settings" && (
            <>
              <div className="settings-grid">
                <section className="card detail-card">
                  <h2>Business defaults</h2>
                  <dl>
                    <div>
                      <dt>Currency</dt>
                      <dd>AED · integer fils</dd>
                    </div>
                    <div>
                      <dt>Timezone</dt>
                      <dd>Asia/Dubai</dd>
                    </div>
                    <div>
                      <dt>Shipping / import estimate</dt>
                      <dd>{money(data.settings.shippingEstimate)}</dd>
                    </div>
                    <div>
                      <dt>VAT policy</dt>
                      <dd>{data.settings.vatNote}</dd>
                    </div>
                    <div>
                      <dt>Payment plans</dt>
                      <dd>
                        {(data.settings.plans as unknown as { name: string }[])
                          .map((p) => p.name)
                          .join(" · ")}
                      </dd>
                    </div>
                    <div>
                      <dt>Environment</dt>
                      <dd>
                        {data.settings.demo
                          ? "Fictional demo database"
                          : "Business records"}
                      </dd>
                    </div>
                  </dl>
                  <button
                    className="btn"
                    onClick={() =>
                      setDialog({
                        title: "Edit business defaults",
                        subtitle:
                          "Defaults affect new records only. VAT note is informational; no tax is calculated.",
                        module: "settings",
                        initial: {
                          shippingEstimate: decimal(
                            BigInt(data.settings.shippingEstimate),
                          ),
                          vatNote: data.settings.vatNote,
                          categories: (
                            data.settings.categories as string[]
                          ).join(", "),
                          plans: JSON.stringify(data.settings.plans, null, 2),
                        },
                        fields: [
                          {
                            name: "shippingEstimate",
                            label: "Default shipping estimate (AED)",
                            required: true,
                          },
                          {
                            name: "vatNote",
                            label: "VAT registration / treatment note",
                            type: "textarea",
                            full: true,
                          },
                          {
                            name: "categories",
                            label: "Expense categories (comma separated)",
                            type: "textarea",
                            full: true,
                            required: true,
                          },
                          {
                            name: "plans",
                            label: "Payment plans (JSON)",
                            type: "textarea",
                            full: true,
                            required: true,
                            hint: 'Example: [{"name":"60 / 40","weights":[60,40]}]',
                          },
                        ],
                      })
                    }
                  >
                    Edit defaults
                  </button>
                </section>
                <section className="card detail-card">
                  <h2>Onboarding & access</h2>
                  <p className="helper">
                    The nine known UAE vehicles are not prefilled. Import only
                    confirmed identities and dates. Create the two genuine sale
                    agreements separately after import.
                  </p>
                  <button
                    className="btn"
                    onClick={() => {
                      setImportOpen(true);
                      setImportPreview(null);
                    }}
                  >
                    Open safe vehicle import <ArrowRight size={15} />
                  </button>
                  <h3 className="subheading">Administrator only</h3>
                  <p className="helper">
                    Server-side authorization protects every data route. Future
                    employee roles are reserved and denied access until their
                    permissions are implemented.
                  </p>
                  <h3 className="subheading">Demo isolation</h3>
                  <p className="helper">
                    Demo seeding requires an empty, separate database and
                    DEMO_MODE=true. There is no destructive “reset” button. Use
                    a new database for real records.
                  </p>
                  <a className="btn" href="/api/export?type=audit">
                    <Download size={15} />
                    Export recent audit log
                  </a>
                </section>
              </div>
              <section className="card audit-card">
                <div className="card-heading">
                  <div>
                    <h2>Recent audit trail</h2>
                    <p>
                      Last 100 events · posted records retain their history.
                    </p>
                  </div>
                </div>
                <DataTable
                  columns={["Time · Dubai", "Action", "Record", "Actor"]}
                  rows={data.audits}
                  render={(a) => (
                    <>
                      <td>
                        {new Intl.DateTimeFormat("en-GB", {
                          timeZone: "Asia/Dubai",
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(a.createdAt))}
                      </td>
                      <td>{a.action}</td>
                      <td className="mono">{a.entityId}</td>
                      <td className="mono">{a.actorId}</td>
                    </>
                  )}
                />
              </section>
            </>
          )}
          <footer className="main-footer">
            <span>
              KEITORA PROJECTS <span>·</span> BUILT FOR THE JOURNEY
            </span>
            <span>
              <ShieldCheck size={12} />
              Private workspace <span>·</span> Asia/Dubai
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-bottom">
        {[
          { page: "Overview" as Page, icon: LayoutDashboard },
          { page: "Inventory" as Page, icon: Truck },
          { page: "Payments" as Page, icon: Wallet },
          { page: "More" as const, icon: Menu },
        ].map(({ page: p, icon: Icon }) => (
          <button
            className={page === p ? "active" : ""}
            key={p}
            onClick={() => (p === "More" ? setMobile(true) : go(p))}
          >
            <Icon size={19} />
            <span>{p}</span>
          </button>
        ))}
      </nav>
      {dialog && (
        <Modal
          title={dialog.title}
          onClose={() => {
            if (!busy) {
              setDialog(null);
              setError("");
            }
          }}
        >
          {dialog.module === "document" ? (
            <UploadForm
              data={data}
              busy={busy}
              error={error}
              onSubmit={async (f) => {
                setBusy(true);
                setError("");
                try {
                  await request("/api/documents", f);
                  setDialog(null);
                  await load();
                  setToast("Document stored privately.");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Upload failed.");
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save(e.currentTarget);
              }}
            >
              <p className="modal-subtitle">{dialog.subtitle}</p>
              <div className="form-grid">
                {dialog.fields.map((field) => (
                  <label
                    className={"form-field " + (field.full ? "full" : "")}
                    key={field.name}
                  >
                    <span>
                      {field.label}
                      {field.required && <span className="required"> *</span>}
                    </span>
                    {field.options ? (
                      <select
                        name={field.name}
                        required={field.required}
                        defaultValue={String(
                          dialog.initial?.[field.name] ??
                            field.value ??
                            field.options[0]?.value ??
                            "",
                        )}
                      >
                        {field.required && !field.options.length && (
                          <option value="">Add a linked record first</option>
                        )}
                        {field.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        name={field.name}
                        required={field.required}
                        rows={3}
                        maxLength={4000}
                        defaultValue={String(
                          dialog.initial?.[field.name] ?? field.value ?? "",
                        )}
                      />
                    ) : (
                      <input
                        list={
                          field.name === "weights"
                            ? "saved-payment-plans"
                            : undefined
                        }
                        name={field.name}
                        type={field.type || "text"}
                        required={field.required}
                        maxLength={field.type === "number" ? undefined : 4000}
                        autoComplete="off"
                        defaultValue={String(
                          dialog.initial?.[field.name] ?? field.value ?? "",
                        )}
                      />
                    )}{" "}
                    {field.hint && <small>{field.hint}</small>}
                  </label>
                ))}
              </div>
              {dialog.module === "sales" && (
                <datalist id="saved-payment-plans">
                  {(
                    data.settings.plans as unknown as {
                      name: string;
                      weights: number[];
                    }[]
                  ).map((p) => (
                    <option key={p.name} value={p.weights.join(",")}>
                      {p.name}
                    </option>
                  ))}
                </datalist>
              )}
              {error && (
                <div className="alert" role="alert">
                  {error}
                </div>
              )}
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => {
                    setDialog(null);
                    setError("");
                  }}
                >
                  Cancel
                </button>
                <button className="btn primary" disabled={busy}>
                  {busy
                    ? "Saving…"
                    : dialog.module === "actions"
                      ? "Confirm action"
                      : "Save record"}
                  <Check size={15} />
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
      {importOpen && (
        <Modal
          title="Import confirmed vehicle details"
          onClose={() => setImportOpen(false)}
        >
          <p className="modal-subtitle">
            Preview first; confirmation imports all rows in one transaction. No
            financial amounts or sales are created. Duplicate IDs and chassis
            are rejected.
          </p>
          <p className="helper">
            Use the template in <code>examples/vehicle-import.json</code>. For
            sold vehicles, import the actual identity as UAE Inventory, then
            create the genuine customer agreement and mark sold.
          </p>
          <label className="form-field">
            <span>Vehicle JSON</span>
            <textarea
              rows={12}
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportPreview(null);
              }}
              spellCheck={false}
            />
          </label>
          {importError && (
            <div className="alert" role="alert">
              {importError}
            </div>
          )}
          {importPreview && (
            <div className="import-preview">
              <strong>{importPreview.length} vehicles validated</strong>
              {importPreview.map((v, i) => (
                <div key={i}>
                  {String(v.code)} · {String(v.make)} {String(v.model)} ·{" "}
                  {human(String(v.status))}
                </div>
              ))}
            </div>
          )}
          <div className="modal-footer">
            <button className="btn" onClick={() => setImportOpen(false)}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setImportError("");
                try {
                  const response = await request("/api/import", {
                    data: JSON.parse(importText),
                    confirm: Boolean(importPreview),
                  });
                  if (response.imported) {
                    setImportOpen(false);
                    await load();
                    setToast(
                      "Vehicle details imported. No financial postings created.",
                    );
                  } else setImportPreview(response.preview);
                } catch (e) {
                  setImportError(
                    e instanceof Error ? e.message : "Import failed.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy
                ? "Validating…"
                : importPreview
                  ? "Confirm import"
                  : "Preview import"}
              <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={15} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}
function Toolbar({
  query,
  setQuery,
  placeholder,
  children,
}: {
  query: string;
  setQuery: (s: string) => void;
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <div className="toolbar">
      <label className="search-box">
        <Search size={17} />
        <input
          aria-label={placeholder}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            className="icon-btn"
            aria-label="Clear search"
            onClick={() => setQuery("")}
          >
            <X size={14} />
          </button>
        )}
      </label>
      <div className="toolbar-controls">{children}</div>
    </div>
  );
}
function DataTable<T>({
  columns,
  rows,
  render,
  empty,
}: {
  columns: string[];
  rows: T[];
  render: (r: T) => ReactNode;
  empty?: ReactNode;
}) {
  return rows.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{render(r)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    empty || (
      <Empty
        title="No records to show"
        description="Recorded activity will appear here."
      />
    )
  );
}
function DocumentLinks({ docs }: { docs: Data["documents"] }) {
  return docs.length ? (
    <div className="document-links">
      {docs.map((d) => (
        <a
          key={d.id}
          target="_blank"
          rel="noopener noreferrer"
          href={"/api/documents/" + d.id + "?view=1"}
        >
          <FileText size={13} />
          {d.name}
          <Download size={12} />
        </a>
      ))}
    </div>
  ) : null;
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            type="button"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
function UploadForm({
  data,
  busy,
  error,
  onSubmit,
}: {
  data: Data;
  busy: boolean;
  error: string;
  onSubmit: (f: FormData) => void;
}) {
  const [type, setType] = useState("vehicle");
  const lists: Record<string, Option[]> = {
    vehicle: data.vehicles.map((v) => ({ value: v.id, label: v.code })),
    bill: data.bills.map((b) => ({ value: b.id, label: b.reference })),
    sale: data.sales.map((s) => ({ value: s.id, label: s.reference })),
    payment: data.payments.map((p) => ({ value: p.id, label: p.reference })),
    party: data.parties.map((p) => ({ value: p.id, label: p.name })),
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <p className="modal-subtitle">
        Files are stored outside the public web root and require administrator
        authentication to download. Canva documents can be uploaded as PDFs.
      </p>
      <div className="form-grid">
        <label className="form-field">
          <span>Link to</span>
          <select
            name="entityType"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {opt(["vehicle", "bill", "sale", "payment", "party"]).map((o) => (
              <option value={o.value} key={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Record *</span>
          <select name="entityId" required key={type}>
            {!lists[type].length && (
              <option value="">Add a record first</option>
            )}
            {lists[type].map((o) => (
              <option value={o.value} key={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field full">
          <span>Document category</span>
          <select name="category">
            {opt([
              "VEHICLE_PHOTO",
              "RECEIPT",
              "SUPPLIER_BILL",
              "QUOTATION",
              "INVOICE",
              "OTHER",
            ]).map((o) => (
              <option value={o.value} key={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field full file-input">
          <FolderOpen size={26} />
          <strong>Choose a document</strong>
          <span>PDF, PNG, JPEG or WebP · max 10 MB</span>
          <input
            name="file"
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            required
          />
        </label>
      </div>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <div className="modal-footer">
        <button className="btn primary" disabled={busy}>
          {busy ? "Uploading…" : "Upload privately"}
          <ShieldCheck size={16} />
        </button>
      </div>
    </form>
  );
}
function Login({
  onLogin,
  initialError,
}: {
  onLogin: () => Promise<void>;
  initialError: string;
}) {
  const [error, setError] = useState(initialError),
    [busy, setBusy] = useState(false);
  return (
    <div className="login-page">
      <div className="login-intro">
        <Brand />
        <div>
          <span className="eyebrow">THE BUSINESS BEHIND THE BUILD.</span>
          <h1>
            Small vehicles.
            <br />A clearer picture.
          </h1>
          <p>
            A private home for your inventory, relationships,
            <br />
            and the numbers that keep Keitora moving.
          </p>
        </div>
        <div className="login-footer">
          KEITORA PROJECTS <span>·</span> UAE & JAPAN <span>·</span> SINCE 2024
        </div>
      </div>
      <div className="login-form-wrap">
        <form
          className="login-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              await request("/api/auth", Object.fromEntries(f));
              await onLogin();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Sign-in failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <span className="login-lock">
            <ShieldCheck size={23} />
          </span>
          <h2>Welcome to your hub.</h2>
          <p>Sign in to your private workspace.</p>
          <label className="form-field">
            <span>Email address</span>
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="you@your-business.com"
            />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Enter your password"
            />
          </label>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <button className="btn primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
            <ArrowRight size={16} />
          </button>
          <p className="login-helper">
            Administrator access only. Set up your account locally using the
            secure account setup command in the README.
          </p>
          <div className="login-private">
            <ShieldCheck size={13} />
            Your records stay in your private workspace.
          </div>
        </form>
      </div>
    </div>
  );
}
