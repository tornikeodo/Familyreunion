"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getMedalEmbedUrl } from "@/lib/medal";

type GameMode = "auction" | "guess" | "whoami" | "price" | null;

interface Clip { id: string; url: string; title: string; author: string; pinned: boolean; createdAt: string; }

const games = [
  { id: "auction" as const, icon: "⚽", title: "The Auction", desc: "build your XI through bidding wars. everyone gets a budget, host picks the pool, wheel decides who's up.", tag: "multiplayer", accent: "purple" },
  { id: "guess" as const, icon: "🔍", title: "Guess the Player", desc: "blurred card on screen. clues drop one by one. first to guess right wins. fewer clues = more points.", tag: "trivia", accent: "emerald" },
  { id: "whoami" as const, icon: "❓", title: "Who Am I?", desc: "everyone gets a secret footballer they can't see. ask yes/no questions, figure out who you are first.", tag: "deduction", accent: "rose" },
  { id: "price" as const, icon: "💰", title: "Price is Right", desc: "see the player, guess what they're worth. closest without going over takes the round.", tag: "knowledge", accent: "amber" },
];

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join" | "upload" | null>(null);
  const [selectedGame, setSelectedGame] = useState<GameMode>(null);
  const [hostName, setHostName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [maxRounds, setMaxRounds] = useState(10);
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<{ roomId: string; name: string; type: string } | null>(null);
  const [clipList, setClipList] = useState<Clip[]>([]);
  const [clipUrl, setClipUrl] = useState("");
  const [clipTitle, setClipTitle] = useState("");
  const [clipAuthor, setClipAuthor] = useState("");
  const [clipMsg, setClipMsg] = useState("");
  const gamesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rid = localStorage.getItem("roomId"); const mid = localStorage.getItem("mgGameId");
    const n = localStorage.getItem("playerName") || localStorage.getItem("mgPlayerName");
    if (rid && n) setSaved({ roomId: rid, name: n, type: "auction" });
    else if (mid && n) setSaved({ roomId: mid, name: n, type: "minigame" });
  }, []);

  useEffect(() => { fetch("/api/clips").then(r=>r.json()).then(d=>setClipList(d.clips||[])).catch(()=>{}); }, []);

  async function handleCreate() {
    if (!hostName.trim()) { setError("what's your name?"); return; }
    setLoading(true); setError("");
    try {
      if (selectedGame === "auction") {
        const r = await fetch("/api/rooms", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ hostName:hostName.trim(), maxPlayers }) });
        const d = await r.json(); if(!r.ok) throw new Error(d.error);
        localStorage.setItem("playerId",d.playerId); localStorage.setItem("roomId",d.roomId); localStorage.setItem("playerName",hostName.trim());
        router.push(`/room/${d.roomId}`);
      } else {
        const r = await fetch("/api/minigames", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ hostName:hostName.trim(), gameType:selectedGame, maxRounds }) });
        const d = await r.json(); if(!r.ok) throw new Error(d.error);
        localStorage.setItem("mgPlayerId",d.playerId); localStorage.setItem("mgGameId",d.gameId); localStorage.setItem("mgPlayerName",hostName.trim());
        router.push(`/minigame/${d.gameId}`);
      }
    } catch(e:unknown){ setError(e instanceof Error ? e.message : "nope"); } finally { setLoading(false); }
  }

  async function handleJoin() {
    if (!joinCode.trim()||!joinName.trim()) { setError("need both fields"); return; }
    setLoading(true); setError("");
    try {
      const r1 = await fetch("/api/rooms/join",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:joinCode.trim().toUpperCase(),playerName:joinName.trim()})});
      if(r1.ok){const d=await r1.json();localStorage.setItem("playerId",d.playerId);localStorage.setItem("roomId",d.roomId);localStorage.setItem("playerName",joinName.trim());router.push(`/room/${d.roomId}`);return;}
      const r2 = await fetch("/api/minigames/join",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:joinCode.trim().toUpperCase(),playerName:joinName.trim()})});
      if(r2.ok){const d=await r2.json();localStorage.setItem("mgPlayerId",d.playerId);localStorage.setItem("mgGameId",d.gameId);localStorage.setItem("mgPlayerName",joinName.trim());router.push(`/minigame/${d.gameId}`);return;}
      const ed=await r2.json(); throw new Error(ed.error||"not found");
    } catch(e:unknown){ setError(e instanceof Error ? e.message : "nope"); } finally { setLoading(false); }
  }

  async function handleUpload() {
    if (!clipUrl.trim()||!clipTitle.trim()||!clipAuthor.trim()) { setClipMsg("fill everything in"); return; }
    if (!clipUrl.includes("medal.tv")) { setClipMsg("medal.tv links only"); return; }
    setLoading(true); setClipMsg("");
    try {
      const r = await fetch("/api/clips",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:clipUrl.trim(),title:clipTitle.trim(),author:clipAuthor.trim()})});
      const d=await r.json(); if(!r.ok) throw new Error(d.error);
      setClipUrl(""); setClipTitle(""); setClipAuthor(""); setClipMsg("done!"); setMode(null);
      fetch("/api/clips").then(r=>r.json()).then(d=>setClipList(d.clips||[])).catch(()=>{});
    } catch(e:unknown){ setClipMsg(e instanceof Error ? e.message : "failed"); } finally { setLoading(false); }
  }

  const heroClip = clipList.find(c=>c.pinned) || clipList[0];
  const gallery = clipList.filter(c=>c.id!==heroClip?.id);
  const sg = games.find(g=>g.id===selectedGame);

  // ======== OVERLAY FORMS ========
  if (mode) return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-[380px] fade-in">
        <button onClick={()=>{setMode(null);setSelectedGame(null);setError("");setClipMsg("");}} className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/50 transition mb-5">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>back
        </button>

        {mode==="create"&&selectedGame&&(
          <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-7">
            <div className="flex items-center gap-3 mb-6"><span className="text-2xl">{sg?.icon}</span><div><div className="font-semibold">{sg?.title}</div><div className="text-[11px] text-white/25">new game</div></div></div>
            <div className="space-y-4">
              <div><label className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1.5 block">name</label><input className="glass-input text-sm" placeholder="what do people call you" value={hostName} onChange={e=>setHostName(e.target.value)} maxLength={20}/></div>
              {selectedGame==="auction"&&<div><label className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1.5 block">players</label><div className="grid grid-cols-7 gap-1">{[2,3,4,5,6,7,8].map(n=><button key={n} onClick={()=>setMaxPlayers(n)} className={`py-2 rounded-lg text-xs font-medium transition ${maxPlayers===n?"bg-purple-500/20 text-purple-300 border border-purple-500/25":"bg-white/[0.02] text-white/20 border border-white/[0.04] hover:bg-white/[0.05]"}`}>{n}</button>)}</div></div>}
              {(selectedGame==="guess"||selectedGame==="price")&&<div><label className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1.5 block">rounds</label><div className="grid grid-cols-4 gap-1.5">{[5,10,15,20].map(n=><button key={n} onClick={()=>setMaxRounds(n)} className={`py-2 rounded-lg text-xs font-medium transition ${maxRounds===n?"bg-purple-500/20 text-purple-300 border border-purple-500/25":"bg-white/[0.02] text-white/20 border border-white/[0.04] hover:bg-white/[0.05]"}`}>{n}</button>)}</div></div>}
              {error&&<p className="text-red-400/70 text-xs text-center">{error}</p>}
              <button onClick={handleCreate} disabled={loading} className="w-full py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition disabled:opacity-30">{loading?"hold on...":"create"}</button>
            </div>
          </div>
        )}

        {mode==="join"&&(
          <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-7">
            <div className="font-semibold mb-1">join a game</div><p className="text-[11px] text-white/20 mb-6">works for any game type</p>
            <div className="space-y-4">
              <div><label className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1.5 block">code</label><input className="glass-input text-center text-xl tracking-[0.3em] uppercase font-mono" placeholder="ABCDE" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={5}/></div>
              <div><label className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1.5 block">name</label><input className="glass-input text-sm" placeholder="what do people call you" value={joinName} onChange={e=>setJoinName(e.target.value)} maxLength={20}/></div>
              {error&&<p className="text-red-400/70 text-xs text-center">{error}</p>}
              <button onClick={handleJoin} disabled={loading} className="w-full py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition disabled:opacity-30">{loading?"hold on...":"join"}</button>
            </div>
          </div>
        )}

        {mode==="upload"&&(
          <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-7">
            <div className="font-semibold mb-1">share a clip</div><p className="text-[11px] text-white/20 mb-6">paste a medal.tv link</p>
            <div className="space-y-4">
              <div><label className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1.5 block">medal.tv link</label><input className="glass-input text-xs" placeholder="https://medal.tv/games/..." value={clipUrl} onChange={e=>setClipUrl(e.target.value)}/></div>
              <div><label className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1.5 block">title</label><input className="glass-input text-sm" placeholder="what happened" value={clipTitle} onChange={e=>setClipTitle(e.target.value)} maxLength={100}/></div>
              <div><label className="text-[10px] text-white/25 uppercase tracking-[0.12em] mb-1.5 block">your name</label><input className="glass-input text-sm" placeholder="credit" value={clipAuthor} onChange={e=>setClipAuthor(e.target.value)} maxLength={30}/></div>
              {clipMsg&&<p className={`text-xs text-center ${clipMsg==="done!"?"text-green-400":"text-red-400/70"}`}>{clipMsg}</p>}
              <button onClick={handleUpload} disabled={loading} className="w-full py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition disabled:opacity-30">{loading?"uploading...":"share"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ======== MAIN PAGE ========
  return (
    <div className="min-h-screen">
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#08080f]/70 backdrop-blur-2xl border-b border-white/[0.03]">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-[8px] font-black text-white leading-none">FR</div>
            <span className="text-sm font-semibold text-white/70 hidden sm:inline">Family Reunion</span>
          </a>
          <div className="flex items-center gap-1.5">
            {saved && (
              <button onClick={()=>router.push(saved.type==="auction"?`/room/${saved.roomId}`:`/minigame/${saved.roomId}`)}
                className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] text-green-400 bg-green-500/8 border border-green-500/12 hover:bg-green-500/15 transition">
                <span className="w-1 h-1 bg-green-400 rounded-full animate-pulse"/>rejoin
              </button>
            )}
            <button onClick={()=>setMode("upload")} className="h-8 px-3 rounded-lg text-[11px] text-white/35 hover:text-white/60 hover:bg-white/[0.04] transition">share clip</button>
            <button onClick={()=>{setMode("join");setError("");}} className="h-8 px-3.5 rounded-lg text-[11px] font-medium text-white/50 bg-white/[0.04] border border-white/[0.05] hover:bg-white/[0.08] hover:text-white/80 transition">join game</button>
          </div>
        </div>
      </nav>

      {/* ====== HERO ====== */}
      <section className="relative pt-14">
        {/* Full-width hero video or gradient bg */}
        <div className="relative w-full overflow-hidden" style={{ height: "clamp(400px, 70vh, 700px)" }}>
          {/* Video background */}
          {heroClip ? (
            <div className="absolute inset-0">
              <iframe
                src={getMedalEmbedUrl(heroClip.url, { autoplay: true, muted: true, loop: true })}
                className="w-full h-full object-cover scale-110"
                allow="autoplay"
                allowFullScreen
                style={{ border: 0, pointerEvents: "none" }}
              />
              {/* Gradient overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#08080f] via-[#08080f]/60 to-[#08080f]/30" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#08080f]/80 to-transparent" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-[#08080f] to-indigo-900/10" />
          )}

          {/* Hero content */}
          <div className="relative z-10 h-full flex items-end">
            <div className="max-w-7xl mx-auto px-5 pb-12 w-full">
              <div className="max-w-xl slide-up">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[0.95] tracking-tight mb-4">
                  <span className="text-white">the fam&apos;s</span><br/>
                  <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">game spot.</span>
                </h1>
                <p className="text-sm sm:text-base text-white/35 leading-relaxed mb-6 max-w-sm">
                  football games, clips from the nwords, and a place for game night. hop in.
                </p>
                <div className="flex gap-2.5">
                  <button onClick={()=>gamesRef.current?.scrollIntoView({behavior:"smooth"})}
                    className="h-10 px-5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-white/90 transition">
                    pick a game
                  </button>
                  <button onClick={()=>{setMode("join");setError("");}}
                    className="h-10 px-5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-xs text-white/50 hover:bg-white/[0.12] hover:text-white/80 transition">
                    got a code?
                  </button>
                </div>
              </div>

              {/* Hero clip label */}
              {heroClip && (
                <div className="absolute bottom-4 right-5 hidden lg:block">
                  <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-right">
                    <div className="text-[11px] font-medium text-white/60">{heroClip.title}</div>
                    <div className="text-[10px] text-white/25">by {heroClip.author}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ====== GAMES ====== */}
      <section ref={gamesRef} className="px-5 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-white/85 mb-1">games</h2>
              <p className="text-xs text-white/25">pick one, share the code, everyone joins</p>
            </div>
            <button onClick={()=>{setMode("join");setError("");}} className="text-[11px] text-white/25 hover:text-white/50 transition hidden sm:block">or join with a code →</button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {games.map(g => (
              <button key={g.id} onClick={()=>{setMode("create");setSelectedGame(g.id);setError("");}}
                className="group text-left rounded-2xl bg-white/[0.02] border border-white/[0.05] p-5 transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.1] hover:scale-[1.02]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xl">{g.icon}</span>
                  <span className="text-[9px] uppercase tracking-[0.15em] text-white/15">{g.tag}</span>
                </div>
                <h3 className="font-semibold text-sm text-white/80 mb-1.5">{g.title}</h3>
                <p className="text-[11px] text-white/25 leading-relaxed mb-4">{g.desc}</p>
                <div className="text-[11px] text-purple-400/60 group-hover:text-purple-400 transition">host →</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ====== CLIPS ====== */}
      <section className="px-5 py-16 border-t border-white/[0.03]">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-white/85 mb-1">clips</h2>
              <p className="text-xs text-white/25">highlights from the nwords</p>
            </div>
            <button onClick={()=>setMode("upload")} className="h-8 px-4 rounded-lg bg-white/[0.04] border border-white/[0.05] text-[11px] text-white/35 hover:text-white/60 hover:bg-white/[0.08] transition">
              + share clip
            </button>
          </div>

          {clipList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.06] py-16 text-center">
              <div className="text-3xl opacity-10 mb-3">🎬</div>
              <p className="text-xs text-white/15 mb-3">nothing here yet</p>
              <button onClick={()=>setMode("upload")} className="text-[11px] text-purple-400/50 hover:text-purple-400 transition">share the first clip</button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clipList.map(clip => (
                <div key={clip.id} className="rounded-xl bg-white/[0.02] border border-white/[0.04] overflow-hidden hover:border-white/[0.08] transition group">
                  <div className="relative bg-black" style={{ paddingTop: "56.25%" }}>
                    <iframe
                      src={getMedalEmbedUrl(clip.url, { autoplay: false, muted: true, loop: false })}
                      className="absolute inset-0 w-full h-full"
                      allow="autoplay"
                      allowFullScreen
                    />
                  </div>
                  <div className="p-3.5">
                    <div className="font-medium text-xs text-white/60 leading-snug mb-1">{clip.title}</div>
                    <div className="text-[10px] text-white/20">by {clip.author}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.02] py-6 px-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-[6px] font-black text-white leading-none">FR</div>
            <span className="text-[11px] text-white/12">Family Reunion</span>
          </div>
          <span className="text-[10px] text-white/8">© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
