import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hash } from "bcryptjs";
import { db } from "../src/lib/db";
async function secret(prompt: string) {
  if (!stdin.isTTY)
    throw new Error("Use an interactive terminal for secure password entry.");
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  let value = "";
  return new Promise<string>((resolve, reject) => {
    const handler = (chunk: Buffer) => {
      for (const char of chunk.toString()) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", handler);
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", handler);
          reject(new Error("Cancelled."));
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (char >= " ") value += char;
      }
    };
    stdin.on("data", handler);
  });
}
async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  const email = (await rl.question("Administrator email: "))
    .trim()
    .toLowerCase();
  rl.close();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Enter a valid email.");
  const existing = await db.user.findUnique({ where: { email } });
  if (existing && !process.argv.includes("--reset-password"))
    throw new Error(
      "Account exists. Use --reset-password to explicitly rotate it.",
    );
  if (!existing && (await db.user.count()))
    throw new Error("Only one initial administrator is supported.");
  const password = await secret(
    "Password (minimum 14 characters, input hidden): ",
  );
  if (password.length < 14 || password.length > 200)
    throw new Error("Password must be 14–200 characters.");
  if (password !== (await secret("Confirm password: ")))
    throw new Error("Passwords do not match.");
  const passwordHash = await hash(password, 12);
  await db.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({ where: { email }, data: { passwordHash } })
      : await tx.user.create({ data: { email, passwordHash } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.audit.create({
      data: {
        actorId: user.id,
        action: existing ? "admin.password_rotate" : "admin.bootstrap",
        entityId: user.id,
        data: { email },
      },
    });
  });
  console.log("Administrator account ready. Existing sessions revoked.");
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
