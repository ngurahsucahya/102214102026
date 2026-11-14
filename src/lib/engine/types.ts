// Semua ukuran dalam milimeter (mm).

export type CalcSettings = {
  /** Tebal mata gergaji yang hilang per potongan. */
  kerf: number;
  /** Bagian ujung batang yang dibuang (ujung pabrik sering tidak rata). */
  endTrim: number;
  /** Sisa di bawah panjang ini dianggap buangan (scrap). */
  minUsableOffcut: number;
  /** Kaca masuk ke alur profil sedalam ini di tiap sisi (0 = kaca pas bukaan). */
  glassInset: number;
};

/** Jenis dan jumlah skrup untuk satu batang, dihitung per sambungan. */
export type ScrewGroup = {
  id: number;
  name: string;
  /** Skrup di tiap sudut frame. */
  cornerType: string;
  cornerQty: number;
  /** Skrup di tiap ujung divider. */
  jointType: string;
  jointQty: number;
};

/** Kategori material di katalog. */
export const MATERIAL_CATEGORIES = {
  profil: "Profil / batang",
  track: "Track",
  cover: "Cover",
  seal: "Seal",
  corner: "Corner connector",
  pin: "Pin ambalan",
  engsel: "Engsel",
  skrup: "Skrup",
  roller: "Roller",
  aksesoris: "Aksesoris",
  lainnya: "Lainnya",
} as const;
export type MaterialCategory = keyof typeof MATERIAL_CATEGORIES;

/** Satu barang di katalog material, dengan harga dan minimal beli. */
export type Material = {
  id: number;
  sku: string | null;
  code: string | null;
  name: string;
  category: MaterialCategory;
  /** Satuan hitung: pcs, batang, m, set, … */
  unit: string;
  /** Minimal beli, juga kelipatan beli (mis. 20 → butuh 25 beli 40). */
  minPurchase: number;
  /** Harga per satuan (Rp). */
  price: number;
  /** Jumlah per titik pasang: per sudut (corner), per ujung divider (pin), jalur per sisi kaca (seal). */
  usagePerPoint: number;
  /** Khusus profil: kaca dipotong lebih kecil sebanyak ini di sisi yang ditutup profil ini (mm). */
  glassDeduction: number;
  /** Khusus profil: divider dipotong lebih pendek sebanyak ini di tiap ujung pertemuan (mm). */
  intersectionCutback: number;
};

export type FrameProfile = {
  id: number;
  name: string;
  color: string;
  /** Panjang batang (sudah memperhitungkan default dari pengaturan). */
  barLength: number;
  /** Tebal frame (lebar dilihat dari depan): mengurangi bukaan kaca dan panjang divider. */
  faceWidth: number;
  screwGroup: ScrewGroup | null;
  /** Material katalog untuk BOM (harga, minimal beli). */
  materialId?: number | null;
  /** Dari material: potongan kaca per sisi yang ditutup profil ini (mm). */
  glassDeduction?: number;
  /** Dari material: pemendekan divider di tiap ujung (mm). */
  intersectionCutback?: number;
};

export type HandleZone = {
  /** Posisi awal zona gagang dihitung dari ujung kiri batang. */
  start: number;
  length: number;
};

export type HandleProfile = {
  id: number;
  name: string;
  color: string;
  barLength: number;
  /** Tebal gagang (lebar dilihat dari depan). */
  faceWidth: number;
  screwGroup: ScrewGroup | null;
  zones: HandleZone[];
  /** Sisa batang gagang bisa dipakai sebagai frame profil ini (null = tidak bisa). */
  remainderFrameProfileId: number | null;
  materialId?: number | null;
  /** Dari material: potongan kaca di sisi gagang (mm). */
  glassDeduction?: number;
};

export type Side = "left" | "right";
/** "both" hanya untuk slider: kedua frame vertikal memakai batang gagang. */
export type HandleSide = Side | "both";
export type DoorType = "swing" | "slider";

export type HingeType = {
  id: number;
  name: string;
  /** Tinggi daun engsel, untuk gambar dan validasi posisi. */
  length: number;
  materialId?: number | null;
};

export type DoorSpec = {
  doorType: DoorType;
  width: number;
  height: number;
  frameProfileId: number;
  handleProfileId: number;
  handleSide: HandleSide;
  /** Tinggi ujung bawah gagang dari bawah pintu (lantai). */
  handleHeight: number;
  /** Titik tengah divider horizontal, diukur dari bawah pintu. */
  hDividers: number[];
  /** Titik tengah divider vertikal, diukur dari kiri pintu. */
  vDividers: number[];
  /** Khusus swing: jenis engsel dan titik tengah tiap engsel dari bawah pintu. */
  hingeTypeId: number | null;
  hinges: number[];
  /** Komponen dari katalog material (null = tidak dipakai). Kosong di riwayat lama. */
  sealMaterialId?: number | null;
  cornerMaterialId?: number | null;
  pinMaterialId?: number | null;
};

