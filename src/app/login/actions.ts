"use server";

import bcrypt from "bcryptjs";
import { and, asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { ENTRY_PATH, LOGIN_ENABLED } from "@/lib/auth-mode";
import { encryptSession, homeFor, SESSION_COOKIE, sessionCookieOptions, type Role } from "@/lib/session";

export type LoginState = { error?: string } | undefined;

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Isi username dan password" };

  const user = await db.query.users.findFirst({ where: eq(schema.users.username, username) });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Username atau password salah" };
  }

  const token = await encryptSession({ userId: user.id, role: user.role, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect(homeFor(user.role));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect(ENTRY_PATH);
}

/**
 * Masuk tanpa password sebagai peran yang dipilih (hanya saat login nonaktif).
 * Memakai akun aktif pertama dengan peran itu; jika belum ada, dibuat akun bawaan.
 */
export async function enterAs(role: Role) {
  if (LOGIN_ENABLED) redirect("/login");
  let user = await db.query.users.findFirst({
    where: and(eq(schema.users.role, role), eq(schema.users.active, true)),
    orderBy: asc(schema.users.id),
  });
  if (!user) {
    [user] = await db
      .insert(schema.users)
      .values({
        name: role === "admin" ? "Admin" : "Tim Lapangan",
        username: `${role === "admin" ? "admin" : "lapangan"}-${Date.now()}`,
        passwordHash: await bcrypt.hash(crypto.randomUUID(), 10),
        role,
      })
      .returning();
  }
  const token = await encryptSession({ userId: user.id, role: user.role, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  redirect(homeFor(role));
}
