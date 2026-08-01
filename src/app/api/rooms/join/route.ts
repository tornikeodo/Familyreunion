import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms, players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

// POST - Join a room by code
export async function POST(req: NextRequest) {
  try {
    const { code, playerName } = await req.json();

    if (!code || !playerName || playerName.trim().length === 0) {
      return NextResponse.json({ error: "Code and name are required" }, { status: 400 });
    }

    const room = await db.select().from(rooms).where(eq(rooms.code, code.toUpperCase())).limit(1);
    if (room.length === 0) {
      return NextResponse.json({ error: "Room not found. Check the code!" }, { status: 404 });
    }

    const r = room[0];
    if (r.status !== "lobby") {
      return NextResponse.json({ error: "This game has already started!" }, { status: 400 });
    }

    const existingPlayers = await db.select().from(players).where(eq(players.roomId, r.id));
    if (existingPlayers.length >= r.maxPlayers) {
      return NextResponse.json({ error: "Room is full!" }, { status: 400 });
    }

    const nameExists = existingPlayers.some(
      (p) => p.name.toLowerCase() === playerName.trim().toLowerCase()
    );
    if (nameExists) {
      return NextResponse.json({ error: "Someone already has that name!" }, { status: 400 });
    }

    const playerId = uuid();
    await db.insert(players).values({
      id: playerId,
      roomId: r.id,
      name: playerName.trim(),
      budget: 1000000000,
      lineup: {},
      isHost: false,
      isEliminated: false,
    });

    return NextResponse.json({ roomId: r.id, playerId, code: r.code });
  } catch (error) {
    console.error("Error joining room:", error);
    return NextResponse.json({ error: "Failed to join room" }, { status: 500 });
  }
}