export type CutAngle = "miter" | "straight";

export type Piece = {
  id: string;
  label: string;
  length: number;
  angle: CutAngle;
  stock: { kind: "frame" | "handle"; profileId: number };
  /** Khusus frame gagang: jarak ujung bawah gagang dari ujung bawah potongan. */
  handleOffset?: number;
  /** Khusus frame gagang: tebal frame atas/bawah, zona gagang harus di antaranya. */
  handleFrameWidth?: number;
  /** Bulk: nama pintu asal potongan, mis. "P2". */
  door?: string;
};

export type PlacedCut = {
  pieceId: string;
  label: string;
  length: number;
  angle: CutAngle;
  kind: "frame" | "handle";
  start: number;
  /** true jika potongan dibalik (ujung bawah pintu ada di sisi kanan batang). */
  flipped?: boolean;
};

export type Segment = { start: number; length: number };

export type BarPlan = {
  id: string;
  kind: "frame" | "handle";
  profileId: number;
  profileName: string;
  color: string;
  barLength: number;
  cuts: PlacedCut[];
  zones?: HandleZone[];
  /** Sisa yang masih layak dipakai. */
  leftovers: Segment[];
  /** Sisa yang terlalu pendek (buangan). */
  scraps: Segment[];
};

export type ProfileSummary = {
  kind: "frame" | "handle";
  profileId: number;
  profileName: string;
  color: string;
  barLength: number;
  newBars: number;
};

export type GlassPanel = {
  id: string;
  /** Ukuran bukaan di antara frame/divider. */
  openingWidth: number;
  openingHeight: number;
  /** Ukuran potong kaca (bukaan + alur di kedua sisi − glass deduction). */
  width: number;
  height: number;
};

export type ComponentKind = "seal" | "corner" | "pin";

/** Komponen pintu dari katalog: seal, corner connector, pin ambalan. */
export type ComponentLine = {
  kind: ComponentKind;
  materialId: number;
  name: string;
  qty: number;
  unit: string;
  detail: string;
};

/** Satu baris BOM: kebutuhan dibulatkan ke minimal beli. */
export type BomLine = {
  key: string;
  materialId: number | null;
  sku: string | null;
  code: string | null;
  name: string;
  group: string;
  unit: string;
  need: number;
  minPurchase: number;
  buy: number;
  price: number;
  subtotal: number;
};

export type Bom = { lines: BomLine[]; total: number; unlinked: number };

export type ScrewLine = {
  type: string;
  qty: number;
  /** Asal hitungan, mis. "2 sudut × 4". */
  detail: string[];
};

export type CalcResult = {
  pieces: Piece[];
  bars: BarPlan[];
  summary: ProfileSummary[];
  glass: { panels: GlassPanel[]; totalArea: number };
  /** null untuk slider. */
  hinges: { typeId: number; name: string; length: number; side: Side; positions: number[] } | null;
  screws: ScrewLine[];
  /** Kosong di riwayat lama. */
  components?: ComponentLine[];
  stats: {
    totalNewBars: number;
    materialLength: number;
    piecesLength: number;
    usableLeftover: number;
    scrap: number;
    /** Panjang potongan / material batang baru. */
    efficiency: number;
    /** 1 - buangan / material, sisa layak pakai tidak dihitung sebagai waste. */
    zeroWasteScore: number;
    optimal: boolean;
  };
};

/** Satu jenis pintu di dalam bulk, bisa lebih dari 1 unit. */
export type BulkItem = { spec: DoorSpec; qty: number; label: string };

export type BulkDoor = {
  /** Kode pintu di bulk: P1, P2, ... */
  code: string;
  label: string;
  spec: DoorSpec;
  qty: number;
  /** Hasil kalau pintu ini dihitung sendiri (untuk 1 unit). */
  single: CalcResult;
};

export type BulkResult = Pick<CalcResult, "bars" | "summary" | "stats"> & {
  doors: BulkDoor[];
  /** Total batang kalau setiap unit pintu dihitung terpisah. */
  separateBars: number;
  screws: ScrewLine[];
  hinges: { name: string; qty: number; typeId?: number }[];
  components?: ComponentLine[];
};

export type ValidationIssue = { field: string; message: string };

export class CalcError extends Error {
  constructor(public issues: ValidationIssue[]) {
    super(issues.map((i) => i.message).join("; "));
  }
}
