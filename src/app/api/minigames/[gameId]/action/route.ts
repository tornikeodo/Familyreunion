import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { miniGames, miniGamePlayers } from "@/db/schema";
import { eq } from "drizzle-orm";

type ApiPlayer = { name: string; rating: number; team: string; nationality: string; position: string; age: string; league: string; card: string };

async function fetchRandomPlayer(): Promise<ApiPlayer | null> {
  try {
    const minOvr = 65 + Math.floor(Math.random() * 20);
    const res = await fetch(`https://api.msmc.cc/api/eafc/random?game=fc26&gender=m&ovr>${minOvr}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.name) return null;
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

function fuzzyMatch(guess: string, name: string) {
  const guessLower = guess.trim().toLowerCase();
  const nameLower = name.toLowerCase();
  const lastName = nameLower.split(" ").pop() || "";
  return nameLower === guessLower || lastName === guessLower || nameLower.includes(guessLower) || guessLower.includes(nameLower);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ gameId: string }> }) {
  try {
    const { gameId } = await params;
    const { action, playerId, guess, question, answer } = await req.json();

    const game = await db.select().from(miniGames).where(eq(miniGames.id, gameId)).limit(1);
    if (game.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const g = game[0];

    const actingPlayer = await db.select().from(miniGamePlayers).where(eq(miniGamePlayers.id, playerId)).limit(1);
    const actor = actingPlayer[0];

    if (action === "start") {
      if (!actor?.isHost) return NextResponse.json({ error: "Host only" }, { status: 403 });

      if (g.gameType === "whoami") {
        const allPlayers = await db.select().from(miniGamePlayers).where(eq(miniGamePlayers.gameId, gameId));
        const nonHosts = allPlayers.filter(p => !p.isHost);
        const assignments: Record<string, ApiPlayer> = {};
        const used = new Set<string>();

        for (const p of nonHosts) {
          let secret: ApiPlayer | null = null;
          for (let tries = 0; tries < 8; tries++) {
            const candidate = await fetchRandomPlayer();
            if (candidate && !used.has(candidate.name)) {
              secret = candidate;
              used.add(candidate.name);
              break;
            }
          }
          if (!secret) return NextResponse.json({ error: "Failed to assign players, try again" }, { status: 500 });
          assignments[p.id] = secret;
        }

        await db.update(miniGames).set({
          status: "playing",
          roundActive: true,
          secretPlayers: assignments,
          questionLog: [],
        }).where(eq(miniGames.id, gameId));
        return NextResponse.json({ success: true });
      }

      await db.update(miniGames).set({ status: "playing", currentRound: 0 }).where(eq(miniGames.id, gameId));
      return NextResponse.json({ success: true });
    }

    if (action === "next_round") {
      if (!actor?.isHost) return NextResponse.json({ error: "Host only" }, { status: 403 });
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

    if (action === "reveal_clue") {
      if (!actor?.isHost) return NextResponse.json({ error: "Host only" }, { status: 403 });
      if (!g.roundActive) return NextResponse.json({ error: "No active round" }, { status: 400 });
      if (g.cluesRevealed >= 5) return NextResponse.json({ error: "All clues revealed" }, { status: 400 });
      await db.update(miniGames).set({ cluesRevealed: g.cluesRevealed + 1 }).where(eq(miniGames.id, gameId));
      return NextResponse.json({ success: true });
    }

    if (action === "guess") {
      if (!g.roundActive || g.roundWinner) return NextResponse.json({ error: "Round over" }, { status: 400 });
      if (!guess?.trim()) return NextResponse.json({ error: "Enter a guess" }, { status: 400 });
      if (!actor) return NextResponse.json({ error: "Player not found" }, { status: 404 });
      const currentPlayer = g.currentPlayer as { name: string } | null;
      if (!currentPlayer) return NextResponse.json({ error: "No player" }, { status: 400 });
      if (fuzzyMatch(guess, currentPlayer.name)) {
        const points = Math.max(1, 5 - g.cluesRevealed);
        await db.update(miniGamePlayers).set({ score: actor.score + points }).where(eq(miniGamePlayers.id, playerId));
        await db.update(miniGames).set({ roundWinner: playerId, roundActive: false }).where(eq(miniGames.id, gameId));
        return NextResponse.json({ correct: true, points, playerName: actor.name });
      }
      return NextResponse.json({ correct: false });
    }

    if (action === "skip_round") {
      if (!actor?.isHost) return NextResponse.json({ error: "Host only" }, { status: 403 });
      await db.update(miniGames).set({ roundActive: false, roundWinner: null }).where(eq(miniGames.id, gameId));
      return NextResponse.json({ success: true });
    }

    if (action === "who_question") {
      if (!actor || actor.isHost) return NextResponse.json({ error: "Players only" }, { status: 403 });
      if (!question?.trim()) return NextResponse.json({ error: "Question required" }, { status: 400 });
      if (!["yes", "no", "maybe"].includes(answer)) return NextResponse.json({ error: "Answer must be yes/no/maybe" }, { status: 400 });
      const log = [...((g.questionLog as { playerId: string; playerName: string; question: string; answer: "yes" | "no" | "maybe"; timestamp: number }[]) || [])];
      log.push({ playerId, playerName: actor.name, question: question.trim(), answer, timestamp: Date.now() });
      await db.update(miniGames).set({ questionLog: log }).where(eq(miniGames.id, gameId));
      return NextResponse.json({ success: true });
    }

    if (action === "who_guess") {
      if (!actor || actor.isHost) return NextResponse.json({ error: "Players only" }, { status: 403 });
      if (!guess?.trim()) return NextResponse.json({ error: "Guess required" }, { status: 400 });
      const secrets = (g.secretPlayers as Record<string, ApiPlayer>) || {};
      const mine = secrets[playerId];
      if (!mine) return NextResponse.json({ error: "No secret assigned" }, { status: 400 });
      if (fuzzyMatch(guess, mine.name)) {
        const questionCount = ((g.questionLog as { playerId: string }[]) || []).filter(q => q.playerId === playerId).length;
        const points = Math.max(1, 10 - questionCount);
        await db.update(miniGamePlayers).set({ score: actor.score + points }).where(eq(miniGamePlayers.id, playerId));
        await db.update(miniGames).set({ roundWinner: playerId, roundActive: false, status: "finished" }).where(eq(miniGames.id, gameId));
        return NextResponse.json({ correct: true, points, secret: mine.name });
      }
      return NextResponse.json({ correct: false });
    }

    if (action === "price_guess") {
      if (!g.roundActive || g.priceRevealed) return NextResponse.json({ error: "Can't guess now" }, { status: 400 });
      if (typeof guess !== "number" || guess <= 0) return NextResponse.json({ error: "Enter a valid price" }, { status: 400 });
      if (!actor) return NextResponse.json({ error: "Player not found" }, { status: 404 });
      const guesses = { ...((g.priceGuesses as Record<string, number>) || {}), [playerId]: guess };
      await db.update(miniGames).set({ priceGuesses: guesses }).where(eq(miniGames.id, gameId));
      return NextResponse.json({ success: true });
    }

    if (action === "reveal_price") {
      if (!actor?.isHost) return NextResponse.json({ error: "Host only" }, { status: 403 });
      if (!g.roundActive) return NextResponse.json({ error: "No active round" }, { status: 400 });
      const currentPlayer = g.currentPlayer as { rating: number; name: string } | null;
      if (!currentPlayer) return NextResponse.json({ error: "No player" }, { status: 400 });
      const actualValue = estimateValue(currentPlayer.rating);
      const guesses = (g.priceGuesses as Record<string, number>) || {};
      const allPlayers = await db.select().from(miniGamePlayers).where(eq(miniGamePlayers.gameId, gameId));
      let winnerId: string | null = null;
      let winnerDiff = Infinity;
      for (const [pid, guessVal] of Object.entries(guesses)) {
        if (guessVal <= actualValue) {
          const diff = actualValue - guessVal;
          if (diff < winnerDiff) { winnerDiff = diff; winnerId = pid; }
        }
      }
      let reducedPoints = false;
      if (!winnerId) {
        for (const [pid, guessVal] of Object.entries(guesses)) {
          const diff = Math.abs(actualValue - guessVal);
          if (diff < winnerDiff) { winnerDiff = diff; winnerId = pid; }
        }
        reducedPoints = true;
      }
      if (winnerId) {
        const winner = allPlayers.find(p => p.id === winnerId);
        if (winner) await db.update(miniGamePlayers).set({ score: winner.score + (reducedPoints ? 1 : 3) }).where(eq(miniGamePlayers.id, winnerId));
      }
      await db.update(miniGames).set({ roundActive: false, roundWinner: winnerId, priceRevealed: true }).where(eq(miniGames.id, gameId));
      return NextResponse.json({ success: true, actualValue, winnerId });
    }

    if (action === "finish") {
      if (!actor?.isHost) return NextResponse.json({ error: "Host only" }, { status: 403 });
      await db.update(miniGames).set({ status: "finished", roundActive: false }).where(eq(miniGames.id, gameId));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Mini-game action error:", error);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
