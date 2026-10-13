import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CalcSettings, FrameProfile, HandleProfile, ScrewGroup } from "@/lib/engine/types";

export async function getSettings() {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.id, 1) });
  if (row) return row;
  const [created] = await db.insert(schema.settings).values({ id: 1 }).returning();
  return created;
}

export const listFrames = () => db.select().from(schema.frameProfiles).orderBy(asc(schema.frameProfiles.name));
export const listHandles = () => db.select().from(schema.handleProfiles).orderBy(asc(schema.handleProfiles.name));
export const listScrewGroups = () => db.select().from(schema.screwGroups).orderBy(asc(schema.screwGroups.name));

export type CalcCatalog = {
  settings: CalcSettings & { defaultBarLength: number };
  frames: FrameProfile[];
  handles: (HandleProfile & { code: string | null })[];
};

/** Data master aktif dalam bentuk yang dipakai engine, panjang batang sudah final. */
export async function getCalcCatalog(): Promise<CalcCatalog> {
  const [s, frames, handles, groups] = await Promise.all([
    getSettings(),
    listFrames(),
    listHandles(),
    listScrewGroups(),
  ]);
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
      .filter((f) => f.active)
      .map((f) => ({
        id: f.id,
        name: f.name,
        color: f.color,
        barLength: f.barLength ?? s.defaultBarLength,
        faceWidth: f.faceWidth,
        screwGroup: screwGroup(f.screwGroupId),
      })),
    handles: handles
      .filter((h) => h.active && h.zones.length > 0)
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
      })),
  };
}
