import { describe, expect, it } from "vitest";
import {
  bomFromBulk,
  bomFromResult,
  calculate,
  calculateBulk,
  CalcError,
  decomposeDoor,
  distributeHinges,
  feasibleHandleRanges,
  screwJoints,
  type DoorSpec,
} from "./index";
import { roundToPurchase } from "./bom";
import { packItems } from "./pack";
import type { CalcSettings, FrameProfile, HandleProfile, HingeType, Material, ScrewGroup } from "./types";

const settings: CalcSettings = { kerf: 4, endTrim: 0, minUsableOffcut: 300, glassInset: 0 };
const screws: ScrewGroup = {
  id: 1,
  name: "Kelompok 1",
  cornerType: "Skrup 8x1",
  cornerQty: 4,
  jointType: "Skrup 8x3/4",
  jointQty: 2,
};
const frame: FrameProfile = {
  id: 1,
  name: "Frame 4x4",
  color: "#888",
  barLength: 3000,
  faceWidth: 40,
  screwGroup: screws,
};
const handle: HandleProfile = {
  id: 10,
  name: "Gagang Panjang",
  color: "#333",
  barLength: 3000,
  faceWidth: 45,
  screwGroup: null,
  zones: [{ start: 1300, length: 200 }],
  remainderFrameProfileId: 1,
};

const door = (over: Partial<DoorSpec> = {}): DoorSpec => ({
  doorType: "slider",
  hingeTypeId: null,
  hinges: [],
  width: 800,
  height: 2100,
  frameProfileId: 1,
  handleProfileId: 10,
  handleSide: "right",
  // Ujung bawah gagang 900 = titik tengah 1000 untuk zona 200 mm.
  handleHeight: 900,
  hDividers: [],
  vDividers: [],
  ...over,
});

describe("decomposeDoor", () => {
  it("membuat 4 sisi frame dengan sisi gagang dari batang gagang", () => {
    const pieces = decomposeDoor(door(), frame, handle);
    expect(pieces.map((p) => [p.id, p.length, p.stock.kind])).toEqual([
      ["top", 800, "frame"],
      ["bottom", 800, "frame"],
      ["left", 2100, "frame"],
      ["right", 2100, "handle"],
    ]);
  });

  it("memotong divider horizontal menjadi ruas di antara divider vertikal", () => {
    const pieces = decomposeDoor(door({ vDividers: [400], hDividers: [1000] }), frame, handle);
    const v = pieces.find((p) => p.id === "v1")!;
    expect(v.length).toBe(2100 - 80);
    // Bidang dalam: 40 .. 755, divider vertikal 380..420
    expect(pieces.filter((p) => p.id.startsWith("h1")).map((p) => p.length)).toEqual([340, 335]);
  });
});

describe("feasibleHandleRanges", () => {
  it("membatasi tinggi ujung bawah gagang sesuai posisi zona di batang", () => {
    const ranges = feasibleHandleRanges(handle, settings, 2100, 40);
    // Zona 1300–1500 (tengah 1400). Titik tengah gagang c = h + 100.
    // Normal: start = 1400 - c ∈ [0, 900]          →  c ∈ [500, 1400]
    // Dibalik: start = 1400 - (2100 - c) ∈ [0, 900] →  c ∈ [700, 1600]
    // Jadi c ∈ [500, 1600], ujung bawah h ∈ [400, 1500]
    expect(ranges).toEqual([{ start: 400, length: 1100 }]);
  });
});

describe("packItems", () => {
  it("menemukan susunan optimal, bukan sekadar first-fit", () => {
    const items = [1500, 1000, 1000, 1500, 1000].map((w) => ({ weight: w, data: w }));
    const r = packItems(items, [], 3000);
    expect(r.newBins).toHaveLength(2);
    expect(r.optimal).toBe(true);
  });

  it("memakai sisa gratis lebih dulu", () => {
    const r = packItems([{ weight: 500, data: "a" }], [600], 3000);
    expect(r.newBins).toHaveLength(0);
    expect(r.freeBins[0]).toEqual(["a"]);
  });
});

