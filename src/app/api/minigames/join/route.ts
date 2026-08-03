import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { miniGames, miniGamePlayers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const { code, playerName } = await req.json();
    if (!code || !playerName?.trim()) {
      return NextResponse.json({ error: "Code and name required" }, { status: 400 });
    }

    const game = await db.select().from(miniGames).where(eq(miniGames.code, code.toUpperCase())).limit(1);
    if (game.length === 0) return NextResponse.json({ error: "Game not found" }, { status: 404 });

    const g = game[0];
    if (g.status !== "lobby") return NextResponse.json({ error: "Game already started" }, { status: 400 });

    const existing = await db.select().from(miniGamePlayers).where(eq(miniGamePlayers.gameId, g.id));
    if (existing.some(p => p.name.toLowerCase() === playerName.trim().toLowerCase())) {
      return NextResponse.json({ error: "Name taken" }, { status: 400 });
    }

    const playerId = uuid();
    await db.insert(miniGamePlayers).values({
      id: playerId, gameId: g.id, name: playerName.trim(), score: 0, isHost: false,
    });

    return NextResponse.json({ gameId: g.id, playerId, code: g.code, gameType: g.gameType });
  } catch (error) {
    console.error("Error joining mini-game:", error);
    return NextResponse.json({ error: "Failed to join" }, { status: 500 });
  }
}
