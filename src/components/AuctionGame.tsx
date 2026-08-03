"use client";

import { useState, useEffect, useRef } from "react";
import { RoomState, GamePlayer, PlayerData } from "@/lib/types";
import { formatMoney, getRatingColor, getTierLabel, getCardTier } from "@/lib/format";
import { POSITIONS } from "@/data/fifa-players";
import FormationView from "./FormationView";
import SpinWheel from "./SpinWheel";
import { playBidSound, playSpinSound, playHammerSound, playTimerWarning, playResultReveal } from "@/lib/sounds";

const BID_COUNTDOWN_SECONDS = 15;

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
  const [countdown, setCountdown] = useState<number | null>(null);
  const [budgetWarning, setBudgetWarning] = useState(false);

  // Track when we locally observed the last bid timestamp change
  const lastSeenBidAtRef = useRef<number | null>(null);
  const localDeadlineRef = useRef<number | null>(null);
  const prevBidCountRef = useRef(0);
  const prevAuctionActiveRef = useRef(false);
  const autoCloseCalledRef = useRef(false);
  const warningPlayedRef = useRef(false);

  const currentPlayer = gamePlayers.find(p => p.id === playerId);
  const pool = room.playerPool || {};
  const bidHistory = room.bidHistory || [];

  const activePlayers = gamePlayers.filter(p => !p.isHost && !p.isEliminated);
  const totalNeeded = activePlayers.length * 11;
  const totalFilled = activePlayers.reduce((s, p) => s + Object.keys(p.lineup || {}).length, 0);

  function showNotif(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }

  // Sound effects
  useEffect(() => {
    if (bidHistory.length > prevBidCountRef.current && bidHistory.length > 0) {
      playBidSound();
    }
    prevBidCountRef.current = bidHistory.length;
  }, [bidHistory.length]);

  useEffect(() => {
    if (prevAuctionActiveRef.current && !room.auctionActive) {
      playHammerSound();
    }
    if (!prevAuctionActiveRef.current && room.auctionActive) {
      playResultReveal();
    }
    prevAuctionActiveRef.current = room.auctionActive;
  }, [room.auctionActive]);

  // When lastBidAt changes from the server, set a LOCAL deadline = now + 15s
  // This avoids network delay issues - the countdown is always accurate locally
  useEffect(() => {
    if (!room.auctionActive) {
      lastSeenBidAtRef.current = null;
      localDeadlineRef.current = null;
      autoCloseCalledRef.current = false;
      warningPlayedRef.current = false;
      setCountdown(null);
      return;
    }

    const serverBidAt = room.lastBidAt;
    if (!serverBidAt) {
      lastSeenBidAtRef.current = null;
      localDeadlineRef.current = null;
      setCountdown(null);
      return;
    }

    // New bid detected from server
    if (serverBidAt !== lastSeenBidAtRef.current) {
      lastSeenBidAtRef.current = serverBidAt;
      localDeadlineRef.current = Date.now() + BID_COUNTDOWN_SECONDS * 1000;
      autoCloseCalledRef.current = false;
      warningPlayedRef.current = false;
    }
  }, [room.auctionActive, room.lastBidAt]);

  // Countdown tick based on local deadline
  useEffect(() => {
    if (!room.auctionActive || !localDeadlineRef.current) {
      return;
    }

    const tick = () => {
      if (!localDeadlineRef.current) return;
      const remaining = Math.max(0, (localDeadlineRef.current - Date.now()) / 1000);
      setCountdown(Math.ceil(remaining));

      if (remaining <= 3 && !warningPlayedRef.current) {
        playTimerWarning();
        warningPlayedRef.current = true;
      }

      if (remaining <= 0 && isHost && !autoCloseCalledRef.current) {
        autoCloseCalledRef.current = true;
        autoCloseAuction();
      }
    };

    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [room.auctionActive, room.lastBidAt, isHost]);

  useEffect(() => {
    setBudgetWarning(!!(currentPlayer && !currentPlayer.isHost && currentPlayer.budget < 100_000_000));
  }, [currentPlayer]);

  async function autoCloseAuction() {
    try {
      const res = await fetch(`/api/rooms/${room.id}/auction`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", playerId }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotif(data.winnerName ? `sold to ${data.winnerName}! 🔨` : "no bids, moving on");
      }
      onRefresh();
    } catch {
      autoCloseCalledRef.current = false;
    }
  }

  async function handleSpin() {
    setSpinning(true); setSpinResult(null); playSpinSound();
    try {
      const res = await fetch(`/api/rooms/${room.id}/spin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.finished) { onRefresh(); return; }
      setTimeout(() => { setSpinResult(data.result); setSpinning(false); playResultReveal(); onRefresh(); }, 3000);
    } catch (err) { showNotif(err instanceof Error ? err.message : "Spin failed"); setSpinning(false); }
  }

  async function handleStartAuction() {
    const price = parseInt(startPrice.replace(/,/g, ""));
    if (isNaN(price) || price < 0) { showNotif("enter a valid starting price!"); return; }
    setActionLoading(true); autoCloseCalledRef.current = false;
    try {
      const res = await fetch(`/api/rooms/${room.id}/auction`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", playerId, amount: price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStartPrice(""); onRefresh();
    } catch (err) { showNotif(err instanceof Error ? err.message : "Failed"); }
    finally { setActionLoading(false); }
  }

  async function handleBid() {
    const amount = parseInt(bidAmount.replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0) { showNotif("enter a valid bid!"); return; }
    if (currentPlayer && amount > currentPlayer.budget * 0.5 && amount > 100_000_000) {
      if (!confirm(`That's ${Math.round(amount / currentPlayer.budget * 100)}% of your budget. Continue?`)) return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}/auction`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bid", playerId, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Immediately set local deadline so our timer resets instantly
      localDeadlineRef.current = Date.now() + BID_COUNTDOWN_SECONDS * 1000;
      autoCloseCalledRef.current = false;
      warningPlayedRef.current = false;
      setBidAmount(""); showNotif("bid placed! 🔥"); onRefresh();
    } catch (err) { showNotif(err instanceof Error ? err.message : "Bid failed"); }
    finally { setActionLoading(false); }
  }

  async function handleSkip() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}/auction`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip", playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSpinResult(null); onRefresh();
    } catch (err) { showNotif(err instanceof Error ? err.message : "Failed"); }
    finally { setActionLoading(false); }
  }

  async function handleFine() {
    const amount = parseInt(fineAmount.replace(/,/g, ""));
    if (!fineTarget || isNaN(amount) || amount <= 0) { showNotif("pick a player and enter amount!"); return; }
    try {
      const res = await fetch(`/api/rooms/${room.id}/fine`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostPlayerId: playerId, targetPlayerId: fineTarget, amount, reason: fineReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowFineModal(false); setFineTarget(""); setFineAmount(""); setFineReason("");
      showNotif("fine applied! 💸"); onRefresh();
    } catch (err) { showNotif(err instanceof Error ? err.message : "Failed to fine"); }
  }

  async function handleFinishGame() {
    if (!confirm("end the game early?")) return;
    try {
      const res = await fetch(`/api/rooms/${room.id}/finish`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onRefresh();
    } catch (err) { showNotif(err instanceof Error ? err.message : "Failed"); }
  }

  const currentAuctionPlayer: PlayerData | null =
    room.currentPosition && room.currentOptionIndex !== null
      ? pool[room.currentPosition]?.[room.currentOptionIndex] || null : null;

  const highestBidderPlayer = room.currentHighestBidder
    ? gamePlayers.find(p => p.id === room.currentHighestBidder) : null;

  const currentLineup = (currentPlayer?.lineup || {}) as Record<string, PlayerData>;
  const alreadyHasPosition = room.currentPosition ? !!currentLineup[room.currentPosition] : false;
  const canBid = !!(currentPlayer && !currentPlayer.isEliminated && !currentPlayer.isHost &&
    room.currentPosition && !alreadyHasPosition && room.auctionActive);

  const quickBids = [
    { label: "+5M", value: (room.currentHighestBid || 0) + 5_000_000 },
    { label: "+10M", value: (room.currentHighestBid || 0) + 10_000_000 },
    { label: "+25M", value: (room.currentHighestBid || 0) + 25_000_000 },
    { label: "+50M", value: (room.currentHighestBid || 0) + 50_000_000 },
    { label: "+100M", value: (room.currentHighestBid || 0) + 100_000_000 },
  ];

  const hasAnyBid = room.lastBidAt !== null && room.lastBidAt !== undefined;
  const timerExpired = countdown !== null && countdown <= 0;
  const timerUrgent = countdown !== null && countdown <= 3;

  return (
    <div className="max-w-7xl mx-auto fade-in">
      {notification && (
        <div className="fixed top-4 right-4 z-50 glass-strong px-6 py-3 text-sm font-medium fade-in">{notification}</div>
      )}

      {budgetWarning && currentPlayer && !currentPlayer.isHost && (
        <div className="glass p-3 mb-4 border-red-500/30 bg-red-500/5 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <span className="text-sm font-semibold text-red-400">low budget</span>
          <span className="text-xs text-white/40">${formatMoney(currentPlayer.budget)} left</span>
        </div>
      )}

      {/* Header */}
      <div className="glass p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xl">⚽</div>
          <div>
            <h2 className="text-lg font-bold">the auction</h2>
            <p className="text-xs text-white/40">
              room: <span className="text-purple-400 font-mono">{room.code}</span> ·
              squads: {totalFilled}/{totalNeeded}
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
              <button onClick={handleFinishGame} className="glass-button px-3 py-2 text-xs">🏁 end</button>
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
                        {complete && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">✓</span>}
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
                    }`}>
                      <div className="font-bold text-[9px]">{pos}</div>
                      {hasPlayer && <div className="text-[8px] text-white/40 truncate">{hasPlayer.name.split(" ").pop()}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <div className="lg:col-span-9 space-y-4">
          {/* IDLE */}
          {!room.auctionActive && !room.wheelResult && !spinning && (
            <div className="glass p-12 text-center">
              <div className="text-7xl mb-4 inline-block" style={{ filter: "drop-shadow(0 0 20px rgba(124,58,237,0.3))" }}>🎰</div>
              <h3 className="text-3xl font-black mb-2">ready to spin?</h3>
              <p className="text-white/40 max-w-md mx-auto mb-6">
                {isHost ? "spin the wheel to pick a position and player tier" : "waiting for the host to spin..."}
              </p>
              {isHost ? (
                <button onClick={handleSpin} className="btn-gold px-16 py-5 text-xl font-black hover:scale-105 transition-transform">
                  🎡 SPIN THE WHEEL
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 text-white/30 text-sm">
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

          {/* SPIN RESULT */}
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
                    ) : <div className="text-6xl mb-3">⚽</div>}
                    <div className="inline-block px-3 py-1 rounded-lg bg-black/30 mb-2">
                      <span className={`text-3xl font-black ${getRatingColor(currentAuctionPlayer.rating)}`}>{currentAuctionPlayer.rating}</span>
                    </div>
                    <div className="text-xl font-bold mt-2">{currentAuctionPlayer.name}</div>
                    <div className="text-white/50 text-sm">{currentAuctionPlayer.team}</div>
                  </div>
                </div>
              </div>
              {isHost ? (
                <div className="space-y-4 max-w-sm mx-auto">
                  <p className="text-sm text-white/50 text-center">set the starting price</p>
                  <input type="text" className="glass-input text-center text-xl font-bold" placeholder="e.g. 50000000"
                    value={startPrice} onChange={e => setStartPrice(e.target.value.replace(/[^0-9]/g, ""))} />
                  {startPrice && <p className="text-sm text-white/40 text-center">= <span className="text-yellow-400 font-bold">${formatMoney(parseInt(startPrice) || 0)}</span></p>}
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
            <div className="grid lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3 glass p-6 auction-active">
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span className="badge badge-purple">{room.currentPosition}</span>
                    <span className="badge badge-gold">{getTierLabel(room.currentOptionIndex || 0)}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 animate-pulse font-bold">LIVE</span>
                  </div>

                  {/* 15-second countdown after a bid */}
                  {hasAnyBid && countdown !== null && (
                    <div className="mb-4">
                      <div className={`text-5xl font-black transition-colors ${
                        timerExpired ? "text-red-400" : timerUrgent ? "text-red-400 animate-pulse" : countdown <= 7 ? "text-yellow-400" : "text-green-400"
                      }`}>
                        {timerExpired ? "SOLD!" : `${countdown}s`}
                      </div>
                      <div className="w-48 h-2 bg-white/10 rounded-full mx-auto mt-2 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-200 ${
                          timerUrgent ? "bg-red-500" : countdown !== null && countdown <= 7 ? "bg-yellow-500" : "bg-green-500"
                        }`} style={{ width: `${Math.max(0, ((countdown || 0) / BID_COUNTDOWN_SECONDS) * 100)}%` }} />
                      </div>
                      <p className="text-xs text-white/30 mt-1">
                        {timerExpired ? "auction closed!" : "resets to 15s after each bid"}
                      </p>
                    </div>
                  )}

                  {!hasAnyBid && (
                    <div className="mb-4">
                      <div className="text-2xl font-bold text-white/20">waiting for bids...</div>
                      <p className="text-xs text-white/30 mt-1">15 second countdown starts after the first bid</p>
                    </div>
                  )}

                  {/* Player Card */}
                  <div className={`player-card ${getCardTier(room.currentOptionIndex || 0)} max-w-[200px] mx-auto mb-4 p-4`}>
                    <div className="text-center">
                      {currentAuctionPlayer.image ? (
                        <img src={currentAuctionPlayer.image} alt={currentAuctionPlayer.name} className="w-24 mx-auto mb-1 rounded-lg" />
                      ) : <div className="text-4xl mb-2">⚽</div>}
                      <div className={`text-2xl font-black ${getRatingColor(currentAuctionPlayer.rating)}`}>{currentAuctionPlayer.rating}</div>
                      <div className="text-sm font-bold mt-1">{currentAuctionPlayer.name}</div>
                      <div className="text-white/40 text-xs">{currentAuctionPlayer.team}</div>
                    </div>
                  </div>

                  {/* Current bid */}
                  <div className="glass-strong p-4 max-w-sm mx-auto mb-4">
                    <div className="text-xs text-white/40 mb-1">{highestBidderPlayer ? "highest bid" : "starting price"}</div>
                    <div className="text-3xl font-black text-yellow-400">${formatMoney(room.currentHighestBid || 0)}</div>
                    {highestBidderPlayer && <div className="text-sm text-green-400">👑 {highestBidderPlayer.name}</div>}
                    {!highestBidderPlayer && <div className="text-sm text-white/30">no bids yet</div>}
                  </div>
                </div>

                {/* Bid controls - only show if timer hasn't expired */}
                {canBid && !timerExpired && (
                  <div className="max-w-sm mx-auto space-y-3">
                    <div className="grid grid-cols-5 gap-2">
                      {quickBids.map(qb => (
                        <button key={qb.label} onClick={() => setBidAmount(qb.value.toString())}
                          className="glass-button px-2 py-2.5 text-xs font-medium disabled:opacity-20"
                          disabled={qb.value > (currentPlayer?.budget || 0)}>{qb.label}</button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" className="glass-input flex-1 text-lg font-bold" placeholder="your bid..."
                        value={bidAmount} onChange={e => setBidAmount(e.target.value.replace(/[^0-9]/g, ""))}
                        onKeyDown={e => e.key === "Enter" && canBid && handleBid()} />
                      <button onClick={handleBid} disabled={actionLoading}
                        className="btn-gold px-6 text-lg font-black disabled:opacity-40">
                        {actionLoading ? "..." : "BID 🔥"}
                      </button>
                    </div>
                    {bidAmount && (
                      <div className="flex items-center justify-between text-xs text-white/40 px-1">
                        <span>bid: ${formatMoney(parseInt(bidAmount) || 0)}</span>
                        <span className={parseInt(bidAmount) > ((currentPlayer?.budget || 0) * 0.5) ? "text-red-400" : ""}>
                          left: ${formatMoney((currentPlayer?.budget || 0) - (parseInt(bidAmount) || 0))}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {currentPlayer && room.currentPosition && alreadyHasPosition && !currentPlayer.isHost && (
                  <p className="text-center text-yellow-400/60 text-sm mt-4">you already have a {room.currentPosition}</p>
                )}
                {currentPlayer?.isEliminated && <p className="text-center text-red-400 text-sm mt-4">you&apos;re eliminated 💀</p>}
                {currentPlayer?.isHost && <p className="text-center text-white/40 text-sm mt-4">you&apos;re the host</p>}

                {isHost && !hasAnyBid && (
                  <div className="mt-6 text-center">
                    <button onClick={handleSkip} disabled={actionLoading} className="glass-button px-6 py-2 text-xs text-white/40">
                      skip (no one wants this) ⏭️
                    </button>
                  </div>
                )}
              </div>

              {/* Bid History */}
              <div className="lg:col-span-2 glass p-4">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">📢 bid history</h3>
                <div className="max-h-[400px] overflow-y-auto space-y-2">
                  {bidHistory.length === 0 && (
                    <div className="text-center text-white/20 text-xs py-4">no bids yet...</div>
                  )}
                  {[...bidHistory].reverse().map((bid, idx) => (
                    <div key={idx} className="fade-in px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-purple-300">{bid.playerName}</span>
                        <span className="text-xs text-yellow-400 font-bold">${formatMoney(bid.amount)}</span>
                      </div>
                      <div className="text-[10px] text-white/20 mt-0.5">
                        {new Date(bid.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Lineups */}
          {showLineups && (
            <div className="glass p-6">
              <h3 className="text-lg font-bold mb-4">📋 everyone&apos;s lineups</h3>
              <div className="flex gap-2 mb-4 flex-wrap">
                {gamePlayers.filter(p => !p.isHost).map(p => (
                  <button key={p.id} onClick={() => setSelectedLineupPlayer(selectedLineupPlayer === p.id ? null : p.id)}
                    className={`glass-button px-4 py-2 text-sm transition-all ${
                      selectedLineupPlayer === p.id ? "bg-purple-600/20 border-purple-500/40 text-purple-300" : ""
                    }`}>
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
