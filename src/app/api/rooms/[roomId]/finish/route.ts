import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms, players } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { playerId } = await req.json();

    const host = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    if (host.length === 0 || !host[0].isHost) {
      return NextResponse.json({ error: "Only the host can end the game" }, { status: 403 });
    }

    await db.update(rooms).set({ status: "finished" }).where(eq(rooms.id, roomId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error finishing game:", error);
    return NextResponse.json({ error: "Failed to finish game" }, { status: 500 });
  }
}
