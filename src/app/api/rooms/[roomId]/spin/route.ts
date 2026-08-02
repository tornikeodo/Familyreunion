import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms, players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { POSITIONS } from "@/data/fifa-players";

// POST - Spin the wheel
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
      return NextResponse.json({ finished: true });
    }

    // Check if all active players have a full lineup (11 positions)
    const allComplete = activePlayers.every(p => {
      const lineup = (p.lineup || {}) as Record<string, unknown>;
      return Object.keys(lineup).length >= 11;
    });

    if (allComplete) {
      await db.update(rooms).set({ status: "finished" }).where(eq(rooms.id, roomId));
      return NextResponse.json({ finished: true });
    }

    // Build available spins from the pool: position + option index combos
    // A combo can be re-used if at least one player still needs that position
    const pool = r.playerPool as Record<string, { name: string; rating: number; team: string; image: string }[]>;
    const availableSpins: { position: string; optionIndex: number }[] = [];

    for (const pos of POSITIONS) {
      const posOptions = pool[pos];
      if (!posOptions) continue;

      // Check if at least one active player still needs this position
      const someoneNeedsIt = activePlayers.some(p => {
        const lineup = (p.lineup || {}) as Record<string, unknown>;
        return !lineup[pos];
      });

      if (!someoneNeedsIt) continue;

      // Add all option indices for this position
      for (let i = 0; i < posOptions.length; i++) {
        availableSpins.push({ position: pos, optionIndex: i });
      }
    }

    if (availableSpins.length === 0) {
      await db.update(rooms).set({ status: "finished" }).where(eq(rooms.id, roomId));
      return NextResponse.json({ finished: true });
    }

    // Randomly pick one
    const chosen = availableSpins[Math.floor(Math.random() * availableSpins.length)];

    await db.update(rooms).set({
      wheelSpinning: true,
      wheelResult: chosen,
      currentPosition: chosen.position,
      currentOptionIndex: chosen.optionIndex,
      currentPrice: null,
      currentHighestBidder: null,
      currentHighestBid: null,
      auctionActive: false,
    }).where(eq(rooms.id, roomId));

    return NextResponse.json({ result: chosen, availableCount: availableSpins.length });
  } catch (error) {
    console.error("Error spinning wheel:", error);
    return NextResponse.json({ error: "Failed to spin" }, { status: 500 });
  }
}
