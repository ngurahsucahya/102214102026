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

export type HandleSide = "left" | "right";

export type DoorSpec = {
  width: number;
  height: number;
  frameProfileId: number;
  handleProfileId: number;
  handleSide: HandleSide;
  /** Tinggi titik tengah gagang dari bawah pintu. */
  handleHeight: number;
  /** Titik tengah divider horizontal, diukur dari bawah pintu. */
  hDividers: number[];
  /** Titik tengah divider vertikal, diukur dari kiri pintu. */
  vDividers: number[];
};

export type CutAngle = "miter" | "straight";

export type Piece = {
  id: string;
  label: string;
  length: number;
  angle: CutAngle;
  stock: { kind: "frame" | "handle"; profileId: number };
  /** Khusus frame gagang: jarak titik tengah gagang dari ujung bawah potongan. */
  handleOffset?: number;
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

export type ValidationIssue = { field: string; message: string };

export class CalcError extends Error {
  constructor(public issues: ValidationIssue[]) {
    super(issues.map((i) => i.message).join("; "));
  }
}
