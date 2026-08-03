"use client";

import { useState } from "react";
import { formatMoney, getRatingColor } from "@/lib/format";

interface GameState {
  id: string; code: string; status: string; maxRounds: number; currentRound: number;
  currentPlayer: { name: string; rating: number; team: string; nationality: string; position: string; age: string; league: string; card: string } | null;
  roundActive: boolean; roundWinner: string | null;
  priceGuesses: Record<string, number>; priceRevealed: boolean;
}

interface Player { id: string; name: string; score: number; isHost: boolean; }

interface Props {
  game: GameState; players: Player[]; playerId: string; isHost: boolean;
  onRefresh: () => void;
}

export default function PriceIsRight({ game, players, playerId, isHost, onRefresh }: Props) {
  const [priceInput, setPriceInput] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealedValue, setRevealedValue] = useState<number | null>(null);

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const currentPlayer = game.currentPlayer;
  const winnerPlayer = game.roundWinner ? players.find(p => p.id === game.roundWinner) : null;
  const myGuess = game.priceGuesses?.[playerId];
  const totalGuesses = Object.keys(game.priceGuesses || {}).length;
  const totalNonHost = players.filter(p => !p.isHost).length;

  async function doAction(action: string, extra?: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch(`/api/minigames/${game.id}/action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, playerId, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (action === "reveal_price" && data.actualValue) {
        setRevealedValue(data.actualValue);
      }
      onRefresh();
      return data;
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "failed");
      setTimeout(() => setFeedback(null), 2500);
    } finally { setLoading(false); }
  }

  // Lobby
  if (game.status === "lobby") {
    return (
      <div className="max-w-lg mx-auto fade-in">
        <div className="glass p-8 text-center">
          <div className="text-5xl mb-4">💰</div>
          <h2 className="text-3xl font-bold mb-2">Price is Right</h2>
          <p className="text-white/40 mb-6">guess the player&apos;s market value. closest without going over wins!</p>
          <div className="glass-strong p-6 mb-6">
            <p className="text-sm text-white/40 mb-2">room code</p>
            <p className="text-4xl font-black tracking-[0.3em] text-purple-400">{game.code}</p>
          </div>
          <div className="space-y-2 mb-6">
            {players.map(p => (
              <div key={p.id} className="glass-button px-4 py-3 flex items-center justify-between cursor-default">
                <span className="font-medium">{p.name}</span>
                {p.isHost && <span className="badge badge-gold">HOST</span>}
              </div>
            ))}
          </div>
          {isHost && players.length >= 2 && (
            <button onClick={() => doAction("start")} className="btn-primary w-full py-4 text-lg" disabled={loading}>
              start game ({game.maxRounds} rounds)
            </button>
          )}
          {isHost && players.length < 2 && <p className="text-white/30 text-sm">need at least 2 players</p>}
          {!isHost && <p className="text-white/30 text-sm">waiting for host to start...</p>}
        </div>
      </div>
    );
  }

  // Finished
  if (game.status === "finished") {
    return (
      <div className="max-w-lg mx-auto fade-in">
        <div className="glass p-8 text-center mb-6">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-3xl font-black text-yellow-400 mb-2">{sorted[0]?.name} wins!</h2>
          <p className="text-white/40">{sorted[0]?.score} points</p>
        </div>
        <div className="glass p-6 mb-6">
          <h3 className="text-sm font-bold text-white/60 mb-3">final standings</h3>
          {sorted.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? "bg-yellow-500/20 text-yellow-400" : i === 1 ? "bg-gray-400/20 text-gray-300" : "bg-white/5 text-white/40"
                }`}>{i + 1}</span>
                <span className="font-medium">{p.name}</span>
              </div>
              <span className="font-bold text-purple-400">{p.score} pts</span>
            </div>
          ))}
        </div>
        <div className="text-center">
          <a href="/" className="btn-primary px-8 py-3 inline-block">back to home</a>
        </div>
      </div>
    );
  }

  // Playing
  return (
    <div className="max-w-4xl mx-auto fade-in">
      {/* Header */}
      <div className="glass p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-xl">💰</div>
          <div>
            <h2 className="text-lg font-bold">price is right</h2>
            <p className="text-xs text-white/40">round {game.currentRound}/{game.maxRounds}</p>
          </div>
        </div>
        {isHost && (
          <button onClick={() => doAction("finish")} className="glass-button px-3 py-2 text-xs">🏁 end</button>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Between rounds */}
          {!game.roundActive && !game.priceRevealed && (
            <div className="glass p-12 text-center">
              <div className="text-6xl mb-4">💵</div>
              <h3 className="text-2xl font-black mb-4">
                {game.currentRound === 0 ? "ready for round 1?" : "next player coming up!"}
              </h3>
              {isHost && (
                <button onClick={() => { setRevealedValue(null); doAction("next_round"); }} disabled={loading}
                  className="btn-gold px-12 py-4 text-lg font-black">
                  {game.currentRound >= game.maxRounds ? "see results" : `start round ${game.currentRound + 1}`}
                </button>
              )}
              {!isHost && <p className="text-white/30">waiting for host...</p>}
            </div>
          )}

          {/* Price revealed */}
          {game.priceRevealed && currentPlayer && (
            <div className="glass p-8 text-center">
              <div className="text-4xl mb-3">🎉</div>
              {/* Player card */}
              <div className="player-card gold max-w-[200px] mx-auto p-4 mb-4">
                {currentPlayer.card && <img src={currentPlayer.card} alt="" className="w-28 mx-auto rounded-lg mb-2" />}
                <div className={`text-2xl font-black ${getRatingColor(currentPlayer.rating)}`}>{currentPlayer.rating}</div>
                <div className="text-sm font-bold">{currentPlayer.name}</div>
                <div className="text-xs text-white/40">{currentPlayer.team}</div>
              </div>

              {revealedValue && (
                <div className="glass-strong p-4 max-w-sm mx-auto mb-4">
                  <div className="text-xs text-white/40 mb-1">actual market value</div>
                  <div className="text-3xl font-black text-green-400">${formatMoney(revealedValue)}</div>
                </div>
              )}

              {/* Everyone's guesses */}
              <div className="max-w-sm mx-auto space-y-2 mb-4">
                {Object.entries(game.priceGuesses || {}).map(([pid, val]) => {
                  const p = players.find(pl => pl.id === pid);
                  const isWinner = pid === game.roundWinner;
                  const overBudget = revealedValue ? val > revealedValue : false;
                  return (
                    <div key={pid} className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                      isWinner ? "bg-green-500/20 border border-green-500/30" :
                      overBudget ? "bg-red-500/10 border border-red-500/20" :
                      "bg-white/5 border border-white/5"
                    }`}>
                      <span className="text-sm font-medium">
                        {isWinner && "👑 "}{p?.name || "Unknown"}
                      </span>
                      <span className={`text-sm font-bold ${overBudget ? "text-red-400 line-through" : "text-yellow-400"}`}>
                        ${formatMoney(val)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {winnerPlayer && (
                <p className="text-green-400 font-semibold">{winnerPlayer.name} wins this round!</p>
              )}

              {isHost && (
                <button onClick={() => { setRevealedValue(null); doAction("next_round"); }} disabled={loading}
                  className="btn-gold px-8 py-3 text-sm font-bold mt-4">
                  {game.currentRound >= game.maxRounds ? "see results" : "next round →"}
                </button>
              )}
            </div>
          )}

          {/* Active round - guessing phase */}
          {game.roundActive && !game.priceRevealed && currentPlayer && (
            <div className="glass p-6">
              <div className="text-center mb-6">
                <p className="text-sm text-white/40 mb-4">how much is this player worth?</p>
                {/* Player card - show everything except name for fun */}
                <div className="player-card gold max-w-[220px] mx-auto p-5 mb-4">
                  {currentPlayer.card && <img src={currentPlayer.card} alt="" className="w-32 mx-auto rounded-lg mb-2" />}
                  <div className={`text-3xl font-black ${getRatingColor(currentPlayer.rating)}`}>{currentPlayer.rating}</div>
                  <div className="text-lg font-bold mt-1">{currentPlayer.name}</div>
                  <div className="text-xs text-white/40">{currentPlayer.team}</div>
                  <div className="text-[11px] text-white/30 mt-1">{currentPlayer.position} · {currentPlayer.age}yo · {currentPlayer.nationality}</div>
                </div>
              </div>

              {/* Guess status */}
              <div className="text-center mb-4">
                <span className="text-sm text-white/40">{totalGuesses}/{totalNonHost} players guessed</span>
              </div>

              {/* Input */}
              {!isHost && !myGuess && (
                <div className="max-w-sm mx-auto space-y-3">
                  <input type="text" className="glass-input text-center text-xl font-bold" placeholder="e.g. 50000000"
                    value={priceInput} onChange={e => setPriceInput(e.target.value.replace(/[^0-9]/g, ""))} />
                  {priceInput && (
                    <p className="text-sm text-white/40 text-center">= <span className="text-yellow-400 font-bold">${formatMoney(parseInt(priceInput) || 0)}</span></p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {[500_000, 1_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000].map(v => (
                      <button key={v} onClick={() => setPriceInput(v.toString())} className="glass-button px-2 py-1.5 text-[10px] flex-1">
                        ${formatMoney(v)}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => {
                    const val = parseInt(priceInput);
                    if (val > 0) { doAction("price_guess", { guess: val }); setPriceInput(""); }
                  }} disabled={loading || !priceInput} className="btn-gold w-full py-3 text-lg font-bold disabled:opacity-40">
                    lock in guess 🔒
                  </button>
                  {feedback && <p className="text-sm text-center text-red-400">{feedback}</p>}
                </div>
              )}

              {!isHost && myGuess && (
                <div className="text-center">
                  <div className="glass-strong inline-block px-6 py-3 rounded-xl">
                    <div className="text-xs text-white/40 mb-1">your guess</div>
                    <div className="text-xl font-black text-yellow-400">${formatMoney(myGuess)}</div>
                  </div>
                  <p className="text-xs text-white/30 mt-2">waiting for everyone else...</p>
                </div>
              )}

              {isHost && (
                <div className="text-center mt-4">
                  <button onClick={() => doAction("reveal_price")} disabled={loading}
                    className="btn-primary px-8 py-3 text-sm font-bold">
                    reveal the answer ({totalGuesses}/{totalNonHost} guessed)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scoreboard */}
        <div className="glass p-4">
          <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">🏅 scoreboard</h3>
          <div className="space-y-2">
            {sorted.map((p, i) => (
              <div key={p.id} className={`px-3 py-3 rounded-xl flex items-center justify-between ${
                i === 0 && p.score > 0 ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-white/5 border border-white/5"
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i === 0 ? "bg-yellow-500/30 text-yellow-400" : "bg-white/10 text-white/40"
                  }`}>{i + 1}</span>
                  <span className="font-medium text-sm">{p.name}</span>
                </div>
                <span className="text-sm font-bold text-purple-400">{p.score}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/5">
            <h4 className="text-[10px] text-white/30 uppercase tracking-wider mb-1">scoring</h4>
            <div className="text-[11px] text-white/40 space-y-0.5">
              <div>closest without going over = 3 pts</div>
              <div>closest but over = 1 pt</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