describe("calculate", () => {
  it("menghitung kebutuhan batang pintu standar", () => {
    const r = calculate(door(), [frame], [handle], settings);
    expect(r.summary.map((s) => [s.kind, s.newBars])).toEqual([
      ["handle", 1],
      ["frame", 2],
    ]);
    const handleCut = r.bars[0].cuts.find((c) => c.kind === "handle")!;
    // Dibalik memberi sisa terpanjang di satu sisi
    expect(handleCut.flipped).toBe(true);
    expect(handleCut.start).toBe(300);
    expect(r.stats.piecesLength).toBe(800 * 2 + 2100 * 2);
    expect(r.stats.materialLength).toBe(9000);
  });

  it("memakai sisa batang gagang untuk divider", () => {
    const r = calculate(door({ width: 500, hDividers: [1000] }), [frame], [handle], settings);
    const handleBar = r.bars.find((b) => b.kind === "handle")!;
    expect(handleBar.cuts.some((c) => c.kind === "frame")).toBe(true);
  });

  it("tidak memakai sisa gagang jika profil tidak cocok", () => {
    const other = { ...handle, remainderFrameProfileId: null };
    const r = calculate(door({ width: 500, hDividers: [1000] }), [frame], [other], settings);
    expect(r.bars.find((b) => b.kind === "handle")!.cuts).toHaveLength(1);
  });

  it("memberi petunjuk tinggi gagang yang valid", () => {
    expect(() => calculate(door({ handleHeight: 300 }), [frame], [handle], settings)).toThrowError(/400–1500 mm/);
  });

  it("menolak divider yang keluar dari pintu", () => {
    try {
      calculate(door({ vDividers: [10] }), [frame], [handle], settings);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CalcError);
      expect((e as CalcError).issues[0].field).toBe("vDividers");
    }
  });

  it("menjaga total: potongan + sisa + buangan = material", () => {
    const r = calculate(door({ hDividers: [700, 1400], vDividers: [400] }), [frame], [handle], {
      ...settings,
      endTrim: 10,
    });
    const leftovers = r.bars.flatMap((b) => b.leftovers).reduce((s, l) => s + l.length, 0);
    expect(r.stats.piecesLength + leftovers + r.stats.scrap).toBeCloseTo(r.stats.materialLength);
    for (const bar of r.bars) {
      const end = Math.max(...bar.cuts.map((c) => c.start + c.length));
      expect(end).toBeLessThanOrEqual(bar.barLength - 10 + 1e-6);
    }
  });
});

describe("kaca", () => {
  it("bukaan dikurangi tebal frame dan tebal gagang", () => {
    const r = calculate(door(), [frame], [handle], settings);
    // Lebar: 800 - 40 (frame kiri) - 45 (gagang kanan); tinggi: 2100 - 2 × 40
    expect(r.glass.panels).toEqual([{ id: "K1", openingWidth: 715, openingHeight: 2020, width: 715, height: 2020 }]);
  });

  it("dibagi divider dan ditambah alur kaca", () => {
    const r = calculate(door({ hDividers: [1000], vDividers: [400] }), [frame], [handle], {
      ...settings,
      glassInset: 5,
    });
    // Kolom: 40..380 dan 420..755; baris (dari atas): 1020..2060 dan 40..980
    expect(r.glass.panels.map((p) => [p.id, p.openingWidth, p.openingHeight, p.width, p.height])).toEqual([
      ["K1", 340, 1040, 350, 1050],
      ["K2", 335, 1040, 345, 1050],
      ["K3", 340, 940, 350, 950],
      ["K4", 335, 940, 345, 950],
    ]);
  });
});

