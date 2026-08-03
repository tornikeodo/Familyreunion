"use client";

import { useEffect, useState, useCallback, use } from "react";
import GuessThePlayer from "@/components/GuessThePlayer";
import PriceIsRight from "@/components/PriceIsRight";
import WhoAmI from "@/components/WhoAmI";

interface MiniGameState {
  id: string; code: string; hostName: string; gameType: string; status: string;
  maxRounds: number; currentRound: number;
  currentPlayer: { name: string; rating: number; team: string; nationality: string; position: string; age: string; league: string; card: string } | null;
  cluesRevealed: number; roundActive: boolean; roundWinner: string | null;
  priceGuesses: Record<string, number>; priceRevealed: boolean;
  secretPlayers?: Record<string, { name: string; rating: number; team: string; nationality: string; position: string; age: string; league: string; card: string } | null>;
  questionLog?: { playerId: string; playerName: string; question: string; answer: "yes" | "no" | "maybe"; timestamp: number }[];
}

interface MiniGamePlayer {
  id: string; gameId: string; name: string; score: number; isHost: boolean;
}

export default function MiniGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const [game, setGame] = useState<MiniGameState | null>(null);
  const [players, setPlayers] = useState<MiniGamePlayer[]>([]);
  const [playerId, setPlayerId] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState("");

  const fetchGame = useCallback(async () => {
    try {
      const pid = localStorage.getItem("mgPlayerId") || "";
      const res = await fetch(`/api/minigames/${gameId}?playerId=${pid}`);
      if (!res.ok) { setError("Game not found"); return; }
      const data = await res.json();
      setGame(data.game);
      setPlayers(data.players);
    } catch { /* ignore */ }
  }, [gameId]);

  useEffect(() => { setPlayerId(localStorage.getItem("mgPlayerId") || ""); }, []);
  useEffect(() => {
    if (playerId && players.length) setIsHost(players.find(p => p.id === playerId)?.isHost || false);
  }, [playerId, players]);
  useEffect(() => { fetchGame(); const i = setInterval(fetchGame, 1500); return () => clearInterval(i); }, [fetchGame]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass p-8 text-center">
        <div className="text-5xl mb-4">😢</div>
        <p className="text-white/40 mb-4">{error}</p>
        <a href="/" className="btn-primary px-6 py-3 inline-block">go home</a>
      </div>
    </div>
  );

  if (!game) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-5xl animate-pulse">🎮</div>
    </div>
  );

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-5xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <a href="/" className="text-lg font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Family Reunion
          </a>
          <span className="text-sm text-white/30">
            playing as <span className="text-white/60 font-medium">{players.find(p => p.id === playerId)?.name}</span>
          </span>
        </div>
      </div>

      {game.gameType === "guess" && (
        <GuessThePlayer game={game} players={players} playerId={playerId} isHost={isHost} onRefresh={fetchGame} />
      )}
      {game.gameType === "price" && (
        <PriceIsRight game={game} players={players} playerId={playerId} isHost={isHost} onRefresh={fetchGame} />
      )}
      {game.gameType === "whoami" && (
        <WhoAmI game={game} players={players} playerId={playerId} isHost={isHost} onRefresh={fetchGame} />
      )}
    </div>
  );
}
