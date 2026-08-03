import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { miniGames, miniGamePlayers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const game = await db.select().from(miniGames).where(eq(miniGames.id, gameId)).limit(1);
    if (game.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const players = await db.select().from(miniGamePlayers).where(eq(miniGamePlayers.gameId, gameId));
    return NextResponse.json({ game: game[0], players });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
