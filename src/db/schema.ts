import { pgTable, text, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  hostName: text("host_name").notNull(),
  maxPlayers: integer("max_players").notNull().default(4),
  status: text("status").notNull().default("lobby"), // lobby, setup, auction, finished
  // The host's selected player pool: { position: [opt1, opt2, opt3] }
  playerPool: jsonb("player_pool").$type<Record<string, { name: string; rating: number; team: string; image: string }[]>>(),
  // Current auction state
  currentPosition: text("current_position"),
  currentOptionIndex: integer("current_option_index"),
  currentPrice: integer("current_price"),
  currentHighestBidder: text("current_highest_bidder"),
  currentHighestBid: integer("current_highest_bid"),
  auctionActive: boolean("auction_active").notNull().default(false),
  // Wheel spin state
  wheelSpinning: boolean("wheel_spinning").notNull().default(false),
  wheelResult: jsonb("wheel_result").$type<{ position: string; optionIndex: number } | null>(),
  // Positions already auctioned
  auctionedPositions: jsonb("auctioned_positions").$type<string[]>().default([]),
  // Fines log
  finesLog: jsonb("fines_log").$type<{ playerId: string; amount: number; reason: string; timestamp: number }[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const players = pgTable("players", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id),
  name: text("name").notNull(),
  budget: integer("budget").notNull().default(1000000000),
  // Their lineup: { position: { name, rating, team, image, pricePaid } }
  lineup: jsonb("lineup").$type<Record<string, { name: string; rating: number; team: string; image: string; pricePaid: number }>>().default({}),
  isHost: boolean("is_host").notNull().default(false),
  isEliminated: boolean("is_eliminated").notNull().default(false),
  joinedAt: timestamp("joined_at").defaultNow(),
});
