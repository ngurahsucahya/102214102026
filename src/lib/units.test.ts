import { describe, expect, it } from "vitest";
import { formatLength, fromInput, toInput } from "./units";

describe("satuan", () => {
  it("menampilkan cm dengan ketelitian 1 mm", () => {
    expect(formatLength(900, "cm")).toBe("90");
    expect(formatLength(45, "cm")).toBe("4,5");
    expect(formatLength(594.34, "cm")).toBe("59,4");
    expect(formatLength(3000, "cm")).toBe("300");
  });

  it("menampilkan mm dengan pemisah ribuan", () => {
    expect(formatLength(2100, "mm")).toBe("2.100");
    expect(formatLength(594.34, "mm")).toBe("594");
  });

  it("isian cm dikonversi ke mm dan sebaliknya", () => {
    expect(fromInput(90, "cm")).toBe(900);
    expect(fromInput(4.5, "cm")).toBe(45);
    expect(toInput(2105, "cm")).toBe(210.5);
    expect(fromInput(2105, "mm")).toBe(2105);
  });
});
