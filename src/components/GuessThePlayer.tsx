"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";

interface GameState {
  id: string; code: string; status: string; maxRounds: number; currentRound: number;
  currentPlayer: { name: string; rating: number; team: string; nationality: string; position: string; age: string; league: string; card: string } | null;
  cluesRevealed: number; roundActive: boolean; roundWinner: string | null;
}

interface Player { id: string; name: string; score: number; isHost: boolean; }

interface Props {
  game: GameState; players: Player[]; playerId: string; isHost: boolean;
  onRefresh: () => void;
}

const CLUE_LABELS = ["nationality", "league", "age", "position", "team"];

export default function GuessThePlayer({ game, players, playerId, isHost, onRefresh }: Props) {
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const currentPlayer = game.currentPlayer;
  const winnerPlayer = game.roundWinner ? players.find(p => p.id === game.roundWinner) : null;

  async function doAction(action: string, extra?: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch(`/api/minigames/${game.id}/action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, playerId, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (action === "guess") {
        if (data.correct) {
          setFeedback(`correct! +${data.points} points 🎉`);
          setGuess("");
        } else {
          setFeedback("nope, try again!");
        }
        setTimeout(() => setFeedback(null), 2500);
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
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-3xl font-bold mb-2">Guess the Player</h2>
          <p className="text-white/40 mb-6">clues are revealed one by one, first to guess wins points</p>
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
  const clues: { label: string; value: string }[] = currentPlayer ? [
    { label: "nationality", value: currentPlayer.nationality },
    { label: "league", value: currentPlayer.league },
    { label: "age", value: currentPlayer.age },
    { label: "position", value: currentPlayer.position },
    { label: "team", value: currentPlayer.team },
  ] : [];

  return (
    <div className="max-w-4xl mx-auto fade-in">
      {/* Header */}
      <div className="glass p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-xl">🔍</div>
          <div>
            <h2 className="text-lg font-bold">guess the player</h2>
            <p className="text-xs text-white/40">round {game.currentRound}/{game.maxRounds}</p>
          </div>
        </div>
        {isHost && (
          <button onClick={() => doAction("finish")} className="glass-button px-3 py-2 text-xs">🏁 end</button>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          {/* Between rounds */}
          {!game.roundActive && !winnerPlayer && (
            <div className="glass p-12 text-center">
              <div className="text-6xl mb-4">🎯</div>
              <h3 className="text-2xl font-black mb-4">
                {game.currentRound === 0 ? "ready for round 1?" : `round ${game.currentRound} complete!`}
              </h3>
              {isHost && (
                <button onClick={() => doAction("next_round")} disabled={loading}
                  className="btn-gold px-12 py-4 text-lg font-black">
                  {game.currentRound >= game.maxRounds ? "see results" : `start round ${game.currentRound + 1}`}
                </button>
              )}
              {!isHost && <p className="text-white/30">waiting for host...</p>}
            </div>
          )}

          {/* Round won */}
          {!game.roundActive && winnerPlayer && currentPlayer && (
            <div className="glass p-8 text-center">
              <div className="text-5xl mb-3">🎉</div>
              <h3 className="text-xl font-black text-green-400 mb-2">{winnerPlayer.name} got it!</h3>
              <div className="player-card gold max-w-[180px] mx-auto p-4 mb-4">
                {currentPlayer.card && <img src={currentPlayer.card} alt="" className="w-28 mx-auto rounded-lg mb-2" />}
                <div className="text-lg font-bold">{currentPlayer.name}</div>
                <div className="text-xs text-white/40">{currentPlayer.team}</div>
              </div>
              {isHost && (
                <button onClick={() => doAction("next_round")} disabled={loading}
                  className="btn-gold px-8 py-3 text-sm font-bold mt-2">
                  {game.currentRound >= game.maxRounds ? "see results" : "next round →"}
                </button>
              )}
            </div>
          )}

          {/* Active round */}
          {game.roundActive && currentPlayer && (
            <div className="glass p-6">
              {/* Blurred card */}
              <div className="text-center mb-6">
                <div className="relative inline-block">
                  {currentPlayer.card ? (
                    <img src={currentPlayer.card} alt="?" className="w-36 mx-auto rounded-xl"
                      style={{ filter: game.cluesRevealed >= 5 ? "none" : `blur(${Math.max(0, 20 - game.cluesRevealed * 4)}px)` }} />
                  ) : (
                    <div className="w-36 h-48 rounded-xl bg-white/5 flex items-center justify-center text-5xl mx-auto">❓</div>
                  )}
                  <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs font-bold text-yellow-400">
                    {5 - game.cluesRevealed} clue{5 - game.cluesRevealed !== 1 ? "s" : ""} left
                  </div>
                </div>
              </div>

              {/* Clues */}
              <div className="grid grid-cols-5 gap-2 mb-6">
                {clues.map((clue, i) => (
                  <div key={i} className={`text-center p-3 rounded-xl transition-all ${
                    i < game.cluesRevealed
                      ? "bg-purple-600/20 border border-purple-500/30"
                      : "bg-white/5 border border-white/10"
                  }`}>
                    <div className="text-[10px] text-white/40 uppercase mb-1">{clue.label}</div>
                    <div className="text-sm font-bold">
                      {i < game.cluesRevealed ? clue.value : "?"}
                    </div>
                  </div>
                ))}
              </div>

              {/* Host: reveal clue */}
              {isHost && game.cluesRevealed < 5 && (
                <div className="text-center mb-4">
                  <button onClick={() => doAction("reveal_clue")} disabled={loading}
                    className="glass-button px-6 py-2 text-sm">
                    reveal next clue ({5 - game.cluesRevealed - 1} left after)
                  </button>
                </div>
              )}

              {/* Guess input */}
              {!isHost && (
                <div className="max-w-sm mx-auto">
                  <div className="flex gap-2">
                    <input type="text" className="glass-input flex-1" placeholder="type player name..."
                      value={guess} onChange={e => setGuess(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && guess.trim() && doAction("guess", { guess })} />
                    <button onClick={() => doAction("guess", { guess })} disabled={loading || !guess.trim()}
                      className="btn-primary px-6 disabled:opacity-40">guess</button>
                  </div>
                  {feedback && (
                    <p className={`text-sm text-center mt-2 fade-in ${feedback.includes("correct") ? "text-green-400" : "text-red-400"}`}>
                      {feedback}
                    </p>
                  )}
                </div>
              )}

              {isHost && (
                <div className="text-center mt-4">
                  <button onClick={() => doAction("skip_round")} className="glass-button px-4 py-2 text-xs text-white/30">
                    skip this one
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
              <div>0 clues = 5 pts</div>
              <div>1 clue = 4 pts</div>
              <div>2 clues = 3 pts</div>
              <div>3 clues = 2 pts</div>
              <div>4-5 clues = 1 pt</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
