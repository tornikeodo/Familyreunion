import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms, players } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// POST - Rejoin a room by code + name
export async function POST(req: NextRequest) {
  try {
    const { code, playerName } = await req.json();

    if (!code || !playerName) {
      return NextResponse.json({ error: "Code and name are required" }, { status: 400 });
    }

    const room = await db.select().from(rooms).where(eq(rooms.code, code.toUpperCase())).limit(1);
    if (room.length === 0) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const r = room[0];

    // Find the player by name in this room
    const allPlayers = await db.select().from(players).where(eq(players.roomId, r.id));
    const existing = allPlayers.find(p => p.name.toLowerCase() === playerName.trim().toLowerCase());

    if (!existing) {
      return NextResponse.json({ error: "No player with that name in this room" }, { status: 404 });
    }

    return NextResponse.json({ roomId: r.id, playerId: existing.id, code: r.code });
  } catch (error) {
    console.error("Error rejoining:", error);
    return NextResponse.json({ error: "Failed to rejoin" }, { status: 500 });
  }
}
