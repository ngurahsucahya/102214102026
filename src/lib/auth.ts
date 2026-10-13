import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/db";
import { decryptSession, SESSION_COOKIE, type Role } from "./session";

/** User yang sedang login, dicek ulang ke database (bukan hanya dari cookie). */
export const getCurrentUser = cache(async () => {
  const session = await decryptSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, session.userId) });
  if (!user || !user.active) return null;
  return { id: user.id, name: user.name, username: user.username, role: user.role };
});

export async function requireUser(role?: Role) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) redirect(user.role === "admin" ? "/admin" : "/lapangan");
  return user;
}
