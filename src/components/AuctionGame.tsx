"use client";

import { useState } from "react";
import { RoomState, GamePlayer, PlayerData } from "@/lib/types";
import { formatMoney, getRatingColor, getTierLabel, getCardTier } from "@/lib/format";
import { POSITIONS } from "@/data/fifa-players";
import FormationView from "./FormationView";
import SpinWheel from "./SpinWheel";

interface Props {
  room: RoomState;
  gamePlayers: GamePlayer[];
  isHost: boolean;
  playerId: string;
  onRefresh: () => void;
}

export default function AuctionGame({ room, gamePlayers, isHost, playerId, onRefresh }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [startPrice, setStartPrice] = useState("");
  const [showFineModal, setShowFineModal] = useState(false);
  const [fineTarget, setFineTarget] = useState("");
  const [fineAmount, setFineAmount] = useState("");
  const [fineReason, setFineReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showLineups, setShowLineups] = useState(false);
  const [selectedLineupPlayer, setSelectedLineupPlayer] = useState<string | null>(null);
  const [spinResult, setSpinResult] = useState<{ position: string; optionIndex: number } | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const currentPlayer = gamePlayers.find(p => p.id === playerId);
  const pool = room.playerPool || {};

  // Progress tracking
  const activePlayers = gamePlayers.filter(p => !p.isHost && !p.isEliminated);
  const totalNeeded = activePlayers.length * 11;
  const totalFilled = activePlayers.reduce((s, p) => s + Object.keys(p.lineup || {}).length, 0);

  function showNotif(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }

  async function handleSpin() {
    setSpinning(true);
    setSpinResult(null);
    try {
      const res = await fetch(`/api/rooms/${room.id}/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.finished) { onRefresh(); return; }
      setTimeout(() => {
        setSpinResult(data.result);
        setSpinning(false);
        onRefresh();
      }, 3000);
    } catch (err) {
      showNotif(err instanceof Error ? err.message : "Spin failed");
      setSpinning(false);
    }
  }

  async function handleStartAuction() {
    const price = parseInt(startPrice.replace(/,/g, ""));
    if (isNaN(price) || price < 0) { showNotif("enter a valid starting price!"); return; }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}/auction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", playerId, amount: price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStartPrice("");
      onRefresh();
    } catch (err) { showNotif(err instanceof Error ? err.message : "Failed"); }
    finally { setActionLoading(false); }
  }

  async function handleBid() {
    const amount = parseInt(bidAmount.replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0) { showNotif("enter a valid bid!"); return; }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}/auction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bid", playerId, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBidAmount("");
      showNotif("bid placed! 🔥");
      onRefresh();
    } catch (err) { showNotif(err instanceof Error ? err.message : "Bid failed"); }
    finally { setActionLoading(false); }
  }

  async function handleCloseAuction() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}/auction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSpinResult(null);
      showNotif("sold! 🔨");
      onRefresh();
    } catch (err) { showNotif(err instanceof Error ? err.message : "Failed"); }
    finally { setActionLoading(false); }
  }

  async function handleSkip() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}/auction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip", playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSpinResult(null);
      onRefresh();
    } catch (err) { showNotif(err instanceof Error ? err.message : "Failed"); }
    finally { setActionLoading(false); }
  }

  async function handleFine() {
    const amount = parseInt(fineAmount.replace(/,/g, ""));
    if (!fineTarget || isNaN(amount) || amount <= 0) { showNotif("pick a player and enter amount!"); return; }
    try {
      const res = await fetch(`/api/rooms/${room.id}/fine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostPlayerId: playerId, targetPlayerId: fineTarget, amount, reason: fineReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowFineModal(false); setFineTarget(""); setFineAmount(""); setFineReason("");
      showNotif("fine applied! 💸");
      onRefresh();
    } catch (err) { showNotif(err instanceof Error ? err.message : "Failed to fine"); }
  }

  async function handleFinishGame() {
    if (!confirm("are you sure you wanna end the game early?")) return;
    try {
      const res = await fetch(`/api/rooms/${room.id}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onRefresh();
    } catch (err) { showNotif(err instanceof Error ? err.message : "Failed"); }
  }

  const currentAuctionPlayer: PlayerData | null =
    room.currentPosition && room.currentOptionIndex !== null
      ? pool[room.currentPosition]?.[room.currentOptionIndex] || null
      : null;

  const highestBidderPlayer = room.currentHighestBidder
    ? gamePlayers.find(p => p.id === room.currentHighestBidder)
    : null;

  const currentLineup = (currentPlayer?.lineup || {}) as Record<string, PlayerData>;
  const alreadyHasPosition = room.currentPosition ? !!currentLineup[room.currentPosition] : false;
  const canBid = !!(currentPlayer && !currentPlayer.isEliminated && !currentPlayer.isHost &&
    room.currentPosition && !alreadyHasPosition && room.auctionActive);

  const quickBids = [
    { label: "+10M", value: (room.currentHighestBid || 0) + 10_000_000 },
    { label: "+25M", value: (room.currentHighestBid || 0) + 25_000_000 },
    { label: "+50M", value: (room.currentHighestBid || 0) + 50_000_000 },
    { label: "+100M", value: (room.currentHighestBid || 0) + 100_000_000 },
  ];

  return (
    <div className="max-w-7xl mx-auto fade-in">
      {notification && (
        <div className="fixed top-4 right-4 z-50 glass-strong px-6 py-3 text-sm font-medium fade-in">{notification}</div>
      )}

      {/* Header */}
      <div className="glass p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xl">⚽</div>
          <div>
            <h2 className="text-lg font-bold">the auction</h2>
            <p className="text-xs text-white/40">
              room: <span className="text-purple-400 font-mono">{room.code}</span> •
              squads: {totalFilled}/{totalNeeded} positions filled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${totalNeeded ? (totalFilled / totalNeeded) * 100 : 0}%` }} />
          </div>
          <button onClick={() => setShowLineups(!showLineups)} className="glass-button px-3 py-2 text-xs">
            {showLineups ? "✕ hide" : "👀 lineups"}
          </button>
          {isHost && (
            <>
              <button onClick={() => setShowFineModal(true)} className="glass-button px-3 py-2 text-xs text-red-400">💰 fine</button>
              <button onClick={handleFinishGame} className="glass-button px-3 py-2 text-xs">🏁 end early</button>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-4">
        {/* Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <div className="glass p-4">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">💰 budgets</h3>
            <div className="space-y-2">
              {gamePlayers.map(p => {
                const filled = Object.keys(p.lineup || {}).length;
                const complete = filled >= 11 && !p.isHost;
                return (
                  <div key={p.id} className={`px-3 py-3 rounded-xl transition-all ${
                    p.isEliminated ? "bg-red-500/5 opacity-40 border border-red-500/10" :
                    p.isHost ? "bg-yellow-500/5 border border-yellow-500/10" :
                    complete ? "bg-green-500/10 border border-green-500/30" :
                    p.id === room.currentHighestBidder && room.auctionActive
                      ? "bg-yellow-500/10 border border-yellow-500/30"
                      : "bg-white/5 border border-white/5"
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm">{p.name}</span>
                        {p.isHost && <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">HOST</span>}
                        {complete && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">✓ DONE</span>}
                      </div>
                      {p.isEliminated && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">💀</span>}
                    </div>
                    {!p.isHost && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-bold ${p.budget < 100_000_000 ? "text-red-400" : "text-green-400"}`}>${formatMoney(p.budget)}</span>
                          <span className="text-[10px] text-white/30">{filled}/11</span>
                        </div>
                        <div className="w-full h-1 bg-white/5 rounded-full mt-1.5 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${complete ? "bg-green-500" : "bg-gradient-to-r from-purple-500 to-blue-500"}`}
                            style={{ width: `${(filled / 11) * 100}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {currentPlayer && !currentPlayer.isHost && (
            <div className="glass p-4">
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">📋 your squad</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {POSITIONS.map(pos => {
                  const hasPlayer = currentLineup[pos];
                  return (
                    <div key={pos} className={`text-center p-1.5 rounded-lg text-[10px] transition-all ${
                      hasPlayer ? "bg-green-500/15 border border-green-500/25" :
                      pos === room.currentPosition ? "bg-purple-500/15 border border-purple-500/30 animate-pulse" :
                      "bg-white/3 border border-white/5"
                    }`} title={hasPlayer ? hasPlayer.name : pos}>
                      <div className="font-bold text-[9px]">{pos}</div>
                      {hasPlayer && <div className="text-[8px] text-white/40 truncate">{hasPlayer.name.split(" ").pop()}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Main Area */}
        <div className="lg:col-span-9 space-y-4">
          {/* IDLE */}
          {!room.auctionActive && !room.wheelResult && !spinning && (
            <div className="glass p-12 text-center">
              <div className="text-7xl mb-4 inline-block" style={{ filter: "drop-shadow(0 0 20px rgba(124,58,237,0.3))" }}>🎰</div>
              <h3 className="text-3xl font-black mb-2">ready to spin?</h3>
              <p className="text-white/40 max-w-md mx-auto">
                {isHost ? "spin the wheel to pick a position and player tier for auction" : "waiting for the host to spin..."}
              </p>
              {isHost && (
                <button onClick={handleSpin} className="btn-gold px-16 py-5 text-xl font-black mt-6 hover:scale-105 transition-transform">
                  🎡 SPIN THE WHEEL
                </button>
              )}
              {!isHost && (
                <div className="inline-flex items-center gap-2 text-white/30 text-sm mt-6">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />waiting for host...
                </div>
              )}
            </div>
          )}

          {/* SPINNING */}
          {spinning && (
            <div className="glass p-12 text-center">
              <SpinWheel spinning={spinning} result={spinResult} onSpinComplete={() => {}} />
              <p className="text-white/40 mt-4 animate-pulse">spinning...</p>
            </div>
          )}

          {/* SPIN RESULT: set starting price */}
          {room.wheelResult && !room.auctionActive && !spinning && currentAuctionPlayer && (
            <div className="glass p-8 auction-active">
              <div className="text-center mb-6">
                <p className="text-sm text-white/40 mb-4">the wheel has spoken! 🎯</p>
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="glass-strong px-6 py-3 rounded-xl">
                    <div className="text-[10px] text-white/30 uppercase tracking-wider">position</div>
                    <div className="text-2xl font-black text-purple-400">{room.wheelResult.position}</div>
                  </div>
                  <div className="text-2xl text-white/20">×</div>
                  <div className="glass-strong px-6 py-3 rounded-xl">
                    <div className="text-[10px] text-white/30 uppercase tracking-wider">tier</div>
                    <div className="text-xl font-bold">{getTierLabel(room.wheelResult.optionIndex)}</div>
                  </div>
                </div>

                <div className={`player-card ${getCardTier(room.wheelResult.optionIndex)} max-w-xs mx-auto mb-6 p-6`}>
                  <div className="text-center">
                    {currentAuctionPlayer.image ? (
                      <img src={currentAuctionPlayer.image} alt={currentAuctionPlayer.name} className="w-32 mx-auto mb-2 rounded-lg" />
                    ) : (
                      <div className="text-6xl mb-3">⚽</div>
                    )}
                    <div className="inline-block px-3 py-1 rounded-lg bg-black/30 mb-2">
                      <span className={`text-3xl font-black ${getRatingColor(currentAuctionPlayer.rating)}`}>{currentAuctionPlayer.rating}</span>
                    </div>
                    <div className="text-xl font-bold mt-2">{currentAuctionPlayer.name}</div>
                    <div className="text-white/50 text-sm">{currentAuctionPlayer.team}</div>
                    <div className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] bg-white/10 text-white/40">{room.wheelResult.position}</div>
                  </div>
                </div>
              </div>

              {isHost ? (
                <div className="space-y-4 max-w-sm mx-auto">
                  <p className="text-sm text-white/50 text-center">set the starting price</p>
                  <input type="text" className="glass-input text-center text-xl font-bold" placeholder="e.g. 50000000"
                    value={startPrice} onChange={e => setStartPrice(e.target.value.replace(/[^0-9]/g, ""))} />
                  {startPrice && (
                    <p className="text-sm text-white/40 text-center">= <span className="text-yellow-400 font-bold">${formatMoney(parseInt(startPrice) || 0)}</span></p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {[1_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000].map(v => (
                      <button key={v} onClick={() => setStartPrice(v.toString())} className="glass-button px-3 py-1.5 text-xs flex-1">${formatMoney(v)}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleStartAuction} disabled={actionLoading} className="btn-gold flex-1 py-3 text-lg">
                      {actionLoading ? "starting..." : "🔨 start auction"}
                    </button>
                    <button onClick={handleSkip} disabled={actionLoading} className="glass-button px-6 py-3">skip ⏭️</button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 text-white/30 text-sm">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />host is setting the starting price...
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ACTIVE AUCTION */}
          {room.auctionActive && currentAuctionPlayer && (
            <div className="glass p-8 auction-active">
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="badge badge-purple">{room.currentPosition}</span>
                  <span className="badge badge-gold">{getTierLabel(room.currentOptionIndex || 0)}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 animate-pulse font-bold">LIVE</span>
                </div>

                <div className={`player-card ${getCardTier(room.currentOptionIndex || 0)} max-w-xs mx-auto mb-6 p-6`}>
                  <div className="text-center">
                    {currentAuctionPlayer.image ? (
                      <img src={currentAuctionPlayer.image} alt={currentAuctionPlayer.name} className="w-32 mx-auto mb-2 rounded-lg" />
                    ) : (
                      <div className="text-5xl mb-3">⚽</div>
                    )}
                    <div className="inline-block px-3 py-1 rounded-lg bg-black/30 mb-2">
                      <span className={`text-3xl font-black ${getRatingColor(currentAuctionPlayer.rating)}`}>{currentAuctionPlayer.rating}</span>
                    </div>
                    <div className="text-xl font-bold mt-2">{currentAuctionPlayer.name}</div>
                    <div className="text-white/50 text-sm">{currentAuctionPlayer.team}</div>
                  </div>
                </div>

                <div className="glass-strong p-6 max-w-sm mx-auto mb-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 to-orange-500/5" />
                  <div className="relative">
                    <div className="text-xs text-white/40 mb-1 uppercase tracking-wider">
                      {highestBidderPlayer ? "current highest bid" : "starting price"}
                    </div>
                    <div className="text-4xl font-black text-yellow-400 mb-1">${formatMoney(room.currentHighestBid || 0)}</div>
                    {highestBidderPlayer && <div className="text-sm text-green-400 font-medium">👑 {highestBidderPlayer.name}</div>}
                    {!highestBidderPlayer && <div className="text-sm text-white/30">no bids yet</div>}
                  </div>
                </div>
              </div>

              {canBid && (
                <div className="max-w-sm mx-auto space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    {quickBids.map(qb => (
                      <button key={qb.label} onClick={() => setBidAmount(qb.value.toString())}
                        className="glass-button px-2 py-2.5 text-xs font-medium disabled:opacity-20"
                        disabled={qb.value > (currentPlayer?.budget || 0)}>{qb.label}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" className="glass-input flex-1 text-lg font-bold" placeholder="your bid..."
                      value={bidAmount} onChange={e => setBidAmount(e.target.value.replace(/[^0-9]/g, ""))}
                      onKeyDown={e => e.key === "Enter" && handleBid()} />
                    <button onClick={handleBid} disabled={actionLoading} className="btn-gold px-8 text-lg font-black">
                      {actionLoading ? "..." : "BID 🔥"}
                    </button>
                  </div>
                  {bidAmount && (
                    <div className="flex items-center justify-between text-xs text-white/40 px-1">
                      <span>bid: ${formatMoney(parseInt(bidAmount) || 0)}</span>
                      <span>remaining: ${formatMoney((currentPlayer?.budget || 0) - (parseInt(bidAmount) || 0))}</span>
                    </div>
                  )}
                </div>
              )}

              {currentPlayer && room.currentPosition && alreadyHasPosition && !currentPlayer.isHost && (
                <p className="text-center text-yellow-400/60 text-sm mt-4">you already have a {room.currentPosition}, can&apos;t bid on this one</p>
              )}
              {currentPlayer?.isEliminated && <p className="text-center text-red-400 text-sm mt-4">you&apos;re eliminated 💀</p>}
              {currentPlayer?.isHost && <p className="text-center text-white/40 text-sm mt-4">you&apos;re the host, you don&apos;t bid</p>}

              {isHost && (
                <div className="mt-8 text-center">
                  <button onClick={handleCloseAuction} disabled={actionLoading} className="btn-danger px-10 py-4 text-lg font-bold">
                    {actionLoading ? "closing..." : "🔨 GOING ONCE, TWICE... SOLD!"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Lineups */}
          {showLineups && (
            <div className="glass p-6">
              <h3 className="text-lg font-bold mb-4">📋 everyone&apos;s lineups</h3>
              <div className="flex gap-2 mb-4 flex-wrap">
                {gamePlayers.filter(p => !p.isHost).map(p => (
                  <button key={p.id} onClick={() => setSelectedLineupPlayer(selectedLineupPlayer === p.id ? null : p.id)}
                    className={`glass-button px-4 py-2 text-sm transition-all ${selectedLineupPlayer === p.id ? "bg-purple-600/20 border-purple-500/40 text-purple-300" : ""}`}>
                    {p.name} ({Object.keys(p.lineup || {}).length}/11)
                  </button>
                ))}
              </div>
              {selectedLineupPlayer && (
                <FormationView
                  lineup={(gamePlayers.find(p => p.id === selectedLineupPlayer)?.lineup || {}) as Record<string, PlayerData & { pricePaid: number }>}
                  playerName={gamePlayers.find(p => p.id === selectedLineupPlayer)?.name || ""} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fine Modal */}
      {showFineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={() => setShowFineModal(false)}>
          <div className="glass-strong p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">💰 fine a player</h3>
              <button onClick={() => setShowFineModal(false)} className="text-white/30 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-1 block uppercase tracking-wider">who&apos;s getting fined?</label>
                <select value={fineTarget} onChange={e => setFineTarget(e.target.value)} className="glass-input">
                  <option value="" className="bg-gray-900">pick someone...</option>
                  {gamePlayers.filter(p => !p.isHost).map(p => (
                    <option key={p.id} value={p.id} className="bg-gray-900">{p.name} (${formatMoney(p.budget)})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block uppercase tracking-wider">fine amount</label>
                <input type="text" className="glass-input" placeholder="e.g. 50000000"
                  value={fineAmount} onChange={e => setFineAmount(e.target.value.replace(/[^0-9]/g, ""))} />
                {fineAmount && <p className="text-xs text-yellow-400 mt-1">${formatMoney(parseInt(fineAmount) || 0)}</p>}
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block uppercase tracking-wider">reason (optional)</label>
                <input type="text" className="glass-input" placeholder="talking too much" value={fineReason} onChange={e => setFineReason(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleFine} className="btn-danger flex-1 py-3">💸 fine them</button>
                <button onClick={() => setShowFineModal(false)} className="glass-button px-6 py-3">cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
