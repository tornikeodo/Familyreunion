"use client";

import { useState } from "react";
import { getRatingColor } from "@/lib/format";

type SecretPlayer = { name: string; rating: number; team: string; nationality: string; position: string; age: string; league: string; card: string } | null;
interface GameState {
  id: string; code: string; status: string; roundActive: boolean; roundWinner: string | null;
  secretPlayers?: Record<string, SecretPlayer>;
  questionLog?: { playerId: string; playerName: string; question: string; answer: "yes" | "no" | "maybe"; timestamp: number }[];
}
interface Player { id: string; name: string; score: number; isHost: boolean; }
interface Props { game: GameState; players: Player[]; playerId: string; isHost: boolean; onRefresh: () => void; }

export default function WhoAmI({ game, players, playerId, isHost, onRefresh }: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<"yes" | "no" | "maybe">("yes");
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = game.roundWinner ? players.find(p => p.id === game.roundWinner) : null;
  const secrets = game.secretPlayers || {};
  const mySecretVisible = secrets[playerId];

  async function doAction(action: string, extra?: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch(`/api/minigames/${game.id}/action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, playerId, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (action === "who_guess") {
        if (data.correct) { setFeedback(`correct! you were ${data.secret}. +${data.points} pts`); setGuess(""); }
        else setFeedback("wrong guess");
        setTimeout(() => setFeedback(null), 3000);
      }
      if (action === "who_question") { setQuestion(""); }
      onRefresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "failed");
      setTimeout(() => setFeedback(null), 3000);
    } finally { setLoading(false); }
  }

  if (game.status === "lobby") return (
    <div className="max-w-lg mx-auto fade-in">
      <div className="glass p-8 text-center">
        <div className="text-5xl mb-4">❓</div>
        <h2 className="text-3xl font-bold mb-2">Who Am I?</h2>
        <p className="text-white/40 mb-6">everyone gets a secret footballer. ask yes/no questions and guess your own player.</p>
        <div className="glass-strong p-6 mb-6"><p className="text-sm text-white/40 mb-2">room code</p><p className="text-4xl font-black tracking-[0.3em] text-purple-400">{game.code}</p></div>
        <div className="space-y-2 mb-6">{players.map(p => <div key={p.id} className="glass-button px-4 py-3 flex justify-between cursor-default"><span>{p.name}</span>{p.isHost && <span className="badge badge-gold">HOST</span>}</div>)}</div>
        {isHost && players.filter(p => !p.isHost).length >= 2 && <button onClick={() => doAction("start")} disabled={loading} className="btn-primary w-full py-4 text-lg">assign secret players</button>}
        {isHost && players.filter(p => !p.isHost).length < 2 && <p className="text-white/30 text-sm">need at least 2 players</p>}
        {!isHost && <p className="text-white/30 text-sm">waiting for host...</p>}
      </div>
    </div>
  );

  if (game.status === "finished") return (
    <div className="max-w-4xl mx-auto fade-in">
      <div className="glass p-8 text-center mb-6"><div className="text-6xl mb-4">🏆</div><h2 className="text-3xl font-black text-yellow-400 mb-2">{winner?.name || sorted[0]?.name} wins!</h2><p className="text-white/40">{winner ? "guessed their secret player" : `${sorted[0]?.score} points`}</p></div>
      <div className="glass p-6 mb-6"><h3 className="text-sm font-bold text-white/60 mb-3">final secrets</h3><div className="grid md:grid-cols-2 gap-3">{players.filter(p => !p.isHost).map(p => { const s = secrets[p.id]; return <div key={p.id} className="glass-button p-3 cursor-default flex items-center gap-3">{s?.card && <img src={s.card} alt="" className="w-14 rounded" />}<div><div className="text-sm font-bold">{p.name}</div><div className="text-xs text-white/40">was {s?.name || "unknown"}</div></div></div>; })}</div></div>
      <div className="text-center"><a href="/" className="btn-primary px-8 py-3 inline-block">back to home</a></div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto fade-in">
      <div className="glass p-4 mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-xl">❓</div><div><h2 className="text-lg font-bold">who am i?</h2><p className="text-xs text-white/40">ask yes/no/maybe questions, then guess</p></div></div>{isHost && <button onClick={() => doAction("finish")} className="glass-button px-3 py-2 text-xs">🏁 reveal all</button>}</div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="glass p-5"><h3 className="text-sm font-bold text-white/60 mb-3">secret assignments</h3><div className="grid sm:grid-cols-2 gap-3">{players.filter(p => !p.isHost).map(p => { const secret = secrets[p.id]; const mine = p.id === playerId; return <div key={p.id} className={`rounded-xl border p-3 ${mine ? "border-purple-500/30 bg-purple-500/10" : "border-white/10 bg-white/5"}`}><div className="text-sm font-bold mb-2">{p.name}{mine && " (you)"}</div>{mine ? <div className="h-32 rounded-lg bg-black/30 flex items-center justify-center text-white/20 text-sm">your player is hidden</div> : secret ? <div className="flex items-center gap-3">{secret.card && <img src={secret.card} className="w-16 rounded" alt="" />}<div><div className="font-bold text-sm">{secret.name}</div><div className={`text-xl font-black ${getRatingColor(secret.rating)}`}>{secret.rating}</div><div className="text-xs text-white/40">{secret.team}</div></div></div> : <div className="text-white/20 text-sm">hidden</div>}</div>; })}</div></div>
          {!isHost && !game.roundWinner && (
            <div className="glass p-5 space-y-4">
              <div><h3 className="text-sm font-bold text-white/60 mb-2">ask a question</h3><input value={question} onChange={e => setQuestion(e.target.value)} className="glass-input mb-2" placeholder="e.g. Am I in the Premier League?" /><div className="flex gap-2">{(["yes", "no", "maybe"] as const).map(a => <button key={a} onClick={() => setAnswer(a)} className={`glass-button px-4 py-2 text-sm flex-1 ${answer === a ? "bg-purple-600/30 border-purple-500/40" : ""}`}>{a}</button>)}<button disabled={!question.trim() || loading} onClick={() => doAction("who_question", { question, answer })} className="btn-primary px-5 py-2 text-sm disabled:opacity-40">log</button></div></div>
              <div><h3 className="text-sm font-bold text-white/60 mb-2">make your guess</h3><div className="flex gap-2"><input value={guess} onChange={e => setGuess(e.target.value)} onKeyDown={e => e.key === "Enter" && guess.trim() && doAction("who_guess", { guess })} className="glass-input" placeholder="who are you?" /><button disabled={!guess.trim() || loading} onClick={() => doAction("who_guess", { guess })} className="btn-gold px-5 py-2 disabled:opacity-40">guess</button></div>{feedback && <p className={`text-sm mt-2 ${feedback.includes("correct") ? "text-green-400" : "text-red-400"}`}>{feedback}</p>}</div>
            </div>
          )}
        </div>
        <div className="space-y-4"><div className="glass p-4"><h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">question log</h3><div className="max-h-[420px] overflow-y-auto space-y-2">{(game.questionLog || []).slice().reverse().map((q, i) => <div key={i} className="bg-white/5 border border-white/5 rounded-lg p-2 text-xs"><div className="text-purple-300 font-semibold">{q.playerName}</div><div className="text-white/50">{q.question}</div><div className={`font-bold mt-1 ${q.answer === "yes" ? "text-green-400" : q.answer === "no" ? "text-red-400" : "text-yellow-400"}`}>{q.answer.toUpperCase()}</div></div>)}{(!game.questionLog || game.questionLog.length === 0) && <div className="text-white/20 text-xs text-center py-6">no questions yet</div>}</div></div><div className="glass p-4"><h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">scores</h3>{sorted.map((p, i) => <div key={p.id} className="flex justify-between py-2 border-b border-white/5 last:border-0"><span>{i+1}. {p.name}</span><span className="text-purple-400 font-bold">{p.score}</span></div>)}</div></div>
      </div>
    </div>
  );
}
