"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [hostName, setHostName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!hostName.trim()) { setError("enter your name first"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostName: hostName.trim(), maxPlayers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem("playerId", data.playerId);
      localStorage.setItem("roomId", data.roomId);
      localStorage.setItem("playerName", hostName.trim());
      router.push(`/room/${data.roomId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally { setLoading(false); }
  }

  async function handleJoin() {
    if (!joinCode.trim() || !joinName.trim()) { setError("fill in both fields"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.trim().toUpperCase(), playerName: joinName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem("playerId", data.playerId);
      localStorage.setItem("roomId", data.roomId);
      localStorage.setItem("playerName", joinName.trim());
      router.push(`/room/${data.roomId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Hero */}
      <div className="text-center mb-14 slide-up">
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

      {/* Game Cards */}
      {!showCreate && !showJoin && (
        <div className="w-full max-w-md fade-in space-y-4">
          <div className="glass p-6 hover:bg-white/[0.08] transition-all">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/20 flex items-center justify-center text-2xl flex-shrink-0">
                ⚽
              </div>
              <div>
                <h2 className="text-xl font-bold mb-0.5">The Auction</h2>
                <p className="text-white/35 text-sm leading-relaxed">
                  host picks a pool of FC26 players, spin the wheel, bid against each other. 
                  $1B budget. fill your whole XI to finish.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowCreate(true); setShowJoin(false); setError(""); }}
                className="btn-primary flex-1 text-center py-3 text-sm">
                host a game
              </button>
              <button onClick={() => { setShowJoin(true); setShowCreate(false); setError(""); }}
                className="glass-button px-6 py-3 flex-1 text-center text-sm">
                join a game
              </button>
            </div>
          </div>

          <div className="glass p-5 opacity-40">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-2xl flex-shrink-0">🎲</div>
              <div>
                <h3 className="text-base font-semibold">More Games</h3>
                <p className="text-white/30 text-sm">coming soon</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="w-full max-w-sm fade-in">
          <div className="glass p-7">
            <h2 className="text-xl font-bold mb-5 text-center">host an auction</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">your name</label>
                <input type="text" className="glass-input" placeholder="e.g. Big Boss"
                  value={hostName} onChange={(e) => setHostName(e.target.value)} maxLength={20} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">max players (2-8)</label>
                <div className="flex gap-1.5">
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <button key={n} onClick={() => setMaxPlayers(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                        maxPlayers === n ? "bg-purple-600 text-white" : "bg-white/5 text-white/30 hover:bg-white/10"
                      }`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button onClick={handleCreate} disabled={loading}
                className="btn-primary w-full text-center py-3">
                {loading ? "creating..." : "create game"}
              </button>
              <button onClick={() => { setShowCreate(false); setError(""); }}
                className="w-full py-2 text-center text-white/30 text-sm hover:text-white/50 transition-colors">
                ← back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Form */}
      {showJoin && (
        <div className="w-full max-w-sm fade-in">
          <div className="glass p-7">
            <h2 className="text-xl font-bold mb-5 text-center">join a game</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">room code</label>
                <input type="text" className="glass-input text-center text-2xl tracking-[0.3em] uppercase"
                  placeholder="ABCDE" value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={5} />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">your name</label>
                <input type="text" className="glass-input" placeholder="e.g. Legend27"
                  value={joinName} onChange={(e) => setJoinName(e.target.value)} maxLength={20} />
              </div>
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button onClick={handleJoin} disabled={loading}
                className="btn-primary w-full text-center py-3">
                {loading ? "joining..." : "join game"}
              </button>
              <button onClick={() => { setShowJoin(false); setError(""); }}
                className="w-full py-2 text-center text-white/30 text-sm hover:text-white/50 transition-colors">
                ← back
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-white/10 text-xs mt-14">
        family reunion © {new Date().getFullYear()}
      </p>
    </div>
  );
}