describe("skrup", () => {
  it("dihitung per sudut dan per ujung divider", () => {
    const r = calculate(door({ hDividers: [1000], vDividers: [400] }), [frame], [handle], settings);
    // 4 sudut × 4 (gagang tanpa kelompok ikut frame); ujung divider: 1 vertikal + 2 ruas horizontal = 6 ujung × 2
    expect(r.screws).toEqual([
      {
        type: "Skrup 8x1",
        qty: 16,
        detail: ["2 sudut sisi biasa × 4 (Kelompok 1)", "2 sudut sisi gagang × 4 (Kelompok 1)"],
      },
      { type: "Skrup 8x3/4", qty: 12, detail: ["6 ujung divider × 2 (Kelompok 1)"] },
    ]);
  });

  it("sisi gagang memakai kelompok batang gagang", () => {
    const own: ScrewGroup = {
      id: 2,
      name: "Kelompok 2",
      cornerType: "Skrup 10x1",
      cornerQty: 3,
      jointType: "",
      jointQty: 0,
    };
    const r = calculate(door(), [frame], [{ ...handle, screwGroup: own }], settings);
    expect(r.screws.map((l) => [l.type, l.qty])).toEqual([
      ["Skrup 8x1", 8],
      ["Skrup 10x1", 6],
    ]);
  });

  it("kosong jika batang belum punya kelompok skrup", () => {
    const r = calculate(door(), [{ ...frame, screwGroup: null }], [handle], settings);
    expect(r.screws).toEqual([]);
  });
});

describe("tipe pintu dan engsel", () => {
  const hingeTypes: HingeType[] = [{ id: 7, name: 'Engsel 4"', length: 100 }];
  const swing = (over: Partial<DoorSpec> = {}) =>
    door({ doorType: "swing", hingeTypeId: 7, hinges: distributeHinges(3, 2100, 100), ...over });

  it("engsel dibagi rata, ujung engsel 200 mm dari bawah dan atas", () => {
    // Engsel 100 mm: ujung bawah di 200, 1000, 1800 → titik tengah 250, 1050, 1850
    expect(distributeHinges(3, 2100, 100)).toEqual([250, 1050, 1850]);
    expect(distributeHinges(2, 2100, 100)).toEqual([250, 1850]);
    expect(distributeHinges(1, 2100, 100)).toEqual([1050]);
  });

  it("swing: engsel di seberang gagang", () => {
    const r = calculate(swing(), [frame], [handle], settings, hingeTypes);
    expect(r.hinges).toEqual({
      typeId: 7,
      name: 'Engsel 4"',
      length: 100,
      side: "left",
      positions: [250, 1050, 1850],
    });
  });

  it("swing wajib jenis engsel dan tidak boleh gagang di kedua sisi", () => {
    expect(() => calculate(swing({ hingeTypeId: null }), [frame], [handle], settings, hingeTypes)).toThrowError(
      /Pilih jenis engsel/,
    );
    expect(() => calculate(swing({ handleSide: "both" }), [frame], [handle], settings, hingeTypes)).toThrowError(
      /hanya bisa satu sisi/,
    );
    expect(() => calculate(swing({ hinges: [500, 550] }), [frame], [handle], settings, hingeTypes)).toThrowError(
      /bertumpuk/,
    );
  });

  it("slider tanpa engsel", () => {
    const r = calculate(door({ hinges: [200] }), [frame], [handle], settings, hingeTypes);
    expect(r.hinges).toBeNull();
  });

  it("slider gagang di kedua sisi memakai 2 frame gagang", () => {
    const r = calculate(door({ handleSide: "both" }), [frame], [handle], settings);
    const handlePieces = r.pieces.filter((p) => p.stock.kind === "handle");
    expect(handlePieces.map((p) => p.id)).toEqual(["left", "right"]);
    expect(r.summary.find((s) => s.kind === "handle")!.newBars).toBe(2);
    // Bukaan kaca dikurangi tebal gagang di kedua sisi: 800 - 45 - 45
    expect(r.glass.panels[0].openingWidth).toBe(710);
  });
});

describe("titik skrup", () => {
  it("jumlah per titik sama dengan total skrup per jenis", () => {
    for (const spec of [door(), door({ hDividers: [700, 1400], vDividers: [400] }), door({ handleSide: "both" })]) {
      const r = calculate(spec, [frame], [handle], settings);
      const totals = new Map<string, number>();
      for (const j of screwJoints(spec, frame, handle)) totals.set(j.type, (totals.get(j.type) ?? 0) + j.qty);
      expect(Object.fromEntries(totals)).toEqual(Object.fromEntries(r.screws.map((l) => [l.type, l.qty])));
    }
  });
});

