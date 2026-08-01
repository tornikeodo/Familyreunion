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
    if (!hostName.trim()) {
      setError("enter your name first");
      return;
    }
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
      const message = err instanceof Error ? err.message : "something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim() || !joinName.trim()) {
      setError("fill in both fields");
      return;
    }
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
      const message = err instanceof Error ? err.message : "something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Hero */}
      <div className="text-center mb-12 slide-up">
        <div className="text-6xl mb-4">🎮</div>
        <h1 className="text-5xl md:text-7xl font-black mb-4 bg-gradient-to-r from-purple-400 via-pink-300 to-purple-400 bg-clip-text text-transparent">
          Family Reunion
        </h1>
        <p className="text-xl text-white/50 font-light max-w-md mx-auto">
          game night, sorted. pick a game, send the code, get going
        </p>
      </div>

      {/* Game Cards */}
      {!showCreate && !showJoin && (
        <div className="w-full max-w-lg fade-in">
          <div className="glass p-8 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl">⚽</div>
              <div>
                <h2 className="text-2xl font-bold">The Auction</h2>
                <p className="text-white/40 text-sm">build your best XI through bidding wars</p>
              </div>
            </div>
            <p className="text-white/60 mb-6 text-sm leading-relaxed">
              host picks the player pool, spins the wheel, and everyone bids for the best players.
              budget is 1 billion. spend wisely or get eliminated 💀
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCreate(true); setShowJoin(false); setError(""); }}
                className="btn-primary flex-1 text-center"
              >
                🎯 Host a Game
              </button>
              <button
                onClick={() => { setShowJoin(true); setShowCreate(false); setError(""); }}
                className="glass-button px-6 py-3 flex-1 text-center"
              >
                🎮 Join a Game
              </button>
            </div>
          </div>

          {/* More games coming soon */}
          <div className="glass p-6 opacity-50">
            <div className="flex items-center gap-4">
              <div className="text-3xl">🎲</div>
              <div>
                <h3 className="text-lg font-semibold">More Games</h3>
                <p className="text-white/40 text-sm">coming soon</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="w-full max-w-md fade-in">
          <div className="glass p-8">
            <h2 className="text-2xl font-bold mb-6 text-center">🎯 Host an Auction</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/50 mb-1 block">your name</label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Big Boss"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  maxLength={20}
                />
              </div>
              <div>
                <label className="text-sm text-white/50 mb-1 block">max players (2-8)</label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMaxPlayers(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                        maxPlayers === n
                          ? "bg-purple-600 text-white"
                          : "glass-button"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button
                onClick={handleCreate}
                disabled={loading}
                className="btn-primary w-full text-center py-3"
              >
                {loading ? "creating..." : "create game 🎉"}
              </button>
              <button
                onClick={() => { setShowCreate(false); setError(""); }}
                className="glass-button w-full py-3 text-center text-white/50"
              >
                ← back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Form */}
      {showJoin && (
        <div className="w-full max-w-md fade-in">
          <div className="glass p-8">
            <h2 className="text-2xl font-bold mb-6 text-center">🎮 Join a Game</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/50 mb-1 block">room code</label>
                <input
                  type="text"
                  className="glass-input text-center text-2xl tracking-[0.3em] uppercase"
                  placeholder="ABCDE"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={5}
                />
              </div>
              <div>
                <label className="text-sm text-white/50 mb-1 block">your name</label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Legend27"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  maxLength={20}
                />
              </div>
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button
                onClick={handleJoin}
                disabled={loading}
                className="btn-primary w-full text-center py-3"
              >
                {loading ? "joining..." : "join game"}
              </button>
              <button
                onClick={() => { setShowJoin(false); setError(""); }}
                className="glass-button w-full py-3 text-center text-white/50"
              >
                ← back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-white/20 text-xs mt-12">
        family reunion © {new Date().getFullYear()}
      </p>
    </div>
  );
}
