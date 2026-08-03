import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { eq } from "drizzle-orm";

// POST - Save player pool and start auction
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { playerPool, playerId } = await req.json();

    // Verify the room exists and player is host
    const room = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
    if (room.length === 0) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Verify host
    const { players: playersTable } = await import("@/db/schema");
    const player = await db.select().from(playersTable).where(eq(playersTable.id, playerId)).limit(1);
    if (player.length === 0 || !player[0].isHost) {
      return NextResponse.json({ error: "Only the host can set up the game" }, { status: 403 });
    }

    await db.update(rooms).set({
      playerPool,
      status: "auction",
    }).where(eq(rooms.id, roomId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting up game:", error);
    return NextResponse.json({ error: "Failed to set up game" }, { status: 500 });
  }
}
