import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms, players } from "@/db/schema";
import { eq } from "drizzle-orm";

// POST - Start auction with a price, place a bid, or close auction
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { action, playerId, amount, selectedPlayer } = await req.json();

    const room = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
    if (room.length === 0) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const r = room[0];

    if (action === "start") {
      // Host starts the auction with a starting price and selected player
      const player = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
      if (player.length === 0 || !player[0].isHost) {
        return NextResponse.json({ error: "Only the host can start auctions" }, { status: 403 });
      }

      if (!amount || amount < 0) {
        return NextResponse.json({ error: "Invalid starting price" }, { status: 400 });
      }

      if (!selectedPlayer || !selectedPlayer.name) {
        return NextResponse.json({ error: "Please select a player to auction" }, { status: 400 });
      }

      // Store the selected player in the playerPool for this position
      const currentPool = (r.playerPool || {}) as Record<string, { name: string; rating: number; team: string; image: string }[]>;
      const pos = r.currentPosition!;
      
      // Add the selected player to the pool
      currentPool[pos] = [{
        name: selectedPlayer.name,
        rating: selectedPlayer.rating,
        team: selectedPlayer.team,
        image: "",
      }];

      await db.update(rooms).set({
        auctionActive: true,
        wheelSpinning: false,
        currentPrice: amount,
        currentHighestBid: amount,
        currentHighestBidder: null,
        playerPool: currentPool,
        currentOptionIndex: 0,
      }).where(eq(rooms.id, roomId));

      return NextResponse.json({ success: true });
    }

    if (action === "bid") {
      // Player places a bid
      if (!r.auctionActive) {
        return NextResponse.json({ error: "No active auction" }, { status: 400 });
      }

      const bidder = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
      if (bidder.length === 0) {
        return NextResponse.json({ error: "Player not found" }, { status: 404 });
      }

      const b = bidder[0];

      if (b.isEliminated) {
        return NextResponse.json({ error: "You've been eliminated!" }, { status: 400 });
      }

      // Check if player already has this position filled
      const currentPos = r.currentPosition!;
      const lineup = (b.lineup || {}) as Record<string, { name: string; rating: number; team: string; image: string; pricePaid: number }>;
      if (lineup[currentPos]) {
        return NextResponse.json({ error: "You already have a player for this position!" }, { status: 400 });
      }

      // Check budget
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

      await db.update(rooms).set({
        currentHighestBid: amount,
        currentHighestBidder: playerId,
      }).where(eq(rooms.id, roomId));

      return NextResponse.json({ success: true });
    }

    if (action === "close") {
      // Host closes the auction - winner gets the player
      const host = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
      if (host.length === 0 || !host[0].isHost) {
        return NextResponse.json({ error: "Only the host can close auctions" }, { status: 403 });
      }

      if (!r.auctionActive) {
        return NextResponse.json({ error: "No active auction" }, { status: 400 });
      }

      const pool = r.playerPool as Record<string, { name: string; rating: number; team: string; image: string }[]>;
      const pos = r.currentPosition!;
      const optIdx = r.currentOptionIndex ?? 0;
      const auctionedPlayer = pool[pos]?.[optIdx];

      if (r.currentHighestBidder && auctionedPlayer) {
        const winner = await db.select().from(players).where(eq(players.id, r.currentHighestBidder)).limit(1);
        if (winner.length > 0) {
          const w = winner[0];
          const newBudget = w.budget - r.currentHighestBid!;
          const existingLineup = (w.lineup || {}) as Record<string, { name: string; rating: number; team: string; image: string; pricePaid: number }>;
          const newLineup: Record<string, { name: string; rating: number; team: string; image: string; pricePaid: number }> = { 
            ...existingLineup, 
            [pos]: { ...auctionedPlayer, pricePaid: r.currentHighestBid! } 
          };

          if (newBudget < 0) {
            // Player is eliminated
            await db.update(players).set({
              isEliminated: true,
              budget: 0,
            }).where(eq(players.id, w.id));
          } else {
            await db.update(players).set({
              budget: newBudget,
              lineup: newLineup,
            }).where(eq(players.id, w.id));
          }
        }
      }

      // Reset auction state for next spin
      await db.update(rooms).set({
        auctionActive: false,
        currentHighestBidder: null,
        currentHighestBid: null,
        currentPrice: null,
        currentPosition: null,
        currentOptionIndex: null,
        wheelResult: null,
      }).where(eq(rooms.id, roomId));

      return NextResponse.json({ success: true, winner: r.currentHighestBidder });
    }

    if (action === "skip") {
      // Host skips (no bids or no player selected)
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
      }).where(eq(rooms.id, roomId));

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in auction:", error);
    return NextResponse.json({ error: "Auction action failed" }, { status: 500 });
  }
}
