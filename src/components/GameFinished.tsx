"use client";

import { GamePlayer, PlayerData } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import FormationView from "./FormationView";
import Tournament from "./Tournament";
import { useState } from "react";

interface Props {
  gamePlayers: GamePlayer[];
}

export default function GameFinished({ gamePlayers }: Props) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(
    gamePlayers[0]?.id || null
  );
  const [showTournament, setShowTournament] = useState(false);

  // Sort by number of players in lineup
  const sorted = [...gamePlayers].sort((a, b) => {
    const aCount = Object.keys(a.lineup || {}).length;
    const bCount = Object.keys(b.lineup || {}).length;
    if (bCount !== aCount) return bCount - aCount;
    return b.budget - a.budget;
  });

  const getTotalSpent = (p: GamePlayer) => {
    return Object.values(p.lineup || {}).reduce((sum, pl) => sum + (pl.pricePaid || 0), 0);
  };

  // Check if we have enough players for tournament (at least 2 non-host players)
  const nonHostPlayers = gamePlayers.filter(p => !p.isHost && !p.isEliminated);
  const canRunTournament = nonHostPlayers.length >= 2;

  if (showTournament) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <button 
            onClick={() => setShowTournament(false)}
            className="glass-button px-4 py-2 text-sm"
          >
            ← back to results
          </button>
        </div>
        <Tournament gamePlayers={gamePlayers} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto fade-in">
      <div className="glass p-8 text-center mb-6">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-4xl font-black mb-2 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
          auction complete!
        </h2>
        <p className="text-white/40 mb-6">here&apos;s how everyone did</p>
        
        {canRunTournament && (
          <button 
            onClick={() => setShowTournament(true)}
            className="btn-gold px-8 py-4 text-lg"
          >
            ⚽ play tournament mode
          </button>
        )}
      </div>

      {/* Leaderboard */}
      <div className="glass p-6 mb-6">
        <h3 className="text-lg font-bold mb-4">📊 auction results</h3>
        <div className="space-y-3">
          {sorted.map((p, idx) => (
            <div
              key={p.id}
              className={`glass-button px-4 py-4 flex items-center justify-between cursor-pointer ${
                selectedPlayer === p.id ? "border-purple-500/50 bg-purple-600/10" : ""
              } ${p.isEliminated ? "opacity-40" : ""}`}
              onClick={() => setSelectedPlayer(p.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                  idx === 0 ? "bg-yellow-500/20 text-yellow-400" :
                  idx === 1 ? "bg-gray-400/20 text-gray-300" :
                  idx === 2 ? "bg-orange-600/20 text-orange-400" :
                  "bg-white/5 text-white/40"
                }`}>
                  {idx + 1}
                </div>
                <div>
                  <div className="font-bold flex items-center gap-2">
                    {p.name}
                    {p.isHost && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">HOST</span>}
                  </div>
                  <div className="text-xs text-white/40">
                    {Object.keys(p.lineup || {}).length}/11 players •
                    spent ${formatMoney(getTotalSpent(p))}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-green-400">${formatMoney(p.budget)}</div>
                <div className="text-xs text-white/40">remaining</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected player's formation */}
      {selectedPlayer && (
        <div className="glass p-6">
          <FormationView
            lineup={(sorted.find(p => p.id === selectedPlayer)?.lineup || {}) as Record<string, PlayerData & { pricePaid: number }>}
            playerName={sorted.find(p => p.id === selectedPlayer)?.name || ""}
          />
        </div>
      )}

      {/* Back to home */}
      <div className="text-center mt-6">
        <a href="/" className="btn-primary px-8 py-3 inline-block">
          🏠 back to home
        </a>
      </div>
    </div>
  );
}
