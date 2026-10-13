import "dotenv/config";
import bcrypt from "bcryptjs";
import { isNull } from "drizzle-orm";
import { db, schema } from "../src/db";

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

  console.log("Seed selesai. Login: admin/admin123 dan lapangan/lapangan123");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
