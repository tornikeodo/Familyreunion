export interface PlayerData {
  name: string;
  rating: number;
  team: string;
  image: string;
  pricePaid?: number;
}

export interface BidEntry {
  playerId: string;
  playerName: string;
  amount: number;
  timestamp: number;
}

export interface RoomState {
  id: string;
  code: string;
  hostName: string;
  maxPlayers: number;
  status: string;
  playerPool: Record<string, PlayerData[]> | null;
  currentPosition: string | null;
  currentOptionIndex: number | null;
  currentPrice: number | null;
  currentHighestBidder: string | null;
  currentHighestBid: number | null;
  auctionActive: boolean;
  wheelSpinning: boolean;
  wheelResult: { position: string; optionIndex: number } | null;
  auctionedPositions: string[];
  finesLog: { playerId: string; amount: number; reason: string; timestamp: number }[];
  bidHistory: BidEntry[];
  auctionStartedAt: number | null;
  lastBidAt: number | null;
}

export interface GamePlayer {
  id: string;
  roomId: string;
  name: string;
  budget: number;
  lineup: Record<string, PlayerData & { pricePaid: number }>;
  isHost: boolean;
  isEliminated: boolean;
}
