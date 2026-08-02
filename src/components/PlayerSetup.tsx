"use client";

import { useState, useEffect, useCallback } from "react";
import { POSITIONS, type Position } from "@/data/fifa-players";
import { getRatingColor } from "@/lib/format";

interface SearchPlayer {
  name: string;
  rating: number;
  team: string;
  position: string;
  nationality: string;
  card: string;
  id: string;
}

interface PlayerOption {
  name: string;
  rating: number;
  team: string;
  image: string; // card URL
}

interface Props {
  roomId: string;
  playerId: string;
  onComplete: () => void;
}

const PICKS_PER_POSITION = 3;

export default function PlayerSetup({ roomId, playerId, onComplete }: Props) {
  const [currentPosIndex, setCurrentPosIndex] = useState(0);
  const [playerPool, setPlayerPool] = useState<Record<string, PlayerOption[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchPlayer[]>([]);
  const [selectedForPosition, setSelectedForPosition] = useState<PlayerOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const currentPosition = POSITIONS[currentPosIndex];

  const doSearch = useCallback(async (query: string, pos: Position) => {
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      params.set("position", pos);
      const res = await fetch(`/api/players/search?${params}`);
      const data = await res.json();
      setSearchResults(data.players || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    doSearch("", currentPosition);
    setSelectedForPosition(playerPool[currentPosition] || []);
    setSearchQuery("");
  }, [currentPosition, doSearch, playerPool]);

  useEffect(() => {
    const timer = setTimeout(() => {
      doSearch(searchQuery, currentPosition);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, currentPosition, doSearch]);

  function selectPlayer(player: SearchPlayer) {
    if (selectedForPosition.length >= PICKS_PER_POSITION) return;
    if (selectedForPosition.some(p => p.name === player.name && p.team === player.team)) return;

    const option: PlayerOption = {
      name: player.name,
      rating: player.rating,
      team: player.team,
      image: player.card || "",
    };
    const newSelected = [...selectedForPosition, option];
    setSelectedForPosition(newSelected);
    setPlayerPool(prev => ({ ...prev, [currentPosition]: newSelected }));
  }

  function removePlayer(index: number) {
    const newSelected = selectedForPosition.filter((_, i) => i !== index);
    setSelectedForPosition(newSelected);
    setPlayerPool(prev => ({ ...prev, [currentPosition]: newSelected }));
  }

  function goNext() {
    if (selectedForPosition.length !== PICKS_PER_POSITION) return;
    if (currentPosIndex < POSITIONS.length - 1) {
      setCurrentPosIndex(currentPosIndex + 1);
    }
  }

  function goPrev() {
    if (currentPosIndex > 0) {
      setCurrentPosIndex(currentPosIndex - 1);
    }
  }

  async function handleSave() {
    for (const pos of POSITIONS) {
      if (!playerPool[pos] || playerPool[pos].length !== PICKS_PER_POSITION) {
        alert(`Pick ${PICKS_PER_POSITION} players for ${pos} first!`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerPool, playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onComplete();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const allComplete = POSITIONS.every(pos => playerPool[pos]?.length === PICKS_PER_POSITION);
  const completedCount = POSITIONS.filter(pos => playerPool[pos]?.length === PICKS_PER_POSITION).length;

  const tierLabels = ["⭐ Best", "🥈 Second", "🥉 Third"];
  const tierColors = ["border-yellow-500/40 bg-yellow-500/5", "border-gray-400/40 bg-gray-400/5", "border-orange-700/40 bg-orange-700/5"];

  return (
    <div className="max-w-5xl mx-auto fade-in">
      {/* Progress header */}
      <div className="glass p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold">pick the player pool</h2>
            <p className="text-white/40 text-xs mt-0.5">select {PICKS_PER_POSITION} players per position. everyone will bid on these.</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-purple-400">{completedCount}<span className="text-white/20 text-lg">/{POSITIONS.length}</span></div>
            <div className="text-[10px] text-white/30 uppercase tracking-wider">positions done</div>
          </div>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / POSITIONS.length) * 100}%` }} />
        </div>

        {/* Position pills */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {POSITIONS.map((pos, idx) => {
            const done = playerPool[pos]?.length === PICKS_PER_POSITION;
            const active = idx === currentPosIndex;
            return (
              <button key={pos} onClick={() => setCurrentPosIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  active ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" :
                  done ? "bg-green-500/15 text-green-400 border border-green-500/20" :
                  "bg-white/5 text-white/40 border border-white/5 hover:bg-white/10"
                }`}>
                {pos} {done && "✓"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-5">
        {/* Left: Selected picks */}
        <div className="md:col-span-2">
          <div className="glass p-5">
            <h3 className="text-sm font-bold text-white/60 mb-4">{currentPosition} picks</h3>
            <div className="space-y-3">
              {Array.from({ length: PICKS_PER_POSITION }).map((_, i) => {
                const player = selectedForPosition[i];
                return (
                  <div key={i} className={`rounded-xl border p-3 transition-all ${
                    player ? tierColors[i] : "border-white/5 bg-white/[0.02]"
                  }`}>
                    {player ? (
                      <div className="flex items-center gap-3">
                        {player.image ? (
                          <img src={player.image} alt={player.name} className="w-16 h-auto rounded-lg"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-16 h-20 rounded-lg bg-white/5 flex items-center justify-center text-2xl">⚽</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-white/40">{tierLabels[i]}</div>
                          <div className="font-bold text-sm truncate">{player.name}</div>
                          <div className="text-xs text-white/40 truncate">{player.team}</div>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-xl font-black ${getRatingColor(player.rating)}`}>{player.rating}</span>
                          <button onClick={() => removePlayer(i)}
                            className="text-red-400/40 hover:text-red-400 transition-colors text-xs">✕ remove</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 py-2">
                        <div className="w-16 h-20 rounded-lg border border-dashed border-white/10 flex items-center justify-center">
                          <span className="text-white/10 text-lg">?</span>
                        </div>
                        <div>
                          <div className="text-[10px] text-white/20">{tierLabels[i]}</div>
                          <div className="text-xs text-white/15">pick from the list →</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={goPrev} disabled={currentPosIndex === 0}
                className="glass-button px-4 py-2.5 text-sm disabled:opacity-20">← prev</button>
              <button onClick={goNext}
                disabled={currentPosIndex === POSITIONS.length - 1 || selectedForPosition.length !== PICKS_PER_POSITION}
                className="glass-button px-4 py-2.5 flex-1 text-sm disabled:opacity-20">
                {currentPosIndex === POSITIONS.length - 1 ? "last position" : "next →"}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Search & browse */}
        <div className="md:col-span-3">
          <div className="glass p-5">
            <h3 className="text-sm font-bold text-white/60 mb-3">browse FC26 players</h3>
            <input type="text" className="glass-input mb-3 text-sm"
              placeholder={`search ${currentPosition} players by name...`}
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            
            <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1">
              {searchLoading && (
                <div className="text-center py-8">
                  <div className="text-2xl mb-2 animate-pulse">⚽</div>
                  <p className="text-white/30 text-sm">loading FC26 players...</p>
                </div>
              )}
              {!searchLoading && searchResults.length === 0 && (
                <div className="text-center py-8 text-white/20 text-sm">no players found for this position</div>
              )}
              {!searchLoading && searchResults.map((player, idx) => {
                const alreadySelected = selectedForPosition.some(
                  p => p.name === player.name && p.team === player.team
                );
                const isFull = selectedForPosition.length >= PICKS_PER_POSITION;
                return (
                  <button key={`${player.id || player.name}-${idx}`}
                    onClick={() => selectPlayer(player)}
                    disabled={isFull || alreadySelected}
                    className={`w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all ${
                      alreadySelected ? "opacity-25 cursor-not-allowed bg-green-500/5 border border-green-500/20" :
                      isFull ? "opacity-40 cursor-not-allowed bg-white/[0.02] border border-white/5" :
                      "bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-white/15 cursor-pointer"
                    }`}>
                    {player.card ? (
                      <img src={player.card} alt="" className="w-10 h-auto rounded"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-10 h-12 rounded bg-white/5 flex items-center justify-center text-sm">⚽</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{player.name}</div>
                      <div className="text-[11px] text-white/35 truncate">{player.team} · {player.nationality} · {player.position}</div>
                    </div>
                    <span className={`text-lg font-black ${getRatingColor(player.rating)}`}>{player.rating}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      {allComplete && (
        <div className="mt-6 text-center fade-in">
          <button onClick={handleSave} disabled={saving}
            className="btn-gold px-14 py-4 text-lg font-black">
            {saving ? "saving..." : "start the auction! 🔥"}
          </button>
        </div>
      )}
    </div>
  );
}
