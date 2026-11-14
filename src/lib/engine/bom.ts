import type {
  Bom,
  BomLine,
  BulkResult,
  CalcResult,
  ComponentLine,
  FrameProfile,
  HandleProfile,
  HingeType,
  Material,
  ProfileSummary,
  ScrewLine,
} from "./types";

export type BomCatalog = {
  materials: Material[];
  frames: FrameProfile[];
  handles: HandleProfile[];
  hingeTypes: HingeType[];
};

type Usage = {
  /** Kunci penggabungan: material yang sama digabung jadi satu baris. */
  materialId: number | null;
  name: string;
  group: string;
  unit: string;
  qty: number;
};

const COMPONENT_GROUP: Record<ComponentLine["kind"], string> = {
  seal: "Seal",
  corner: "Corner connector",
  pin: "Pin ambalan",
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Jumlah beli = kelipatan minimal beli yang menutup kebutuhan. Butuh 10, minimal 20 → beli 20. */
export function roundToPurchase(need: number, minPurchase: number) {
  if (need <= 0) return 0;
  if (!(minPurchase > 0)) return need;
  return Math.ceil(need / minPurchase - 1e-9) * minPurchase;
}

/**
 * BOM: kebutuhan material digabung per barang katalog, lalu dibulatkan ke minimal beli.
 * Pembulatan dilakukan setelah digabung, jadi bulk lebih hemat daripada per pintu.
 */
export function buildBom(usages: Usage[], materials: Material[]): Bom {
  const byId = new Map(materials.map((m) => [m.id, m]));
  const rows = new Map<string, { usage: Usage; material: Material | undefined }>();

  for (const u of usages) {
    if (u.qty <= 0) continue;
    const material = u.materialId == null ? undefined : byId.get(u.materialId);
    const key = material ? `m${material.id}` : `x:${u.group}:${norm(u.name)}`;
    const row = rows.get(key);
    if (row) row.usage = { ...row.usage, qty: row.usage.qty + u.qty };
    else rows.set(key, { usage: { ...u }, material });
  }

  const lines: BomLine[] = [...rows.entries()].map(([key, { usage, material }]) => {
    const need = Math.round(usage.qty * 100) / 100;
    if (!material) {
      return {
        key,
        materialId: null,
        sku: null,
        code: null,
        name: usage.name,
        group: usage.group,
        unit: usage.unit,
        need,
        minPurchase: 1,
        buy: Math.ceil(need - 1e-9),
        price: 0,
        subtotal: 0,
      };
    }
    const buy = Math.round(roundToPurchase(need, material.minPurchase) * 100) / 100;
    return {
      key,
      materialId: material.id,
      sku: material.sku,
      code: material.code,
      name: material.name,
      group: usage.group,
      unit: material.unit,
      need,
      minPurchase: material.minPurchase,
      buy,
      price: material.price,
      subtotal: Math.round(buy * material.price),
    };
  });

  return {
    lines,
    total: lines.reduce((s, l) => s + l.subtotal, 0),
    unlinked: lines.filter((l) => l.materialId == null).length,
  };
}

/** Skrup dicocokkan ke material lewat nama atau kode (jenis skrup di kelompok skrup = nama material). */
function screwMaterial(type: string, materials: Material[]) {
  const t = norm(type);
  return materials.find((m) => norm(m.name) === t) ?? materials.find((m) => m.code && norm(m.code) === t);
}

function usagesFrom(
  parts: {
    summary: ProfileSummary[];
    screws: ScrewLine[];
    hinges: { name: string; qty: number; typeId?: number }[];
    components: ComponentLine[];
  },
  catalog: BomCatalog,
): Usage[] {
  const out: Usage[] = [];
  for (const s of parts.summary) {
    const profile =
      s.kind === "frame"
        ? catalog.frames.find((f) => f.id === s.profileId)
        : catalog.handles.find((h) => h.id === s.profileId);
    out.push({
      materialId: profile?.materialId ?? null,
      name: s.profileName,
      group: s.kind === "frame" ? "Batang frame" : "Batang gagang",
      unit: "batang",
      qty: s.newBars,
    });
  }
  for (const l of parts.screws) {
    const m = screwMaterial(l.type, catalog.materials);
    out.push({ materialId: m?.id ?? null, name: l.type, group: "Skrup", unit: "pcs", qty: l.qty });
  }
  for (const h of parts.hinges) {
    const type = catalog.hingeTypes.find((t) => t.id === h.typeId) ?? catalog.hingeTypes.find((t) => t.name === h.name);
    out.push({ materialId: type?.materialId ?? null, name: h.name, group: "Engsel", unit: "pcs", qty: h.qty });
  }
  for (const c of parts.components) {
    out.push({ materialId: c.materialId, name: c.name, group: COMPONENT_GROUP[c.kind], unit: c.unit, qty: c.qty });
  }
  return out;
}

/** BOM untuk sejumlah pintu yang sama (qty dikalikan sebelum dibulatkan ke minimal beli). */
export function bomFromResult(result: CalcResult, catalog: BomCatalog): Bom {
  return buildBom(
    usagesFrom(
      {
        summary: result.summary,
        screws: result.screws,
        hinges: result.hinges
          ? [{ name: result.hinges.name, qty: result.hinges.positions.length, typeId: result.hinges.typeId }]
          : [],
        components: result.components ?? [],
      },
      catalog,
    ),
    catalog.materials,
  );
}

export function bomFromBulk(result: BulkResult, catalog: BomCatalog): Bom {
  return buildBom(
    usagesFrom(
      { summary: result.summary, screws: result.screws, hinges: result.hinges, components: result.components ?? [] },
      catalog,
    ),
    catalog.materials,
  );
}
