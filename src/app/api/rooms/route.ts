import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rooms, players } from "@/db/schema";
import { v4 as uuid } from "uuid";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// POST - Create a new room
export async function POST(req: NextRequest) {
  try {
    const { hostName, maxPlayers } = await req.json();
    
    if (!hostName || hostName.trim().length === 0) {
      return NextResponse.json({ error: "Host name is required" }, { status: 400 });
    }

    const roomId = uuid();
    const playerId = uuid();
    const code = generateCode();

    await db.insert(rooms).values({
      id: roomId,
      code,
      hostName: hostName.trim(),
      maxPlayers: Math.max(2, Math.min(8, maxPlayers || 4)),
      status: "lobby",
      playerPool: {},
      auctionedPositions: [],
      finesLog: [],
    });

    await db.insert(players).values({
      id: playerId,
      roomId,
      name: hostName.trim(),
      budget: 1000000000,
      lineup: {},
      isHost: true,
      isEliminated: false,
    });

    return NextResponse.json({ roomId, code, playerId });
  } catch (error) {
    console.error("Error creating room:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to create room: ${message}` }, { status: 500 });
  }
}
