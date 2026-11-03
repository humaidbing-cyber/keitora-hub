import { cookies, headers } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { db } from "./db";
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function requireAdmin() {
  const token = (await cookies()).get("keitora_session")?.value;
  if (!token) throw new HttpError(401, "Please sign in.");
  const session = await db.session.findUnique({
    where: { id: digest(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date())
    throw new HttpError(401, "Your session has expired.");
  if (session.user.role !== "ADMIN")
    throw new HttpError(403, "Administrator access required.");
  return session.user;
}
export async function checkOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  const expected = process.env.APP_ORIGIN;
  if (!expected) throw new HttpError(503, "APP_ORIGIN must be configured.");
  if (!origin || new URL(origin).origin !== new URL(expected).origin)
    throw new HttpError(403, "Request origin was rejected.");
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await db.session.create({ data: { id: digest(token), userId, expiresAt } });
  if (
    process.env.NODE_ENV === "production" &&
    process.env.COOKIE_SECURE !== "true"
  )
    throw new HttpError(
      503,
      "Production requires COOKIE_SECURE=true and HTTPS.",
    );
  (await cookies()).set("keitora_session", token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}
