import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { miniGames, miniGamePlayers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const url = new URL(req.url);
    const viewerId = url.searchParams.get("playerId");

    const game = await db.select().from(miniGames).where(eq(miniGames.id, gameId)).limit(1);
    if (game.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const players = await db.select().from(miniGamePlayers).where(eq(miniGamePlayers.gameId, gameId));
    const safeGame: Record<string, unknown> = { ...game[0] };

    if (game[0].gameType === "whoami" && viewerId && game[0].secretPlayers) {
      const hidden = { ...(game[0].secretPlayers as Record<string, unknown>) };
      if (hidden[viewerId]) hidden[viewerId] = null;
      safeGame.secretPlayers = hidden;
    }

    return NextResponse.json({ game: safeGame, players });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
