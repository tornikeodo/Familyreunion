"use client";

import { useState, useEffect, useCallback } from "react";
import { POSITIONS, type Position } from "@/data/fifa-players";
import type { FifaPlayer } from "@/data/fifa-players";
import { getRatingColor } from "@/lib/format";

interface PlayerOption {
  name: string;
  rating: number;
  team: string;
  image: string;
}

interface Props {
  roomId: string;
  playerId: string;
  onComplete: () => void;
}

export default function PlayerSetup({ roomId, playerId, onComplete }: Props) {
  const [currentPosIndex, setCurrentPosIndex] = useState(0);
  const [playerPool, setPlayerPool] = useState<Record<string, PlayerOption[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FifaPlayer[]>([]);
  const [selectedForPosition, setSelectedForPosition] = useState<PlayerOption[]>([]);
  const [loading, setLoading] = useState(false);
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
      // ignore
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
      if (searchQuery.length > 0) {
        doSearch(searchQuery, currentPosition);
      } else {
        doSearch("", currentPosition);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, currentPosition, doSearch]);

  function selectPlayer(player: FifaPlayer) {
    if (selectedForPosition.length >= 3) return;
    // Don't allow duplicates
    if (selectedForPosition.some(p => p.name === player.name && p.team === player.team)) return;
    
    const option: PlayerOption = {
      name: player.name,
      rating: player.rating,
      team: player.team,
      image: "",
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
    if (selectedForPosition.length !== 3) return;
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
    // Check all positions have 3 players
    for (const pos of POSITIONS) {
      if (!playerPool[pos] || playerPool[pos].length !== 3) {
        alert(`Pick 3 players for ${pos} first!`);
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

  const allComplete = POSITIONS.every(pos => playerPool[pos]?.length === 3);
  const completedCount = POSITIONS.filter(pos => playerPool[pos]?.length === 3).length;

  const tierLabels = ["⭐ Best (1st)", "🥈 Second (2nd)", "🥉 Third (3rd)"];

  return (
    <div className="max-w-4xl mx-auto fade-in">
      <div className="glass p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">set up the player pool</h2>
            <p className="text-white/40 text-sm">pick 3 options per position (best → worst)</p>
          </div>
          <div className="badge badge-purple">
            {completedCount}/{POSITIONS.length} done
          </div>
        </div>

        {/* Position pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {POSITIONS.map((pos, idx) => {
            const done = playerPool[pos]?.length === 3;
            const active = idx === currentPosIndex;
            return (
              <button
                key={pos}
                onClick={() => setCurrentPosIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  active
                    ? "bg-purple-600 text-white"
                    : done
                    ? "bg-green-600/30 text-green-400 border border-green-500/30"
                    : "glass-button"
                }`}
              >
                {pos} {done && "✓"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Selected players for this position */}
        <div className="glass p-6">
          <h3 className="text-lg font-bold mb-4">
            {currentPosition}: your 3 picks
          </h3>
          <div className="space-y-3 mb-4">
            {[0, 1, 2].map((i) => {
              const player = selectedForPosition[i];
              return (
                <div
                  key={i}
                  className={`player-card ${i === 0 ? "gold" : i === 1 ? "silver" : "bronze"} ${
                    !player ? "opacity-30" : ""
                  }`}
                >
                  {player ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-white/40 mb-1">{tierLabels[i]}</div>
                        <div className="font-bold">{player.name}</div>
                        <div className="text-sm text-white/50">{player.team}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-2xl font-black ${getRatingColor(player.rating)}`}>
                          {player.rating}
                        </span>
                        <button
                          onClick={() => removePlayer(i)}
                          className="text-red-400/60 hover:text-red-400 transition-colors text-lg"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <div className="text-xs text-white/30">{tierLabels[i]}</div>
                      <div className="text-white/20 text-sm mt-1">pick a player...</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <button
              onClick={goPrev}
              disabled={currentPosIndex === 0}
              className="glass-button px-4 py-2 disabled:opacity-30"
            >
              ← prev
            </button>
            <button
              onClick={goNext}
              disabled={currentPosIndex === POSITIONS.length - 1 || selectedForPosition.length !== 3}
              className="glass-button px-4 py-2 flex-1 disabled:opacity-30"
            >
              next →
            </button>
          </div>
        </div>

        {/* Right: Search and pick */}
        <div className="glass p-6">
          <h3 className="text-lg font-bold mb-4">search players</h3>
          <input
            type="text"
            className="glass-input mb-4"
            placeholder={`search for ${currentPosition} players...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {searchLoading && (
              <div className="text-center py-4 text-white/30">searching...</div>
            )}
            {!searchLoading && searchResults.length === 0 && (
              <div className="text-center py-4 text-white/30">no players found</div>
            )}
            {!searchLoading &&
              searchResults.map((player, idx) => {
                const alreadySelected = selectedForPosition.some(
                  (p) => p.name === player.name && p.team === player.team
                );
                return (
                  <button
                    key={`${player.name}-${player.team}-${idx}`}
                    onClick={() => selectPlayer(player)}
                    disabled={selectedForPosition.length >= 3 || alreadySelected}
                    className={`w-full text-left glass-button px-4 py-3 flex items-center justify-between ${
                      alreadySelected ? "opacity-30" : ""
                    } disabled:cursor-not-allowed`}
                  >
                    <div>
                      <div className="font-medium">{player.name}</div>
                      <div className="text-xs text-white/40">
                        {player.team} • {player.nationality} • {player.position}
                      </div>
                    </div>
                    <span className={`text-lg font-bold ${getRatingColor(player.rating)}`}>
                      {player.rating}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* Save button */}
      {allComplete && (
        <div className="mt-6 text-center fade-in">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="btn-gold px-12 py-4 text-lg"
          >
            {saving ? "saving..." : "start the auction! 🔥"}
          </button>
        </div>
      )}
    </div>
  );
}
