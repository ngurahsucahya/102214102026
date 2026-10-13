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
import type { CalcResult, DoorSpec, HandleZone } from "@/lib/engine/types";

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

export const frameProfiles = pgTable("frame_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  color: text("color").notNull().default("#9ca3af"),
  /** null = ikut panjang batang default. */
  barLength: integer("bar_length"),
  faceWidth: integer("face_width").notNull().default(40),
  screwGroupId: integer("screw_group_id").references(() => screwGroups.id, { onDelete: "set null" }),
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
  remainderFrameProfileId: integer("remainder_frame_profile_id").references(
    (): AnyPgColumn => frameProfiles.id,
    { onDelete: "set null" },
  ),
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
  totalBars: integer("total_bars").notNull(),
  score: real("score").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
