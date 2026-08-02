import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms, players } from "@/db/schema";
import { eq } from "drizzle-orm";

// POST - Fine a player
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { hostPlayerId, targetPlayerId, amount, reason } = await req.json();

    // Verify host
    const host = await db.select().from(players).where(eq(players.id, hostPlayerId)).limit(1);
    if (host.length === 0 || !host[0].isHost) {
      return NextResponse.json({ error: "Only the host can fine players" }, { status: 403 });
    }

    const target = await db.select().from(players).where(eq(players.id, targetPlayerId)).limit(1);
    if (target.length === 0) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const t = target[0];
    const newBudget = Math.max(0, t.budget - amount);

    await db.update(players).set({
      budget: newBudget,
      isEliminated: newBudget <= 0,
    }).where(eq(players.id, targetPlayerId));

    // Add to fines log
    const room = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
    if (room.length > 0) {
      const existingFines = (room[0].finesLog || []) as { playerId: string; amount: number; reason: string; timestamp: number }[];
      existingFines.push({ playerId: targetPlayerId, amount, reason: reason || "Fine", timestamp: Date.now() });
      await db.update(rooms).set({ finesLog: existingFines }).where(eq(rooms.id, roomId));
    }

    return NextResponse.json({ success: true, newBudget });
  } catch (error) {
    console.error("Error fining player:", error);
    return NextResponse.json({ error: "Failed to fine player" }, { status: 500 });
  }
}
