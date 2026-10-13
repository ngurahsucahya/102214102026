"use server";

import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getCalcCatalog } from "@/lib/data";
import { calculate, CalcError } from "@/lib/engine";

const specSchema = z.object({
  width: z.number().positive().max(10000),
  height: z.number().positive().max(10000),
  frameProfileId: z.number().int(),
  handleProfileId: z.number().int(),
  handleSide: z.enum(["left", "right"]),
  handleHeight: z.number().min(0),
  hDividers: z.array(z.number()).max(10),
  vDividers: z.array(z.number()).max(10),
});

export type SaveResult = { ok: true; id: number } | { ok: false; error: string };

/** Hitung ulang di server (jangan percaya hasil dari browser), lalu simpan ke riwayat. */
export async function saveCalculation(rawSpec: unknown, label: string): Promise<SaveResult> {
  const user = await requireUser();
  const parsed = specSchema.safeParse(rawSpec);
  if (!parsed.success) return { ok: false, error: "Data pintu tidak valid" };

  const catalog = await getCalcCatalog();
  try {
    const result = calculate(parsed.data, catalog.frames, catalog.handles, catalog.settings);
    const [row] = await db
      .insert(schema.calculations)
      .values({
        userId: user.id,
        label: label.trim().slice(0, 80) || null,
        spec: parsed.data,
        result,
        totalBars: result.stats.totalNewBars,
        score: result.stats.zeroWasteScore,
      })
      .returning({ id: schema.calculations.id });
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof CalcError ? e.message : "Gagal menghitung" };
  }
}
