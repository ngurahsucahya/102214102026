"use server";

import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getCalcCatalog } from "@/lib/data";
import { calculate, calculateBulk, CalcError } from "@/lib/engine";

const specSchema = z.object({
  doorType: z.enum(["swing", "slider"]),
  width: z.number().positive().max(10000),
  height: z.number().positive().max(10000),
  frameProfileId: z.number().int(),
  handleProfileId: z.number().int(),
  handleSide: z.enum(["left", "right", "both"]),
  handleHeight: z.number().min(0),
  hDividers: z.array(z.number()).max(10),
  vDividers: z.array(z.number()).max(10),
  hingeTypeId: z.number().int().nullable(),
  hinges: z.array(z.number()).max(10),
  sealMaterialId: z.number().int().nullable().default(null),
  cornerMaterialId: z.number().int().nullable().default(null),
  pinMaterialId: z.number().int().nullable().default(null),
});

export type SaveResult = { ok: true; id: number } | { ok: false; error: string };

/** Hitung ulang di server (jangan percaya hasil dari browser), lalu simpan ke riwayat. */
export async function saveCalculation(rawSpec: unknown, label: string): Promise<SaveResult> {
  const user = await requireUser();
  const parsed = specSchema.safeParse(rawSpec);
  if (!parsed.success) return { ok: false, error: "Data pintu tidak valid" };

  const catalog = await getCalcCatalog();
  try {
    const result = calculate(
      parsed.data,
      catalog.frames,
      catalog.handles,
      catalog.settings,
      catalog.hingeTypes,
      catalog.materials,
    );
    const [row] = await db
      .insert(schema.calculations)
      .values({
        userId: user.id,
        label: label.trim().slice(0, 80) || null,
        spec: parsed.data,
        result,
        frame: catalog.frames.find((f) => f.id === parsed.data.frameProfileId),
        handle: catalog.handles.find((h) => h.id === parsed.data.handleProfileId),
        totalBars: result.stats.totalNewBars,
        score: result.stats.zeroWasteScore,
      })
      .returning({ id: schema.calculations.id });
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof CalcError ? e.message : "Gagal menghitung" };
  }
}

const bulkSchema = z
  .array(z.object({ spec: specSchema, qty: z.number().int().min(1).max(100), label: z.string().max(80) }))
  .min(1)
  .max(30);

/** Simpan bulk: dihitung ulang di server dari daftar pintunya. */
export async function saveBulk(rawItems: unknown, label: string): Promise<SaveResult> {
  const user = await requireUser();
  const parsed = bulkSchema.safeParse(rawItems);
  if (!parsed.success) return { ok: false, error: "Data bulk tidak valid" };

  const catalog = await getCalcCatalog();
  try {
    const result = calculateBulk(
      parsed.data,
      catalog.frames,
      catalog.handles,
      catalog.settings,
      catalog.hingeTypes,
      catalog.materials,
    );
    const [row] = await db
      .insert(schema.bulkCalculations)
      .values({
        userId: user.id,
        label: label.trim().slice(0, 80) || null,
        items: parsed.data,
        result,
        profiles: {
          frames: catalog.frames.filter((f) => parsed.data.some((it) => it.spec.frameProfileId === f.id)),
          handles: catalog.handles.filter((h) => parsed.data.some((it) => it.spec.handleProfileId === h.id)),
        },
        totalBars: result.stats.totalNewBars,
        separateBars: result.separateBars,
        score: result.stats.zeroWasteScore,
      })
      .returning({ id: schema.bulkCalculations.id });
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof CalcError ? e.message : "Gagal menghitung" };
  }
}
