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

    // Determine available positions (ones that haven't been fully auctioned)
    const auctioned = (r.auctionedPositions as string[]) || [];
    const pool = r.playerPool as Record<string, { name: string; rating: number; team: string; image: string }[]>;
    
    // Build list of available spins: position + option index combos not yet auctioned
    const availableSpins: { position: string; optionIndex: number }[] = [];
    
    for (const pos of POSITIONS) {
      const posOptions = pool[pos];
      if (!posOptions) continue;
      for (let i = 0; i < posOptions.length; i++) {
        const key = `${pos}-${i}`;
        if (!auctioned.includes(key)) {
          availableSpins.push({ position: pos, optionIndex: i });
        }
      }
    }

    if (availableSpins.length === 0) {
      // All positions auctioned - game over
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

    // After a brief period, mark spinning as done (client handles animation)
    return NextResponse.json({ result: chosen, availableCount: availableSpins.length });
  } catch (error) {
    console.error("Error spinning wheel:", error);
    return NextResponse.json({ error: "Failed to spin" }, { status: 500 });
  }
}
