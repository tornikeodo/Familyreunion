import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms, players } from "@/db/schema";
import { eq } from "drizzle-orm";

const BID_COOLDOWN_MS = 4000; // 4 second cooldown after each bid

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { action, playerId, amount } = await req.json();

    const room = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
    if (room.length === 0) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const r = room[0];

    if (action === "start") {
      const player = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
      if (player.length === 0 || !player[0].isHost) {
        return NextResponse.json({ error: "Only the host can start auctions" }, { status: 403 });
      }
      if (!amount || amount < 0) {
        return NextResponse.json({ error: "Invalid starting price" }, { status: 400 });
      }

      const now = Date.now();
      await db.update(rooms).set({
        auctionActive: true,
        wheelSpinning: false,
        currentPrice: amount,
        currentHighestBid: amount,
        currentHighestBidder: null,
        bidHistory: [],
        auctionStartedAt: now,
        lastBidAt: now,
      }).where(eq(rooms.id, roomId));

      return NextResponse.json({ success: true });
    }

    if (action === "bid") {
      if (!r.auctionActive) {
        return NextResponse.json({ error: "No active auction" }, { status: 400 });
      }

      // Check bid cooldown
      const now = Date.now();
      const lastBid = r.lastBidAt || 0;
      const timeSinceLastBid = now - lastBid;
      if (timeSinceLastBid < BID_COOLDOWN_MS) {
        const remaining = Math.ceil((BID_COOLDOWN_MS - timeSinceLastBid) / 1000);
        return NextResponse.json({ error: `Wait ${remaining}s before bidding (cooldown)` }, { status: 400 });
      }

      const bidder = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
      if (bidder.length === 0) {
        return NextResponse.json({ error: "Player not found" }, { status: 404 });
      }

      const b = bidder[0];

      if (b.isEliminated) {
        return NextResponse.json({ error: "You've been eliminated!" }, { status: 400 });
      }
      if (b.isHost) {
        return NextResponse.json({ error: "Host can't bid" }, { status: 400 });
      }

      const currentPos = r.currentPosition!;
      const lineup = (b.lineup || {}) as Record<string, { name: string; rating: number; team: string; image: string; pricePaid: number }>;
      if (lineup[currentPos]) {
        return NextResponse.json({ error: "You already have a player for this position!" }, { status: 400 });
      }

      if (amount > b.budget) {
        return NextResponse.json({ error: "You can't afford that bid!" }, { status: 400 });
      }
      if (amount <= 0) {
        return NextResponse.json({ error: "Bid must be positive!" }, { status: 400 });
      }

      const currentHighest = r.currentHighestBid || 0;
      if (amount <= currentHighest) {
        return NextResponse.json({ error: `Bid must be higher than ${currentHighest.toLocaleString()}` }, { status: 400 });
      }

      // Add to bid history
      const history = [...((r.bidHistory as { playerId: string; playerName: string; amount: number; timestamp: number }[]) || [])];
      history.push({
        playerId,
        playerName: b.name,
        amount,
        timestamp: now,
      });

      await db.update(rooms).set({
        currentHighestBid: amount,
        currentHighestBidder: playerId,
        bidHistory: history,
        lastBidAt: now,
        auctionStartedAt: now, // Reset timer on each bid
      }).where(eq(rooms.id, roomId));

      return NextResponse.json({ success: true });
    }

    if (action === "close") {
      const host = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
      if (host.length === 0 || !host[0].isHost) {
        return NextResponse.json({ error: "Only the host can close auctions" }, { status: 403 });
      }
      if (!r.auctionActive) {
        return NextResponse.json({ error: "No active auction" }, { status: 400 });
      }

      const pool = r.playerPool as Record<string, { name: string; rating: number; team: string; image: string }[]>;
      const pos = r.currentPosition!;
      const optIdx = r.currentOptionIndex!;
      const auctionedPlayer = pool[pos]?.[optIdx];

      let winnerName: string | null = null;

      if (r.currentHighestBidder && auctionedPlayer) {
        const winner = await db.select().from(players).where(eq(players.id, r.currentHighestBidder)).limit(1);
        if (winner.length > 0) {
          const w = winner[0];
          winnerName = w.name;
          const newBudget = w.budget - r.currentHighestBid!;
          const existingLineup = (w.lineup || {}) as Record<string, { name: string; rating: number; team: string; image: string; pricePaid: number }>;
          const newLineup: Record<string, { name: string; rating: number; team: string; image: string; pricePaid: number }> = {
            ...existingLineup,
            [pos]: { ...auctionedPlayer, pricePaid: r.currentHighestBid! }
          };

          if (newBudget < 0) {
            await db.update(players).set({ isEliminated: true, budget: 0 }).where(eq(players.id, w.id));
          } else {
            await db.update(players).set({ budget: newBudget, lineup: newLineup }).where(eq(players.id, w.id));
          }
        }
      }

      await db.update(rooms).set({
        auctionActive: false,
        currentHighestBidder: null,
        currentHighestBid: null,
        currentPrice: null,
        currentPosition: null,
        currentOptionIndex: null,
        wheelResult: null,
        bidHistory: [],
        auctionStartedAt: null,
        lastBidAt: null,
      }).where(eq(rooms.id, roomId));

      return NextResponse.json({ success: true, winner: r.currentHighestBidder, winnerName });
    }

    if (action === "skip") {
      const host = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
      if (host.length === 0 || !host[0].isHost) {
        return NextResponse.json({ error: "Only the host can skip" }, { status: 403 });
      }

      await db.update(rooms).set({
        auctionActive: false,
        currentHighestBidder: null,
        currentHighestBid: null,
        currentPrice: null,
        currentPosition: null,
        currentOptionIndex: null,
        wheelResult: null,
        bidHistory: [],
        auctionStartedAt: null,
        lastBidAt: null,
      }).where(eq(rooms.id, roomId));

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in auction:", error);
    return NextResponse.json({ error: "Auction action failed" }, { status: 500 });
  }
}
