"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type GameMode = "auction" | "guess" | "price" | null;

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join" | null>(null);
  const [selectedGame, setSelectedGame] = useState<GameMode>(null);
  const [hostName, setHostName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [maxRounds, setMaxRounds] = useState(10);
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedSession, setSavedSession] = useState<{ roomId: string; playerName: string; type: string } | null>(null);

  useEffect(() => {
    const roomId = localStorage.getItem("roomId");
    const mgId = localStorage.getItem("mgGameId");
    const playerName = localStorage.getItem("playerName") || localStorage.getItem("mgPlayerName");
    if (roomId && playerName) setSavedSession({ roomId, playerName, type: "auction" });
    else if (mgId && playerName) setSavedSession({ roomId: mgId, playerName, type: "minigame" });
  }, []);

  async function handleCreate() {
    if (!hostName.trim()) { setError("enter your name"); return; }
    setLoading(true); setError("");
    try {
      if (selectedGame === "auction") {
        const res = await fetch("/api/rooms", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostName: hostName.trim(), maxPlayers }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        localStorage.setItem("playerId", data.playerId);
        localStorage.setItem("roomId", data.roomId);
        localStorage.setItem("playerName", hostName.trim());
        router.push(`/room/${data.roomId}`);
      } else {
        const res = await fetch("/api/minigames", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostName: hostName.trim(), gameType: selectedGame, maxRounds }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        localStorage.setItem("mgPlayerId", data.playerId);
        localStorage.setItem("mgGameId", data.gameId);
        localStorage.setItem("mgPlayerName", hostName.trim());
        router.push(`/minigame/${data.gameId}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally { setLoading(false); }
  }

  async function handleJoin() {
    if (!joinCode.trim() || !joinName.trim()) { setError("fill in both fields"); return; }
    setLoading(true); setError("");
    try {
      // Try auction first
      const res1 = await fetch("/api/rooms/join", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.trim().toUpperCase(), playerName: joinName.trim() }),
      });
      if (res1.ok) {
        const data = await res1.json();
        localStorage.setItem("playerId", data.playerId);
        localStorage.setItem("roomId", data.roomId);
        localStorage.setItem("playerName", joinName.trim());
        router.push(`/room/${data.roomId}`);
        return;
      }
      // Try minigame
      const res2 = await fetch("/api/minigames/join", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.trim().toUpperCase(), playerName: joinName.trim() }),
      });
      if (res2.ok) {
        const data = await res2.json();
        localStorage.setItem("mgPlayerId", data.playerId);
        localStorage.setItem("mgGameId", data.gameId);
        localStorage.setItem("mgPlayerName", joinName.trim());
        router.push(`/minigame/${data.gameId}`);
        return;
      }
      const errData = await res2.json();
      throw new Error(errData.error || "Room not found");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally { setLoading(false); }
  }

  const games = [
    { id: "auction" as const, icon: "⚽", title: "The Auction", desc: "host picks FC26 players, spin the wheel, bid against each other. $1B budget." },
    { id: "guess" as const, icon: "🔍", title: "Guess the Player", desc: "clues revealed one by one. first to guess correctly wins points. fewer clues = more points." },
    { id: "price" as const, icon: "💰", title: "Price is Right", desc: "see a player, guess their market value. closest without going over wins." },
  ];

  const showingForm = mode !== null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Hero */}
      <div className="text-center mb-12 slide-up">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/40 mb-6">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          game night platform
        </div>
        <h1 className="text-6xl md:text-8xl font-black mb-5 bg-gradient-to-br from-white via-purple-200 to-purple-400 bg-clip-text text-transparent leading-tight">
          Family<br />Reunion
        </h1>
        <p className="text-lg text-white/35 font-light max-w-sm mx-auto">
          pick a game, send the code, get going
        </p>
      </div>

      {/* Rejoin */}
      {savedSession && !showingForm && (
        <div className="w-full max-w-md mb-4 fade-in">
          <button onClick={() => router.push(savedSession.type === "auction" ? `/room/${savedSession.roomId}` : `/minigame/${savedSession.roomId}`)}
            className="w-full glass p-4 flex items-center justify-between hover:bg-white/[0.08] transition-all rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-sm">🔄</div>
              <div className="text-left">
                <div className="text-sm font-semibold">rejoin as {savedSession.playerName}</div>
                <div className="text-xs text-white/30">you were in a game</div>
              </div>
            </div>
            <span className="text-xs text-purple-400">rejoin →</span>
          </button>
        </div>
      )}

      {/* Game Selection */}
      {!showingForm && (
        <div className="w-full max-w-md fade-in space-y-3">
          {games.map(g => (
            <div key={g.id} className="glass p-5 hover:bg-white/[0.08] transition-all">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/20 flex items-center justify-center text-xl flex-shrink-0">
                  {g.icon}
                </div>
                <div>
                  <h2 className="text-lg font-bold mb-0.5">{g.title}</h2>
                  <p className="text-white/35 text-xs leading-relaxed">{g.desc}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setMode("create"); setSelectedGame(g.id); setError(""); }}
                  className="btn-primary flex-1 text-center py-2.5 text-xs">host</button>
                <button onClick={() => { setMode("join"); setSelectedGame(null); setError(""); }}
                  className="glass-button flex-1 text-center py-2.5 text-xs">join</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Form */}
      {mode === "create" && selectedGame && (
        <div className="w-full max-w-sm fade-in">
          <div className="glass p-7">
            <h2 className="text-xl font-bold mb-5 text-center">
              host {selectedGame === "auction" ? "an auction" : selectedGame === "guess" ? "guess the player" : "price is right"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">your name</label>
                <input type="text" className="glass-input" placeholder="e.g. Big Boss"
                  value={hostName} onChange={e => setHostName(e.target.value)} maxLength={20} />
              </div>

              {selectedGame === "auction" && (
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">max players (2-8)</label>
                  <div className="flex gap-1.5">
                    {[2, 3, 4, 5, 6, 7, 8].map(n => (
                      <button key={n} onClick={() => setMaxPlayers(n)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                          maxPlayers === n ? "bg-purple-600 text-white" : "bg-white/5 text-white/30 hover:bg-white/10"
                        }`}>{n}</button>
                    ))}
                  </div>
                </div>
              )}

              {(selectedGame === "guess" || selectedGame === "price") && (
                <div>
                  <label className="text-xs text-white/40 mb-1.5 block">rounds</label>
                  <div className="flex gap-1.5">
                    {[5, 10, 15, 20].map(n => (
                      <button key={n} onClick={() => setMaxRounds(n)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                          maxRounds === n ? "bg-purple-600 text-white" : "bg-white/5 text-white/30 hover:bg-white/10"
                        }`}>{n}</button>
                    ))}
                  </div>
                </div>
              )}

              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button onClick={handleCreate} disabled={loading} className="btn-primary w-full text-center py-3">
                {loading ? "creating..." : "create game"}
              </button>
              <button onClick={() => { setMode(null); setSelectedGame(null); setError(""); }}
                className="w-full py-2 text-center text-white/30 text-sm hover:text-white/50 transition-colors">
                ← back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Form */}
      {mode === "join" && (
        <div className="w-full max-w-sm fade-in">
          <div className="glass p-7">
            <h2 className="text-xl font-bold mb-5 text-center">join a game</h2>
            <p className="text-xs text-white/30 text-center mb-4">works for any game type</p>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">room code</label>
                <input type="text" className="glass-input text-center text-2xl tracking-[0.3em] uppercase"
                  placeholder="ABCDE" value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={5} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">your name</label>
                <input type="text" className="glass-input" placeholder="e.g. Legend27"
                  value={joinName} onChange={e => setJoinName(e.target.value)} maxLength={20} />
              </div>
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button onClick={handleJoin} disabled={loading} className="btn-primary w-full text-center py-3">
                {loading ? "joining..." : "join game"}
              </button>
              <button onClick={() => { setMode(null); setError(""); }}
                className="w-full py-2 text-center text-white/30 text-sm hover:text-white/50 transition-colors">
                ← back
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-white/10 text-xs mt-14">family reunion © {new Date().getFullYear()}</p>
    </div>
  );
}
