import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type {
  CalcSettings,
  FrameProfile,
  HandleProfile,
  HingeType,
  Material,
  MaterialCategory,
  ScrewGroup,
} from "@/lib/engine/types";

export async function getSettings() {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.id, 1) });
  if (row) return row;
  const [created] = await db.insert(schema.settings).values({ id: 1 }).returning();
  return created;
}

export const listFrames = () => db.select().from(schema.frameProfiles).orderBy(asc(schema.frameProfiles.name));
export const listHandles = () => db.select().from(schema.handleProfiles).orderBy(asc(schema.handleProfiles.name));
export const listHingeTypes = () => db.select().from(schema.hingeTypes).orderBy(asc(schema.hingeTypes.name));
export const listMaterials = () =>
  db.select().from(schema.materials).orderBy(asc(schema.materials.category), asc(schema.materials.name));
/** Material aktif per kategori untuk pilihan di form admin (yang sedang terhubung tetap ikut). */
export async function listMaterialOptions(category: MaterialCategory, keepId?: number | null) {
  const rows = await db
    .select({ id: schema.materials.id, name: schema.materials.name, active: schema.materials.active })
    .from(schema.materials)
    .where(eq(schema.materials.category, category))
    .orderBy(asc(schema.materials.name));
  return rows.filter((m) => m.active || m.id === keepId).map(({ id, name }) => ({ id, name }));
}
export const listScrewGroups = () => db.select().from(schema.screwGroups).orderBy(asc(schema.screwGroups.name));

export type CalcCatalog = {
  settings: CalcSettings & { defaultBarLength: number };
  frames: FrameProfile[];
  handles: (HandleProfile & { code: string | null })[];
  hingeTypes: HingeType[];
  /** Katalog material untuk komponen pintu dan BOM. */
  materials: Material[];
};

/**
 * Data master dalam bentuk yang dipakai engine, panjang batang sudah final.
 * Bawaan hanya yang aktif; `includeInactive` untuk menampilkan riwayat lama.
 */
export async function getCalcCatalog({ includeInactive = false } = {}): Promise<CalcCatalog> {
  const [s, frames, handles, groups, hinges, materialRows] = await Promise.all([
    getSettings(),
    listFrames(),
    listHandles(),
    listScrewGroups(),
    listHingeTypes(),
    listMaterials(),
  ]);
  const materials: Material[] = materialRows
    .filter((m) => includeInactive || m.active)
    .map((m) => ({
      id: m.id,
      sku: m.sku,
      code: m.code,
      name: m.name,
      category: m.category,
      unit: m.unit,
      minPurchase: m.minPurchase,
      price: m.price,
      usagePerPoint: m.usagePerPoint,
      glassDeduction: m.glassDeduction,
      intersectionCutback: m.intersectionCutback,
    }));
  // Glass deduction dan cutback ikut material yang terhubung, walau material itu nonaktif.
  const allById = new Map(materialRows.map((m) => [m.id, m]));
  const fromMaterial = (id: number | null) => {
    const m = id == null ? undefined : allById.get(id);
    return { materialId: id, glassDeduction: m?.glassDeduction ?? 0, intersectionCutback: m?.intersectionCutback ?? 0 };
  };
  const groupById = new Map<number, ScrewGroup>(
    groups.map((g) => [
      g.id,
      {
        id: g.id,
        name: g.name,
        cornerType: g.cornerType,
        cornerQty: g.cornerQty,
        jointType: g.jointType,
        jointQty: g.jointQty,
      },
    ]),
  );
  const screwGroup = (id: number | null) => (id == null ? null : (groupById.get(id) ?? null));
  return {
    settings: {
      kerf: s.kerf,
      endTrim: s.endTrim,
      minUsableOffcut: s.minUsableOffcut,
      glassInset: s.glassInset,
      defaultBarLength: s.defaultBarLength,
    },
    frames: frames
      .filter((f) => includeInactive || f.active)
      .map((f) => ({
        id: f.id,
        name: f.name,
        color: f.color,
        barLength: f.barLength ?? s.defaultBarLength,
        faceWidth: f.faceWidth,
        screwGroup: screwGroup(f.screwGroupId),
        ...fromMaterial(f.materialId),
      })),
    handles: handles
      .filter((h) => (includeInactive || h.active) && h.zones.length > 0)
      .map((h) => ({
        id: h.id,
        name: h.name,
        code: h.code,
        color: h.color,
        barLength: h.barLength ?? s.defaultBarLength,
        faceWidth: h.faceWidth,
        screwGroup: screwGroup(h.screwGroupId),
        zones: h.zones,
        remainderFrameProfileId: h.remainderFrameProfileId,
        materialId: h.materialId,
        glassDeduction: fromMaterial(h.materialId).glassDeduction,
      })),
    hingeTypes: hinges
      .filter((h) => includeInactive || h.active)
      .map((h) => ({ id: h.id, name: h.name, length: h.length, materialId: h.materialId })),
    materials,
  };
}