describe("bulk", () => {
  it("sisa batang satu pintu dipakai pintu lain", () => {
    const one = calculate(door(), [frame], [handle], settings);
    expect(one.stats.totalNewBars).toBe(3);

    // 2 unit pintu yang sama: terpisah 6 batang, bersama 5 (frame atas/bawah berbagi batang).
    const bulk = calculateBulk([{ spec: door(), qty: 2, label: "Kamar" }], [frame], [handle], settings);
    expect(bulk.separateBars).toBe(6);
    expect(bulk.stats.totalNewBars).toBe(5);
    expect(bulk.summary.map((s) => [s.kind, s.newBars])).toEqual([
      ["handle", 2],
      ["frame", 3],
    ]);
  });

  it("menggabungkan pintu berbeda dan semua potongan tercatat sekali", () => {
    const items = [
      { spec: door(), qty: 1, label: "A" },
      { spec: door({ width: 700, hDividers: [1000] }), qty: 2, label: "B" },
    ];
    const bulk = calculateBulk(items, [frame], [handle], settings);
    const cutIds = bulk.bars.flatMap((b) => b.cuts.map((c) => c.pieceId)).sort();
    const expected = bulk.doors
      .flatMap((d) =>
        Array.from({ length: d.qty }, (_, k) => d.single.pieces.map((p) => `${d.code}-${k + 1}:${p.id}`)).flat(),
      )
      .sort();
    expect(cutIds).toEqual(expected);
    expect(bulk.bars.flatMap((b) => b.cuts).find((c) => c.pieceId === "P2-2:top")!.label).toBe("P2 (2/2) · Frame atas");
    expect(bulk.stats.totalNewBars).toBeLessThanOrEqual(bulk.separateBars);
  });

  it("menjumlahkan skrup per unit", () => {
    const bulk = calculateBulk([{ spec: door(), qty: 3, label: "" }], [frame], [handle], settings);
    // 1 pintu: 4 sudut × 4 skrup
    expect(bulk.screws).toEqual([{ type: "Skrup 8x1", qty: 48, detail: ["P1: 16 × 3"] }]);
  });

  it("error menyebut pintu yang bermasalah", () => {
    expect(() =>
      calculateBulk(
        [
          { spec: door(), qty: 1, label: "" },
          { spec: door({ handleHeight: 50 }), qty: 1, label: "" },
        ],
        [frame],
        [handle],
        settings,
      ),
    ).toThrowError(/^P2: Tinggi gagang yang bisa/);
  });
});

