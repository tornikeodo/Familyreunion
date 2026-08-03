import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { miniGames, miniGamePlayers } from "@/db/schema";
import { v4 as uuid } from "uuid";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function POST(req: NextRequest) {
  try {
    const { hostName, gameType, maxRounds } = await req.json();
    if (!hostName?.trim() || !gameType) {
      return NextResponse.json({ error: "Name and game type required" }, { status: 400 });
    }

    const gameId = uuid();
    const playerId = uuid();
    const code = generateCode();

    await db.insert(miniGames).values({
      id: gameId,
      code,
      hostName: hostName.trim(),
      gameType,
      status: "lobby",
      maxRounds: Math.max(3, Math.min(20, maxRounds || 10)),
      currentRound: 0,
      cluesRevealed: 0,
      roundActive: false,
      priceGuesses: {},
      priceRevealed: false,
    });

    await db.insert(miniGamePlayers).values({
      id: playerId,
      gameId,
      name: hostName.trim(),
      score: 0,
      isHost: true,
    });

    return NextResponse.json({ gameId, code, playerId });
  } catch (error) {
    console.error("Error creating mini-game:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed: ${msg}` }, { status: 500 });
  }
}
