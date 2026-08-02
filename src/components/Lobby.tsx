"use client";

import { RoomState, GamePlayer } from "@/lib/types";

interface Props {
  room: RoomState;
  gamePlayers: GamePlayer[];
  isHost: boolean;
  onStartSetup: () => void;
}

export default function Lobby({ room, gamePlayers, isHost, onStartSetup }: Props) {
  return (
    <div className="max-w-lg mx-auto fade-in">
      <div className="glass p-8 text-center">
        <div className="text-5xl mb-4">⚽</div>
        <h2 className="text-3xl font-bold mb-2">The Auction</h2>
        <p className="text-white/40 mb-6">waiting for players to join...</p>

        {/* Room Code */}
        <div className="glass-strong p-6 mb-6">
          <p className="text-sm text-white/40 mb-2">share this code with everyone</p>
          <p className="text-4xl font-black tracking-[0.3em] text-purple-400">{room.code}</p>
        </div>

        {/* Players List */}
        <div className="mb-6">
          <p className="text-sm text-white/40 mb-3">
            players ({gamePlayers.length}/{room.maxPlayers})
          </p>
          <div className="space-y-2">
            {gamePlayers.map((p) => (
              <div key={p.id} className="glass-button px-4 py-3 flex items-center justify-between cursor-default">
                <span className="font-medium">{p.name}</span>
                {p.isHost && <span className="badge badge-gold">HOST</span>}
              </div>
            ))}
            {Array.from({ length: room.maxPlayers - gamePlayers.length }).map((_, i) => (
              <div key={`empty-${i}`} className="glass-button px-4 py-3 opacity-30 cursor-default">
                <span className="text-white/30">waiting for player...</span>
              </div>
            ))}
          </div>
        </div>

        {/* Game Rules */}
        <div className="glass p-4 mb-6 text-left text-sm">
          <h4 className="font-bold text-white/60 mb-2">📋 how it works:</h4>
          <ul className="text-white/40 space-y-1 text-xs">
            <li>• host picks 3 players per position (best, 2nd, 3rd)</li>
            <li>• wheel spins to decide which position + tier gets auctioned</li>
            <li>• everyone bids, highest bidder wins</li>
            <li>• game continues until everyone has a full XI</li>
            <li>• then teams compete in a tournament!</li>
          </ul>
        </div>

        {isHost && gamePlayers.length >= 2 && (
          <button onClick={onStartSetup} className="btn-primary w-full py-4 text-lg">
            set up player pool 🎯
          </button>
        )}

        {isHost && gamePlayers.length < 2 && (
          <p className="text-white/30 text-sm">need at least 2 players to start</p>
        )}

        {!isHost && (
          <p className="text-white/30 text-sm">waiting for the host to start the game...</p>
        )}
      </div>
    </div>
  );
}
