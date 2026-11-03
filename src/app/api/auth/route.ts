import { readJson } from "@/lib/http";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkOrigin, createSession, digest, HttpError } from "@/lib/auth";
export const runtime = "nodejs";
const dummy = hash("not-a-real-password-random-placeholder", 12);
export async function POST(req: NextRequest) {
  try {
    await checkOrigin();
    const { email, password } = z
      .object({
        email: z
          .email()
          .max(200)
          .transform((s) => s.toLowerCase()),
        password: z.string().min(1).max(200),
      })
      .parse(await readJson(req));
    const key = digest(email);
    const previous = await db.loginAttempt.findUnique({ where: { id: key } });
    if (previous?.lockedUntil && previous.lockedUntil > new Date())
      return NextResponse.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429 },
      );
    if (previous && Date.now() - previous.updatedAt.getTime() > 15 * 60 * 1000)
      await db.loginAttempt.deleteMany({
        where: { id: key, updatedAt: previous.updatedAt },
      });
    const attempt = await db.loginAttempt.upsert({
      where: { id: key },
      create: { id: key, count: 1 },
      update: { count: { increment: 1 } },
    });
    if (attempt.count >= 5)
      await db.loginAttempt.update({
        where: { id: key },
        data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
      });
    if (attempt.count > 5)
      return NextResponse.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429 },
      );
    const user = await db.user.findUnique({ where: { email } });
    const valid = await compare(password, user?.passwordHash || (await dummy));
    if (!user || !valid || user.role !== "ADMIN")
      return NextResponse.json(
        { error: "Email or password is incorrect." },
        { status: 401 },
      );
    await db.loginAttempt.deleteMany({ where: { id: key } });
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof HttpError
            ? e.message
            : "Unable to sign in. Check your details and database connection.",
      },
      { status: e instanceof HttpError ? e.status : 400 },
    );
  }
}
export async function DELETE() {
  try {
    await checkOrigin();
    const jar = await cookies();
    const token = jar.get("keitora_session")?.value;
    if (token) await db.session.deleteMany({ where: { id: digest(token) } });
    jar.delete("keitora_session");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to sign out." }, { status: 400 });
  }
}
