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

export type FrameProfile = {
  id: number;
  name: string;
  color: string;
  /** Panjang batang (sudah memperhitungkan default dari pengaturan). */
  barLength: number;
  /** Tebal frame (lebar dilihat dari depan): mengurangi bukaan kaca dan panjang divider. */
  faceWidth: number;
  screwGroup: ScrewGroup | null;
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
  /** Ukuran potong kaca (bukaan + alur di kedua sisi). */
  width: number;
  height: number;
};

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
  hinges: { name: string; qty: number }[];
};

export type ValidationIssue = { field: string; message: string };

export class CalcError extends Error {
  constructor(public issues: ValidationIssue[]) {
    super(issues.map((i) => i.message).join("; "));
  }
}