describe("material: glass deduction, intersection cutback, komponen, BOM", () => {
  const mat = (over: Partial<Material> & Pick<Material, "id" | "name" | "category">): Material => ({
    sku: null,
    code: null,
    unit: "pcs",
    minPurchase: 1,
    price: 0,
    usagePerPoint: 1,
    glassDeduction: 0,
    intersectionCutback: 0,
    ...over,
  });
  const materials: Material[] = [
    mat({ id: 1, name: "Profil frame", category: "profil", unit: "batang", price: 100000 }),
    mat({ id: 2, name: "Profil gagang", category: "profil", unit: "batang", price: 200000 }),
    mat({ id: 3, name: "Seal kaca", category: "seal", unit: "m", minPurchase: 50, price: 700, usagePerPoint: 2 }),
    mat({ id: 4, name: "Corner A507", category: "corner", minPurchase: 20, price: 175 }),
    mat({ id: 5, name: "Pin ambalan", category: "pin", minPurchase: 50, price: 500, usagePerPoint: 2 }),
    mat({ id: 6, name: "Skrup 8x1", category: "skrup", minPurchase: 20, price: 150 }),
  ];
  const f = { ...frame, materialId: 1, glassDeduction: 3, intersectionCutback: 1 };
  const h = { ...handle, materialId: 2, glassDeduction: 5 };
  const withParts = (over: Partial<DoorSpec> = {}) =>
    door({ sealMaterialId: 3, cornerMaterialId: 4, pinMaterialId: 5, ...over });

  it("glass deduction mengurangi kaca per sisi sesuai profil yang menutupnya", () => {
    const r = calculate(door({ vDividers: [400] }), [f], [h], settings);
    const [left, right] = r.glass.panels;
    // Kiri: frame (3) + divider (3). Kanan: divider (3) + gagang (5). Tinggi: frame atas & bawah (3 + 3).
    expect(left.width).toBeCloseTo(left.openingWidth - 6);
    expect(right.width).toBeCloseTo(right.openingWidth - 8);
    expect(left.height).toBeCloseTo(left.openingHeight - 6);
  });

  it("intersection cutback memendekkan divider di kedua ujung", () => {
    const plain = decomposeDoor(door({ vDividers: [400], hDividers: [1000] }), frame, handle);
    const cut = decomposeDoor(door({ vDividers: [400], hDividers: [1000] }), f, handle);
    for (const id of ["v1", "h1a", "h1b"]) {
      expect(cut.find((p) => p.id === id)!.length).toBeCloseTo(plain.find((p) => p.id === id)!.length - 2);
    }
    // Frame luar tidak terpengaruh.
    expect(cut.find((p) => p.id === "top")!.length).toBe(800);
  });

  it("menghitung seal dari keliling kaca, corner per sudut, pin per ujung divider", () => {
    const r = calculate(withParts({ hDividers: [1000] }), [f], [h], settings, [], materials);
    const by = (k: string) => r.components!.find((c) => c.kind === k)!;
    const perimeter = r.glass.panels.reduce((s, p) => s + 2 * (p.width + p.height), 0) / 1000;
    expect(by("seal").qty).toBeCloseTo(Math.ceil(perimeter * 2 * 10) / 10);
    expect(by("corner").qty).toBe(4);
    expect(by("pin").qty).toBe(2 * 2); // 1 divider horizontal = 2 ujung × 2 pin
  });

  it("tanpa divider tidak ada pin ambalan; komponen null tidak dihitung", () => {
    const r = calculate(withParts({ sealMaterialId: null }), [f], [h], settings, [], materials);
    expect(r.components!.map((c) => c.kind)).toEqual(["corner"]);
  });

  it("BOM membulatkan ke kelipatan minimal beli", () => {
    expect(roundToPurchase(10, 20)).toBe(20);
    expect(roundToPurchase(20, 20)).toBe(20);
    expect(roundToPurchase(25, 20)).toBe(40);
    expect(roundToPurchase(4.2, 3.5)).toBe(7);
    expect(roundToPurchase(0, 20)).toBe(0);
  });

  it("BOM per pintu: harga, minimal beli, dan baris yang belum terhubung", () => {
    const frameNoScrewName = { ...f, screwGroup: { ...screws, jointType: "Skrup lain" } };
    const r = calculate(withParts({ hDividers: [1000] }), [frameNoScrewName], [h], settings, [], materials);
    const bom = bomFromResult(r, { materials, frames: [frameNoScrewName], handles: [h], hingeTypes: [] });
    const line = (name: string) => bom.lines.find((l) => l.name === name)!;
    expect(line("Corner A507")).toMatchObject({ need: 4, buy: 20, subtotal: 20 * 175 });
    expect(line("Skrup 8x1")).toMatchObject({ need: 16, buy: 20 });
    expect(line("Profil frame").unit).toBe("batang");
    expect(line("Skrup lain").materialId).toBeNull();
    expect(bom.unlinked).toBe(1);
    expect(bom.total).toBe(bom.lines.reduce((s, l) => s + l.subtotal, 0));
  });

  it("BOM bulk membulatkan setelah digabung, bukan per pintu", () => {
    const bulk = calculateBulk([{ spec: withParts(), qty: 3, label: "" }], [f], [h], settings, [], materials);
    const bom = bomFromBulk(bulk, { materials, frames: [f], handles: [h], hingeTypes: [] });
    const corner = bom.lines.find((l) => l.materialId === 4)!;
    expect(corner.need).toBe(12);
    expect(corner.buy).toBe(20); // per pintu 3 × 20 = 60
  });

  it("riwayat lama tanpa field komponen tetap bisa dihitung", () => {
    const r = calculate(door(), [frame], [handle], settings);
    expect(r.components).toEqual([]);
    expect(r.glass.panels[0].width).toBe(r.glass.panels[0].openingWidth);
  });
});
