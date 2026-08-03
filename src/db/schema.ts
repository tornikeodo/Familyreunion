import { pgTable, text, integer, jsonb, timestamp, boolean, bigint } from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  hostName: text("host_name").notNull(),
  maxPlayers: integer("max_players").notNull().default(4),
  status: text("status").notNull().default("lobby"),
  playerPool: jsonb("player_pool").$type<Record<string, { name: string; rating: number; team: string; image: string }[]>>(),
  currentPosition: text("current_position"),
  currentOptionIndex: integer("current_option_index"),
  currentPrice: integer("current_price"),
  currentHighestBidder: text("current_highest_bidder"),
  currentHighestBid: integer("current_highest_bid"),
  auctionActive: boolean("auction_active").notNull().default(false),
  wheelSpinning: boolean("wheel_spinning").notNull().default(false),
  wheelResult: jsonb("wheel_result").$type<{ position: string; optionIndex: number } | null>(),
  auctionedPositions: jsonb("auctioned_positions").$type<string[]>().default([]),
  finesLog: jsonb("fines_log").$type<{ playerId: string; amount: number; reason: string; timestamp: number }[]>().default([]),
  // Bid history for the current auction
  bidHistory: jsonb("bid_history").$type<{ playerId: string; playerName: string; amount: number; timestamp: number }[]>().default([]),
  // Auction timer: when the auction started (epoch ms)
  auctionStartedAt: bigint("auction_started_at", { mode: "number" }),
  // Last bid timestamp for cooldown
  lastBidAt: bigint("last_bid_at", { mode: "number" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Mini-games: Guess the Player & Price is Right
export const miniGames = pgTable("mini_games", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  hostName: text("host_name").notNull(),
  gameType: text("game_type").notNull(), // "guess" or "price"
  status: text("status").notNull().default("lobby"), // lobby, playing, finished
  maxRounds: integer("max_rounds").notNull().default(10),
  currentRound: integer("current_round").notNull().default(0),
  // Current round state (the player being guessed / priced)
  currentPlayer: jsonb("current_player").$type<{
    name: string; rating: number; team: string; nationality: string;
    position: string; age: string; league: string; card: string;
  } | null>(),
  // For Guess: which clues have been revealed (0-4)
  cluesRevealed: integer("clues_revealed").notNull().default(0),
  // Has the round been answered/completed
  roundActive: boolean("round_active").notNull().default(false),
  roundWinner: text("round_winner"), // playerId who won this round
  // For Price is Right: everyone's guesses for current round
  priceGuesses: jsonb("price_guesses").$type<Record<string, number>>().default({}),
  priceRevealed: boolean("price_revealed").notNull().default(false),
  // For Who Am I: secret player assignment per playerId. API hides your own player from you.
  secretPlayers: jsonb("secret_players").$type<Record<string, {
    name: string; rating: number; team: string; nationality: string;
    position: string; age: string; league: string; card: string;
  }>>().default({}),
  questionLog: jsonb("question_log").$type<{ playerId: string; playerName: string; question: string; answer: "yes" | "no" | "maybe"; timestamp: number }[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const miniGamePlayers = pgTable("mini_game_players", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull().references(() => miniGames.id),
  name: text("name").notNull(),
  score: integer("score").notNull().default(0),
  isHost: boolean("is_host").notNull().default(false),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Video clips from Medal.tv
export const clips = pgTable("clips", {
  id: text("id").primaryKey(),
  url: text("url").notNull(), // medal.tv URL
  title: text("title").notNull(),
  author: text("author").notNull(),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const players = pgTable("players", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id),
  name: text("name").notNull(),
  budget: integer("budget").notNull().default(1000000000),
  lineup: jsonb("lineup").$type<Record<string, { name: string; rating: number; team: string; image: string; pricePaid: number }>>().default({}),
  isHost: boolean("is_host").notNull().default(false),
  isEliminated: boolean("is_eliminated").notNull().default(false),
  joinedAt: timestamp("joined_at").defaultNow(),
});
