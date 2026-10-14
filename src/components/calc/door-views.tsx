"use client";

import { Palette } from "lucide-react";
import { useState, type ComponentProps } from "react";
import type { ScrewLine } from "@/lib/engine/types";
import { DoorCanvas, SCREW_COLORS } from "./door-canvas";

export type ViewSide = "depan" | "belakang" | "keduanya";

const VIEWS: { key: ViewSide; label: string }[] = [
  { key: "depan", label: "Depan" },
  { key: "belakang", label: "Belakang" },
  { key: "keduanya", label: "Depan & belakang" },
];

type CanvasProps = Omit<ComponentProps<typeof DoorCanvas>, "back" | "screwTypes" | "className" | "pieces">;

/**
 * Gambar pintu tampak depan (dengan ukuran) dan tampak belakang (dengan titik skrup).
 * Tampak belakang dicerminkan, seperti saat pintu dibalik di meja kerja.
 */
export function DoorViews({
  screws,
  view: fixedView,
  defaultView = "depan",
  pieces,
  pieceMode: controlledPieceMode,
  onPieceModeChange,
  className,
  ...canvas
}: CanvasProps & {
  screws: ScrewLine[];
  /** Potongan dari hasil hitung; jika ada, muncul tombol "Warna potongan". */
  pieces?: ComponentProps<typeof DoorCanvas>["pieces"];
  pieceMode?: boolean;
  onPieceModeChange?: (on: boolean) => void;
  /** Kunci tampilan (tanpa tombol pilihan), dipakai di lembar cetak. */
  view?: ViewSide;
  defaultView?: ViewSide;
  /** Kelas untuk tiap gambar, terutama tingginya. */
  className?: string;
}) {
  const [chosen, setChosen] = useState<ViewSide>(defaultView);
  const [ownPieceMode, setOwnPieceMode] = useState(false);
  const pieceMode = Boolean(pieces) && (controlledPieceMode ?? ownPieceMode);
  const setPieceMode = (on: boolean) => {
    setOwnPieceMode(on);
    onPieceModeChange?.(on);
    if (!on) canvas.onHighlight?.(null);
  };
  const shownPieces = pieceMode ? pieces : undefined;
  const view = fixedView ?? chosen;
  // Dua tampak berdampingan: tinggi mengikuti proporsi pintu supaya gambar tidak mengecil di tengah ruang kosong.
  // Lembar cetak (view dikunci) tetap memakai ukuran yang diberikan.
  const canvasClass = view === "keduanya" && !fixedView ? "mx-auto block h-auto max-h-[75dvh] w-full" : className;
  const screwTypes = screws.map((s) => s.type);
  const showBack = view !== "depan";

  const front = (
    <figure className="min-w-0">
      {view === "keduanya" && <figcaption className="mb-1 text-center text-xs text-muted">Tampak depan</figcaption>}
      <DoorCanvas {...canvas} pieces={shownPieces} className={canvasClass} />
    </figure>
  );
  const back = (
    <figure className="min-w-0">
      {view === "keduanya" && <figcaption className="mb-1 text-center text-xs text-muted">Tampak belakang</figcaption>}
      <DoorCanvas {...canvas} back screwTypes={screwTypes} pieces={shownPieces} className={canvasClass} />
    </figure>
  );

  return (
    <div>
      {!fixedView && (
        <div className="mb-2 flex flex-wrap justify-center gap-2 print:hidden">
          <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Tampilan pintu">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setChosen(v.key)}
                aria-pressed={view === v.key}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  view === v.key ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          {pieces && (
            <button
              type="button"
              onClick={() => setPieceMode(!pieceMode)}
              aria-pressed={pieceMode}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition ${
                pieceMode ? "border-accent bg-accent text-accent-ink" : "border-line text-muted hover:text-ink"
              }`}
            >
              <Palette className="size-3.5" /> Warna potongan
            </button>
          )}
        </div>
      )}

      {view === "keduanya" ? (
        <div className="grid grid-cols-2 gap-2">
          {front}
          {back}
        </div>
      ) : view === "depan" ? (
        front
      ) : (
        back
      )}

      {pieceMode && (
        <p className="mt-2 text-center text-xs text-muted">
          Warna sama dengan rencana potong; label = batang asal (G = gagang, F = frame).
          {!fixedView && " Arahkan atau ketuk potongan untuk menyorotnya."}
        </p>
      )}

      {showBack && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
          {screws.length === 0 && <span>Batang yang dipilih belum punya kelompok skrup.</span>}
          {screws.map((s, i) => (
            <span key={s.type} className="flex items-center gap-1.5">
              <span
                className="size-3 rounded-full border-2 bg-surface"
                style={{ borderColor: SCREW_COLORS[i % SCREW_COLORS.length] }}
              />
              <span className="text-ink">{s.type}</span> {s.qty} pcs
            </span>
          ))}
          {screws.length > 0 && <span>Angka di titik = skrup per sambungan.</span>}
        </div>
      )}
    </div>
  );
}
