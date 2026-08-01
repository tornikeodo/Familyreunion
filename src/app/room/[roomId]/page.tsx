"use client";

import { useEffect, useState, useCallback, use } from "react";
import { RoomState, GamePlayer } from "@/lib/types";
import Lobby from "@/components/Lobby";
import PlayerSetup from "@/components/PlayerSetup";
import AuctionGame from "@/components/AuctionGame";
import GameFinished from "@/components/GameFinished";

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>([]);
  const [playerId, setPlayerId] = useState<string>("");
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (!res.ok) {
        setError("Room not found 😢");
        return;
      }
      const data = await res.json();
      setRoom(data.room);
      setGamePlayers(data.players);
    } catch {
      // silently fail on poll errors
    }
  }, [roomId]);

  useEffect(() => {
    const pid = localStorage.getItem("playerId") || "";
    setPlayerId(pid);
  }, []);

  useEffect(() => {
    if (playerId && gamePlayers.length > 0) {
      const me = gamePlayers.find(p => p.id === playerId);
      setIsHost(me?.isHost || false);
    }
  }, [playerId, gamePlayers]);

  useEffect(() => {
    fetchRoom();
    const interval = setInterval(fetchRoom, 2000);
    return () => clearInterval(interval);
  }, [fetchRoom]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass p-8 text-center">
          <div className="text-5xl mb-4">😢</div>
          <h2 className="text-2xl font-bold mb-2">oops</h2>
          <p className="text-white/40 mb-4">{error}</p>
          <a href="/" className="btn-primary px-6 py-3 inline-block">go home</a>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">⚽</div>
          <p className="text-white/40">loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      {/* Nav */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <a href="/" className="text-lg font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Family Reunion
          </a>
          {playerId && (
            <span className="text-sm text-white/30">
              playing as <span className="text-white/60 font-medium">{gamePlayers.find(p => p.id === playerId)?.name}</span>
            </span>
          )}
        </div>
      </div>

      {/* Game States */}
      {room.status === "lobby" && (
        <Lobby
          room={room}
          gamePlayers={gamePlayers}
          isHost={isHost}
          onStartSetup={() => setShowSetup(true)}
        />
      )}

      {room.status === "lobby" && showSetup && isHost && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto py-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">🎯 player pool setup</h2>
              <button onClick={() => setShowSetup(false)} className="glass-button px-4 py-2">
                ✕ close
              </button>
            </div>
            <PlayerSetup
              roomId={roomId}
              playerId={playerId}
              onComplete={() => {
                setShowSetup(false);
                fetchRoom();
              }}
            />
          </div>
        </div>
      )}

      {room.status === "auction" && (
        <AuctionGame
          room={room}
          gamePlayers={gamePlayers}
          isHost={isHost}
          playerId={playerId}
          onRefresh={fetchRoom}
        />
      )}

      {room.status === "finished" && (
        <GameFinished gamePlayers={gamePlayers} />
      )}
    </div>
  );
}
