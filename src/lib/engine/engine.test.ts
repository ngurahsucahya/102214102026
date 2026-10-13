import { describe, expect, it } from "vitest";
import { calculate, CalcError, decomposeDoor, feasibleHandleRanges, type DoorSpec } from "./index";
import { packItems } from "./pack";
import type { CalcSettings, FrameProfile, HandleProfile, ScrewGroup } from "./types";

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
  width: 800,
  height: 2100,
  frameProfileId: 1,
  handleProfileId: 10,
  handleSide: "right",
  handleHeight: 1000,
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
  it("membatasi tinggi gagang sesuai posisi zona di batang", () => {
    const ranges = feasibleHandleRanges(handle, settings, 2100, 40);
    // Normal: start = 1400 - h >= 0 dan 1400 - h + 2100 <= 3000  →  h ∈ [500, 1400]
    // Dibalik: start = 1400 - (2100 - h) >= 0 dan ≤ 900          →  h ∈ [700, 1600]
    expect(ranges).toEqual([{ start: 500, length: 1100 }]);
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
    expect(() => calculate(door({ handleHeight: 300 }), [frame], [handle], settings)).toThrowError(/500–1600 mm/);
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
