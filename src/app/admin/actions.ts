"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Warna tidak valid");
const optionalLength = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().int().min(500, "Minimal 500 mm").max(12000, "Maksimal 12000 mm").nullable(),
);

function fail(error: z.ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return { error: "Periksa kembali isian yang ditandai", fieldErrors };
}

// ---------- Frame ----------

const frameSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi"),
  code: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null),
  color: hex,
  barLength: optionalLength,
  faceWidth: z.coerce.number().int().min(5, "Minimal 5 mm").max(300, "Maksimal 300 mm"),
  screwGroupId: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().nullable()),
  active: z.preprocess((v) => v === "on", z.boolean()),
});

export async function saveFrame(id: number | null, _: FormState, formData: FormData): Promise<FormState> {
  await requireUser("admin");
  const parsed = frameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);

  if (id) await db.update(schema.frameProfiles).set(parsed.data).where(eq(schema.frameProfiles.id, id));
  else await db.insert(schema.frameProfiles).values(parsed.data);
  redirect("/admin/frame");
}

export async function deleteFrame(id: number) {
  await requireUser("admin");
  await db.delete(schema.frameProfiles).where(eq(schema.frameProfiles.id, id));
  refresh();
}

// ---------- Gagang ----------

const handleSchema = frameSchema.extend({
  zones: z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s);
      } catch {
        ctx.addIssue({ code: "custom", message: "Data zona tidak valid" });
        return z.NEVER;
      }
    })
    .pipe(
      z
        .array(
          z.object({
            start: z.coerce.number().min(0),
            length: z.coerce.number().min(10, "Panjang zona minimal 10 mm"),
          }),
        )
        .min(1, "Minimal 1 gagang per batang"),
    ),
  remainderFrameProfileId: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().nullable()),
});

export async function saveHandle(id: number | null, _: FormState, formData: FormData): Promise<FormState> {
  await requireUser("admin");
  const parsed = handleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);

  const data = parsed.data;
  const settings = await db.query.settings.findFirst();
  const barLength = data.barLength ?? settings?.defaultBarLength ?? 3000;
  const zones = [...data.zones].sort((a, b) => a.start - b.start);
  for (let i = 0; i < zones.length; i++) {
    if (zones[i].start + zones[i].length > barLength) {
      return {
        error: `Gagang ${i + 1} melewati ujung batang (${barLength} mm)`,
        fieldErrors: { zones: "Posisi gagang tidak valid" },
      };
    }
    if (i > 0 && zones[i].start < zones[i - 1].start + zones[i - 1].length) {
      return { error: `Gagang ${i} dan ${i + 1} bertumpuk`, fieldErrors: { zones: "Posisi gagang tidak valid" } };
    }
  }

  const values = { ...data, zones };
  if (id) await db.update(schema.handleProfiles).set(values).where(eq(schema.handleProfiles.id, id));
  else await db.insert(schema.handleProfiles).values(values);
  redirect("/admin/gagang");
}

export async function deleteHandle(id: number) {
  await requireUser("admin");
  await db.delete(schema.handleProfiles).where(eq(schema.handleProfiles.id, id));
  refresh();
}

// ---------- Kelompok skrup ----------

const qty = z.coerce.number().int().min(0, "Tidak boleh negatif").max(100, "Maksimal 100");
const screwGroupSchema = z
  .object({
    name: z.string().trim().min(1, "Nama wajib diisi"),
    cornerType: z.string().trim(),
    cornerQty: qty,
    jointType: z.string().trim(),
    jointQty: qty,
  })
  .refine((g) => g.cornerQty === 0 || g.cornerType, { path: ["cornerType"], message: "Isi jenis skrup" })
  .refine((g) => g.jointQty === 0 || g.jointType, { path: ["jointType"], message: "Isi jenis skrup" });

export async function saveScrewGroup(id: number | null, _: FormState, formData: FormData): Promise<FormState> {
  await requireUser("admin");
  const parsed = screwGroupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  if (id) await db.update(schema.screwGroups).set(parsed.data).where(eq(schema.screwGroups.id, id));
  else await db.insert(schema.screwGroups).values(parsed.data);
  refresh();
  return { ok: true };
}

export async function deleteScrewGroup(id: number) {
  await requireUser("admin");
  await db.delete(schema.screwGroups).where(eq(schema.screwGroups.id, id));
  refresh();
}

// ---------- Engsel ----------

const hingeTypeSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi"),
  length: z.coerce.number().int().min(20, "Minimal 20 mm").max(500, "Maksimal 500 mm"),
  active: z.preprocess((v) => v === "on", z.boolean()),
});

export async function saveHingeType(id: number | null, _: FormState, formData: FormData): Promise<FormState> {
  await requireUser("admin");
  const parsed = hingeTypeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  if (id) await db.update(schema.hingeTypes).set(parsed.data).where(eq(schema.hingeTypes.id, id));
  else await db.insert(schema.hingeTypes).values(parsed.data);
  refresh();
  return { ok: true };
}

export async function deleteHingeType(id: number) {
  await requireUser("admin");
  await db.delete(schema.hingeTypes).where(eq(schema.hingeTypes.id, id));
  refresh();
}

// ---------- Pengaturan ----------

const settingsSchema = z.object({
  defaultBarLength: z.coerce.number().int().min(500, "Minimal 500 mm").max(12000, "Maksimal 12000 mm"),
  kerf: z.coerce.number().min(0, "Tidak boleh negatif").max(20, "Maksimal 20 mm"),
  endTrim: z.coerce.number().int().min(0, "Tidak boleh negatif").max(200, "Maksimal 200 mm"),
  minUsableOffcut: z.coerce.number().int().min(0, "Tidak boleh negatif").max(3000, "Maksimal 3000 mm"),
  glassInset: z.coerce.number().min(-50, "Minimal -50 mm").max(50, "Maksimal 50 mm"),
});

export async function saveSettings(_: FormState, formData: FormData): Promise<FormState> {
  await requireUser("admin");
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  await db
    .insert(schema.settings)
    .values({ id: 1, ...parsed.data })
    .onConflictDoUpdate({ target: schema.settings.id, set: parsed.data });
  refresh();
  return { ok: true };
}

// ---------- Pengguna ----------

const userSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,32}$/, "3–32 karakter: huruf kecil, angka, titik, strip"),
  password: z.string().min(6, "Minimal 6 karakter"),
  role: z.enum(["admin", "field"]),
});

export async function createUser(_: FormState, formData: FormData): Promise<FormState> {
  await requireUser("admin");
  const parsed = userSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error);
  const { password, ...rest } = parsed.data;
  const exists = await db.query.users.findFirst({ where: eq(schema.users.username, rest.username) });
  if (exists) return { error: "Username sudah dipakai", fieldErrors: { username: "Sudah dipakai" } };
  await db.insert(schema.users).values({ ...rest, passwordHash: await bcrypt.hash(password, 10) });
  refresh();
  return { ok: true };
}

export async function setUserActive(id: number, active: boolean) {
  const me = await requireUser("admin");
  if (me.id === id) return;
  await db.update(schema.users).set({ active }).where(eq(schema.users.id, id));
  refresh();
}

export async function resetPassword(id: number, _: FormState, formData: FormData): Promise<FormState> {
  await requireUser("admin");
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) return { error: "Minimal 6 karakter" };
  await db
    .update(schema.users)
    .set({ passwordHash: await bcrypt.hash(password, 10) })
    .where(eq(schema.users.id, id));
  return { ok: true };
}
