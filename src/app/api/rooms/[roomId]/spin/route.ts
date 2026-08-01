import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms, players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { POSITIONS } from "@/data/fifa-players";

// POST - Spin the wheel - picks a position that at least one player still needs
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { playerId } = await req.json();

    const room = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
    if (room.length === 0) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const r = room[0];

    // Verify host
    const player = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    if (player.length === 0 || !player[0].isHost) {
      return NextResponse.json({ error: "Only the host can spin" }, { status: 403 });
    }

    if (r.auctionActive) {
      return NextResponse.json({ error: "An auction is already active!" }, { status: 400 });
    }

    // Get all non-host, non-eliminated players
    const allPlayers = await db.select().from(players).where(eq(players.roomId, roomId));
    const activePlayers = allPlayers.filter(p => !p.isHost && !p.isEliminated);

    if (activePlayers.length === 0) {
      await db.update(rooms).set({ status: "finished" }).where(eq(rooms.id, roomId));
      return NextResponse.json({ finished: true, reason: "No active players" });
    }

    // Check which positions are still needed by at least one player
    const neededPositions: string[] = [];
    
    for (const pos of POSITIONS) {
      // Check if any active player still needs this position
      const someoneNeedsIt = activePlayers.some(p => {
        const lineup = (p.lineup || {}) as Record<string, unknown>;
        return !lineup[pos];
      });
      
      if (someoneNeedsIt) {
        neededPositions.push(pos);
      }
    }

    // Check if all players have complete lineups (11 positions filled)
    const allComplete = activePlayers.every(p => {
      const lineup = (p.lineup || {}) as Record<string, unknown>;
      return Object.keys(lineup).length >= 11;
    });

    if (allComplete || neededPositions.length === 0) {
      // All players have complete lineups - game finished!
      await db.update(rooms).set({ status: "finished" }).where(eq(rooms.id, roomId));
      return NextResponse.json({ finished: true, reason: "All teams complete" });
    }

    // Randomly pick a position that someone still needs
    const chosenPosition = neededPositions[Math.floor(Math.random() * neededPositions.length)];

    // Update room state with the spin result
    await db.update(rooms).set({
      wheelSpinning: true,
      wheelResult: { position: chosenPosition, optionIndex: 0 },
      currentPosition: chosenPosition,
      currentOptionIndex: 0,
      currentPrice: null,
      currentHighestBidder: null,
      currentHighestBid: null,
      auctionActive: false,
    }).where(eq(rooms.id, roomId));

    // Count how many positions are still needed across all players
    let totalNeeded = 0;
    for (const p of activePlayers) {
      const lineup = (p.lineup || {}) as Record<string, unknown>;
      totalNeeded += 11 - Object.keys(lineup).length;
    }

    return NextResponse.json({ 
      result: { position: chosenPosition, optionIndex: 0 },
      neededPositions,
      totalNeeded,
      playersRemaining: activePlayers.length
    });
  } catch (error) {
    console.error("Error spinning wheel:", error);
    return NextResponse.json({ error: "Failed to spin" }, { status: 500 });
  }
}
