import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { miniGames, miniGamePlayers } from "@/db/schema";
import { eq } from "drizzle-orm";

// Fetch a random FC26 player from the external API
async function fetchRandomPlayer() {
  try {
    // Get a random high-profile player (OVR 65+) for more recognizable names
    const minOvr = 65 + Math.floor(Math.random() * 20); // 65-84 range for variety
    const res = await fetch(
      `https://api.msmc.cc/api/eafc/random?game=fc26&gender=m&ovr>${minOvr}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.name) return null;
    return {
      name: data.name as string,
      rating: parseInt(data.ovr || "70"),
      team: (data.team || "Unknown") as string,
      nationality: (data.nation || "Unknown") as string,
      position: (data.position || "?") as string,
      age: (data.age || "?") as string,
      league: (data.league || "Unknown") as string,
      card: (data.card || "") as string,
    };
  } catch {
    return null;
  }
}

// Estimate a player's market value based on their rating
function estimateValue(rating: number): number {
  if (rating >= 90) return (150 + Math.floor(Math.random() * 50)) * 1_000_000;
  if (rating >= 87) return (80 + Math.floor(Math.random() * 40)) * 1_000_000;
  if (rating >= 85) return (40 + Math.floor(Math.random() * 30)) * 1_000_000;
  if (rating >= 82) return (15 + Math.floor(Math.random() * 20)) * 1_000_000;
  if (rating >= 80) return (8 + Math.floor(Math.random() * 10)) * 1_000_000;
  if (rating >= 77) return (3 + Math.floor(Math.random() * 5)) * 1_000_000;
  if (rating >= 74) return (1 + Math.floor(Math.random() * 3)) * 1_000_000;
  return (200 + Math.floor(Math.random() * 800)) * 1_000;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { action, playerId, guess } = await req.json();

    const game = await db.select().from(miniGames).where(eq(miniGames.id, gameId)).limit(1);
    if (game.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const g = game[0];

    // ============ START GAME ============
    if (action === "start") {
      const p = await db.select().from(miniGamePlayers).where(eq(miniGamePlayers.id, playerId)).limit(1);
      if (!p.length || !p[0].isHost) return NextResponse.json({ error: "Host only" }, { status: 403 });

      await db.update(miniGames).set({ status: "playing", currentRound: 0 }).where(eq(miniGames.id, gameId));
      return NextResponse.json({ success: true });
    }

    // ============ NEXT ROUND ============
    if (action === "next_round") {
      const p = await db.select().from(miniGamePlayers).where(eq(miniGamePlayers.id, playerId)).limit(1);
      if (!p.length || !p[0].isHost) return NextResponse.json({ error: "Host only" }, { status: 403 });

      if (g.currentRound >= g.maxRounds) {
        await db.update(miniGames).set({ status: "finished", roundActive: false }).where(eq(miniGames.id, gameId));
        return NextResponse.json({ finished: true });
      }

      const player = await fetchRandomPlayer();
      if (!player) return NextResponse.json({ error: "Failed to fetch a player, try again" }, { status: 500 });

      await db.update(miniGames).set({
        currentRound: g.currentRound + 1,
        currentPlayer: player,
        roundActive: true,
        roundWinner: null,
        cluesRevealed: 0,
        priceGuesses: {},
        priceRevealed: false,
      }).where(eq(miniGames.id, gameId));

      return NextResponse.json({ success: true, round: g.currentRound + 1 });
    }

    // ============ GUESS THE PLAYER: REVEAL CLUE ============
    if (action === "reveal_clue") {
      const p = await db.select().from(miniGamePlayers).where(eq(miniGamePlayers.id, playerId)).limit(1);
      if (!p.length || !p[0].isHost) return NextResponse.json({ error: "Host only" }, { status: 403 });
      if (!g.roundActive) return NextResponse.json({ error: "No active round" }, { status: 400 });
      if (g.cluesRevealed >= 5) return NextResponse.json({ error: "All clues revealed" }, { status: 400 });

      await db.update(miniGames).set({ cluesRevealed: g.cluesRevealed + 1 }).where(eq(miniGames.id, gameId));
      return NextResponse.json({ success: true, cluesRevealed: g.cluesRevealed + 1 });
    }

    // ============ GUESS THE PLAYER: SUBMIT GUESS ============
    if (action === "guess") {
      if (!g.roundActive || g.roundWinner) return NextResponse.json({ error: "Round over" }, { status: 400 });
      if (!guess?.trim()) return NextResponse.json({ error: "Enter a guess" }, { status: 400 });

      const currentPlayer = g.currentPlayer as { name: string } | null;
      if (!currentPlayer) return NextResponse.json({ error: "No player" }, { status: 400 });

      const p = await db.select().from(miniGamePlayers).where(eq(miniGamePlayers.id, playerId)).limit(1);
      if (!p.length) return NextResponse.json({ error: "Player not found" }, { status: 404 });

      // Fuzzy match: lowercase, trim, check if guess is contained in name or vice versa
      const guessLower = guess.trim().toLowerCase();
      const nameLower = currentPlayer.name.toLowerCase();
      const lastName = nameLower.split(" ").pop() || "";

      const isCorrect = nameLower === guessLower ||
        lastName === guessLower ||
        nameLower.includes(guessLower) ||
        guessLower.includes(nameLower);

      if (isCorrect) {
        // Points: 5 for 0 clues, 4 for 1, 3 for 2, etc. Min 1
        const points = Math.max(1, 5 - g.cluesRevealed);
        await db.update(miniGamePlayers).set({ score: p[0].score + points }).where(eq(miniGamePlayers.id, playerId));
        await db.update(miniGames).set({ roundWinner: playerId, roundActive: false }).where(eq(miniGames.id, gameId));
        return NextResponse.json({ correct: true, points, playerName: p[0].name });
      }

      return NextResponse.json({ correct: false });
    }

    // ============ GUESS THE PLAYER: SKIP ROUND ============
    if (action === "skip_round") {
      const p = await db.select().from(miniGamePlayers).where(eq(miniGamePlayers.id, playerId)).limit(1);
      if (!p.length || !p[0].isHost) return NextResponse.json({ error: "Host only" }, { status: 403 });
      await db.update(miniGames).set({ roundActive: false, roundWinner: null }).where(eq(miniGames.id, gameId));
      return NextResponse.json({ success: true });
    }

    // ============ PRICE IS RIGHT: SUBMIT PRICE GUESS ============
    if (action === "price_guess") {
      if (!g.roundActive || g.priceRevealed) return NextResponse.json({ error: "Can't guess now" }, { status: 400 });
      if (typeof guess !== "number" || guess <= 0) return NextResponse.json({ error: "Enter a valid price" }, { status: 400 });

      const p = await db.select().from(miniGamePlayers).where(eq(miniGamePlayers.id, playerId)).limit(1);
      if (!p.length) return NextResponse.json({ error: "Player not found" }, { status: 404 });

      const guesses = { ...((g.priceGuesses as Record<string, number>) || {}), [playerId]: guess };
      await db.update(miniGames).set({ priceGuesses: guesses }).where(eq(miniGames.id, gameId));
      return NextResponse.json({ success: true });
    }

    // ============ PRICE IS RIGHT: REVEAL ANSWER ============
    if (action === "reveal_price") {
      const p = await db.select().from(miniGamePlayers).where(eq(miniGamePlayers.id, playerId)).limit(1);
      if (!p.length || !p[0].isHost) return NextResponse.json({ error: "Host only" }, { status: 403 });
      if (!g.roundActive) return NextResponse.json({ error: "No active round" }, { status: 400 });

      const currentPlayer = g.currentPlayer as { rating: number; name: string } | null;
      if (!currentPlayer) return NextResponse.json({ error: "No player" }, { status: 400 });

      const actualValue = estimateValue(currentPlayer.rating);
      const guesses = (g.priceGuesses as Record<string, number>) || {};

      // Find winner: closest without going over
      const allPlayers = await db.select().from(miniGamePlayers).where(eq(miniGamePlayers.gameId, gameId));
      let winnerId: string | null = null;
      let winnerDiff = Infinity;

      for (const [pid, guessVal] of Object.entries(guesses)) {
        if (guessVal <= actualValue) {
          const diff = actualValue - guessVal;
          if (diff < winnerDiff) {
            winnerDiff = diff;
            winnerId = pid;
          }
        }
      }

      // If nobody was under, closest overall wins (but only 1 point instead of 3)
      let reducedPoints = false;
      if (!winnerId) {
        for (const [pid, guessVal] of Object.entries(guesses)) {
          const diff = Math.abs(actualValue - guessVal);
          if (diff < winnerDiff) {
            winnerDiff = diff;
            winnerId = pid;
          }
        }
        reducedPoints = true;
      }

      if (winnerId) {
        const winner = allPlayers.find(p => p.id === winnerId);
        if (winner) {
          const points = reducedPoints ? 1 : 3;
          await db.update(miniGamePlayers).set({ score: winner.score + points }).where(eq(miniGamePlayers.id, winnerId));
        }
      }

      await db.update(miniGames).set({
        roundActive: false,
        roundWinner: winnerId,
        priceRevealed: true,
      }).where(eq(miniGames.id, gameId));

      return NextResponse.json({ success: true, actualValue, winnerId });
    }

    // ============ FINISH GAME ============
    if (action === "finish") {
      const p = await db.select().from(miniGamePlayers).where(eq(miniGamePlayers.id, playerId)).limit(1);
      if (!p.length || !p[0].isHost) return NextResponse.json({ error: "Host only" }, { status: 403 });
      await db.update(miniGames).set({ status: "finished", roundActive: false }).where(eq(miniGames.id, gameId));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Mini-game action error:", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
