import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type {
  BulkItem,
  BulkResult,
  CalcResult,
  DoorSpec,
  FrameProfile,
  HandleProfile,
  HandleZone,
  MaterialCategory,
} from "@/lib/engine/types";

export const roleEnum = pgEnum("role", ["admin", "field"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("field"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Satu baris saja (id = 1). */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  defaultBarLength: integer("default_bar_length").notNull().default(3000),
  kerf: real("kerf").notNull().default(4),
  endTrim: integer("end_trim").notNull().default(0),
  minUsableOffcut: integer("min_usable_offcut").notNull().default(300),
  glassInset: real("glass_inset").notNull().default(0),
});

/**
 * Katalog material (dari daftar barang MUROVA): harga, satuan, dan minimal beli untuk BOM.
 * Glass deduction dan intersection cutback dipakai kalau material ini profil batang.
 */
export const materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  sku: text("sku").unique(),
  code: text("code"),
  name: text("name").notNull(),
  category: text("category").$type<MaterialCategory>().notNull().default("lainnya"),
  unit: text("unit").notNull().default("pcs"),
  /** Minimal beli sekaligus kelipatan beli. */
  minPurchase: real("min_purchase").notNull().default(1),
  /** Harga per satuan (Rp). */
  price: real("price").notNull().default(0),
  usagePerPoint: real("usage_per_point").notNull().default(1),
  glassDeduction: real("glass_deduction").notNull().default(0),
  intersectionCutback: real("intersection_cutback").notNull().default(0),
  /** Catatan kemasan pabrik, mis. "1 CASE = 10 PC". */
  note: text("note"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

const materialRef = () => integer("material_id").references((): AnyPgColumn => materials.id, { onDelete: "set null" });

/** Kelompok skrup: jenis dan jumlah per sudut frame dan per ujung divider. */
export const screwGroups = pgTable("screw_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cornerType: text("corner_type").notNull().default(""),
  cornerQty: integer("corner_qty").notNull().default(0),
  jointType: text("joint_type").notNull().default(""),
  jointQty: integer("joint_qty").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Jenis engsel untuk pintu swing. */
export const hingeTypes = pgTable("hinge_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  /** Tinggi daun engsel (mm). */
  length: integer("length").notNull().default(100),
  materialId: materialRef(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const frameProfiles = pgTable("frame_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  color: text("color").notNull().default("#9ca3af"),
  /** null = ikut panjang batang default. */
  barLength: integer("bar_length"),
  faceWidth: integer("face_width").notNull().default(40),
  screwGroupId: integer("screw_group_id").references(() => screwGroups.id, { onDelete: "set null" }),
  materialId: materialRef(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const handleProfiles = pgTable("handle_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  color: text("color").notNull().default("#374151"),
  barLength: integer("bar_length"),
  faceWidth: integer("face_width").notNull().default(45),
  screwGroupId: integer("screw_group_id").references(() => screwGroups.id, { onDelete: "set null" }),
  zones: jsonb("zones").$type<HandleZone[]>().notNull().default([]),
  materialId: materialRef(),
  remainderFrameProfileId: integer("remainder_frame_profile_id").references((): AnyPgColumn => frameProfiles.id, {
    onDelete: "set null",
  }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const calculations = pgTable("calculations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  label: text("label"),
  spec: jsonb("spec").$type<DoorSpec>().notNull(),
  result: jsonb("result").$type<CalcResult>().notNull(),
  /** Salinan profil saat dihitung, supaya gambar riwayat tidak berubah kalau master diubah. */
  frame: jsonb("frame").$type<FrameProfile>(),
  handle: jsonb("handle").$type<HandleProfile>(),
  totalBars: integer("total_bars").notNull(),
  score: real("score").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Beberapa pintu yang dihitung bersama dalam satu pembelian (bulk). */
export const bulkCalculations = pgTable("bulk_calculations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  label: text("label"),
  items: jsonb("items").$type<BulkItem[]>().notNull(),
  result: jsonb("result").$type<BulkResult>().notNull(),
  /** Salinan profil yang dipakai, supaya gambar riwayat tidak berubah kalau master diubah. */
  profiles: jsonb("profiles").$type<{ frames: FrameProfile[]; handles: HandleProfile[] }>(),
  totalBars: integer("total_bars").notNull(),
  separateBars: integer("separate_bars").notNull(),
  score: real("score").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
