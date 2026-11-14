import "dotenv/config";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../src/db";
import { extraMaterials, murovaMaterials, murovaQuotationMaterials } from "./seed-data/materials";

/** Batang & engsel contoh → material katalog (dihubungkan hanya kalau belum terhubung). */
const PROFILE_MATERIAL: Record<string, string> = {
  "FR-4S": "DMY-PRF-FR4S",
  "FR-4H": "DMY-PRF-FR4H",
  "FR-SC": "DMY-PRF-FRSC",
  "GG-1S": "DMY-PRF-GG1S",
  "GG-2H": "DMY-PRF-GG2H",
};
const HINGE_MATERIAL: Record<string, string> = {
  'Engsel 4" Stainless': "DMY-ENG-4SS",
  'Engsel 5" Heavy Duty': "DMY-ENG-5HD",
};

async function main() {
  await db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing();

  const hash = (p: string) => bcrypt.hashSync(p, 10);
  await db
    .insert(schema.users)
    .values([
      { name: "Admin", username: "admin", passwordHash: hash("admin123"), role: "admin" },
      { name: "Tim Lapangan", username: "lapangan", passwordHash: hash("lapangan123"), role: "field" },
    ])
    .onConflictDoNothing();

  const existing = await db.select().from(schema.frameProfiles).limit(1);
  if (!existing.length) {
    const [silver, black] = await db
      .insert(schema.frameProfiles)
      .values([
        { name: 'Frame 4" Silver', code: "FR-4S", color: "#c0c7d1", faceWidth: 40 },
        { name: 'Frame 4" Hitam', code: "FR-4H", color: "#2b2f36", faceWidth: 40 },
        { name: "Frame Slim Champagne", code: "FR-SC", color: "#d8b67a", faceWidth: 30 },
      ])
      .returning();

    await db.insert(schema.handleProfiles).values([
      {
        name: "Gagang Tanam 1 Titik (Silver)",
        code: "GG-1S",
        color: "#9aa4b1",
        faceWidth: 45,
        zones: [{ start: 1300, length: 200 }],
        remainderFrameProfileId: silver.id,
      },
      {
        name: "Gagang Tanam 2 Titik (Hitam)",
        code: "GG-2H",
        color: "#14161a",
        faceWidth: 45,
        zones: [
          { start: 900, length: 200 },
          { start: 2100, length: 200 },
        ],
        remainderFrameProfileId: black.id,
      },
    ]);
  }

  // Contoh kelompok skrup, dipasang ke batang yang belum punya kelompok.
  const groups = await db.select().from(schema.screwGroups).limit(1);
  if (!groups.length) {
    const [standard] = await db
      .insert(schema.screwGroups)
      .values({
        name: "Kelompok 1 (standar)",
        cornerType: 'Skrup 8 × 1"',
        cornerQty: 4,
        jointType: 'Skrup 8 × 3/4"',
        jointQty: 2,
      })
      .returning();
    await db
      .update(schema.frameProfiles)
      .set({ screwGroupId: standard.id })
      .where(isNull(schema.frameProfiles.screwGroupId));
    await db
      .update(schema.handleProfiles)
      .set({ screwGroupId: standard.id })
      .where(isNull(schema.handleProfiles.screwGroupId));
  }

  const hinges = await db.select().from(schema.hingeTypes).limit(1);
  if (!hinges.length) {
    await db.insert(schema.hingeTypes).values([
      { name: 'Engsel 4" Stainless', length: 100 },
      { name: 'Engsel 5" Heavy Duty', length: 125 },
    ]);
  }

  // Katalog material: tambah yang belum ada (berdasarkan SKU), data yang sudah diubah admin tidak ditimpa.
  const seedMaterials = [...murovaMaterials, ...murovaQuotationMaterials, ...extraMaterials];
  await db
    .insert(schema.materials)
    .values(seedMaterials.map((m) => ({ ...m, code: m.code ?? null, note: m.note ?? null })))
    .onConflictDoNothing({ target: schema.materials.sku });
  const materialRows = await db.select({ id: schema.materials.id, sku: schema.materials.sku }).from(schema.materials);
  const materialId = (sku: string) => materialRows.find((m) => m.sku === sku)?.id ?? null;

  for (const [code, sku] of Object.entries(PROFILE_MATERIAL)) {
    const id = materialId(sku);
    if (!id) continue;
    await db
      .update(schema.frameProfiles)
      .set({ materialId: id })
      .where(and(eq(schema.frameProfiles.code, code), isNull(schema.frameProfiles.materialId)));
    await db
      .update(schema.handleProfiles)
      .set({ materialId: id })
      .where(and(eq(schema.handleProfiles.code, code), isNull(schema.handleProfiles.materialId)));
  }
  for (const [name, sku] of Object.entries(HINGE_MATERIAL)) {
    const id = materialId(sku);
    if (!id) continue;
    await db
      .update(schema.hingeTypes)
      .set({ materialId: id })
      .where(and(eq(schema.hingeTypes.name, name), isNull(schema.hingeTypes.materialId)));
  }
  if (!(await db.query.hingeTypes.findFirst({ where: eq(schema.hingeTypes.name, "Engsel Pivot Pintu Kaca") }))) {
    await db
      .insert(schema.hingeTypes)
      .values({ name: "Engsel Pivot Pintu Kaca", length: 80, materialId: materialId("DMY-ENG-PVT") });
  }

  // Satu batang frame dari katalog MUROVA supaya bisa langsung dicoba di kalkulator.
  if (!(await db.query.frameProfiles.findFirst({ where: eq(schema.frameProfiles.code, "A201-40") }))) {
    const group = await db.query.screwGroups.findFirst();
    await db.insert(schema.frameProfiles).values({
      name: "MUROVA A201-40 Copper",
      code: "A201-40",
      color: "#b87333",
      barLength: 3000,
      faceWidth: 40,
      screwGroupId: group?.id ?? null,
      materialId: materialId("80FHAOPB2001-A201-40-3M"),
    });
  }
  console.log(`Material: ${materialRows.length} barang di katalog.`);

  console.log("Seed selesai. Login: admin/admin123 dan lapangan/lapangan123");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
