"use client";

import { useState } from "react";
import { GamePlayer, PlayerData } from "@/lib/types";
import { POSITIONS } from "@/data/fifa-players";

type Style = "balanced" | "attacking" | "defensive" | "counter" | "possession";
type Formation = "433" | "4231" | "442" | "352";

type Tactic = { formation: Formation; style: Style; press: number };
type Match = { round: number; home: GamePlayer; away: GamePlayer; hs: number; as: number; note: string };
type Standing = { p: GamePlayer; played: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number };

interface Props { gamePlayers: GamePlayer[]; }

function avg(lineup: Record<string, PlayerData & { pricePaid: number }>, pos: string[]) {
  const picked = pos.map(p => lineup[p]).filter(Boolean);
  if (!picked.length) return 60;
  return picked.reduce((s, p) => s + p.rating, 0) / picked.length;
}

function strength(player: GamePlayer, tactic: Tactic) {
  const l = player.lineup || {};
  let atk = avg(l, ["ST", "LW", "RW", "CAM"]);
  let mid = avg(l, ["CAM", "CM", "CDM"]);
  let def = avg(l, ["LCB", "RCB", "LB", "RB", "CDM"]);
  let gk = avg(l, ["GK"]);

  if (tactic.style === "attacking") { atk += 4; def -= 2; }
  if (tactic.style === "defensive") { def += 4; atk -= 2; }
  if (tactic.style === "counter") { atk += 2; mid -= 1; def += 1; }
  if (tactic.style === "possession") { mid += 4; atk += 1; }
  if (tactic.formation === "4231") { mid += 2; def += 1; }
  if (tactic.formation === "442") { atk += 2; def += 1; }
  if (tactic.formation === "352") { mid += 2; atk += 1; def -= 1; }
  if (tactic.press > 70) { atk += 1; def -= 1; }
  if (tactic.press < 35) { def += 1; atk -= 1; }

  return { atk, mid, def, gk, overall: atk * 0.3 + mid * 0.3 + def * 0.25 + gk * 0.15 };
}

function goalsFor(a: ReturnType<typeof strength>, b: ReturnType<typeof strength>, style: Style) {
  const base = 0.9 + (a.atk - b.def) / 22 + (a.mid - b.mid) / 50;
  const chaos = Math.random() * 1.8;
  const styleBoost = style === "attacking" ? 0.35 : style === "defensive" ? -0.25 : style === "counter" ? 0.15 : 0;
  return Math.max(0, Math.round(base + chaos + styleBoost));
}

function buildStandings(players: GamePlayer[], matches: Match[]) {
  const table = new Map<string, Standing>();
  players.forEach(p => table.set(p.id, { p, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }));
  matches.forEach(m => {
    const h = table.get(m.home.id)!; const a = table.get(m.away.id)!;
    h.played++; a.played++; h.gf += m.hs; h.ga += m.as; a.gf += m.as; a.ga += m.hs;
    if (m.hs > m.as) { h.w++; h.pts += 3; a.l++; }
    else if (m.as > m.hs) { a.w++; a.pts += 3; h.l++; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
    h.gd = h.gf - h.ga; a.gd = a.gf - a.ga;
  });
  return [...table.values()].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}

export default function ManagerMode({ gamePlayers }: Props) {
  const teams = gamePlayers.filter(p => !p.isHost && !p.isEliminated);
  const [tactics, setTactics] = useState<Record<string, Tactic>>(() => Object.fromEntries(teams.map(t => [t.id, { formation: "433", style: "balanced", press: 50 }])));
  const [matches, setMatches] = useState<Match[]>([]);
  const [table, setTable] = useState<Standing[]>([]);
  const [done, setDone] = useState(false);

  function update(id: string, patch: Partial<Tactic>) {
    setTactics(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function simulateSeason() {
    const out: Match[] = [];
    for (let round = 1; round <= 10; round++) {
      const shuffled = [...teams].sort(() => Math.random() - 0.5);
      for (let i = 0; i < shuffled.length - 1; i += 2) {
        const home = shuffled[i]; const away = shuffled[i + 1];
        const ht = tactics[home.id]; const at = tactics[away.id];
        const hs = strength(home, ht); const as = strength(away, at);
        const hGoals = goalsFor(hs, as, ht.style);
        const aGoals = goalsFor(as, hs, at.style);
        const note = hs.overall > as.overall + 4 ? `${home.name}'s quality showed` : as.overall > hs.overall + 4 ? `${away.name} controlled the game` : "tight tactical battle";
        out.push({ round, home, away, hs: hGoals, as: aGoals, note });
      }
    }
    setMatches(out);
    setTable(buildStandings(teams, out));
    setDone(true);
  }

  if (teams.length < 2) return <div className="glass p-8 text-center text-white/40">Need at least 2 teams for Manager Mode.</div>;

  return (
    <div className="space-y-6 fade-in">
      <div className="glass p-8 text-center">
        <div className="text-5xl mb-3">🧠</div>
        <h2 className="text-3xl font-black mb-2">Manager Mode</h2>
        <p className="text-white/40">pick tactics, then simulate a 10-matchday season</p>
      </div>

      {!done && (
        <div className="grid md:grid-cols-2 gap-4">
          {teams.map(t => (
            <div key={t.id} className="glass p-5">
              <div className="flex items-center justify-between mb-4"><h3 className="font-bold">{t.name}</h3><span className="text-xs text-white/30">{Object.keys(t.lineup || {}).length}/11 players</span></div>
              <div className="space-y-3">
                <div><label className="text-xs text-white/40 block mb-1">formation</label><select className="glass-input" value={tactics[t.id]?.formation} onChange={e => update(t.id, { formation: e.target.value as Formation })}><option className="bg-gray-900" value="433">4-3-3</option><option className="bg-gray-900" value="4231">4-2-3-1</option><option className="bg-gray-900" value="442">4-4-2</option><option className="bg-gray-900" value="352">3-5-2</option></select></div>
                <div><label className="text-xs text-white/40 block mb-1">style</label><select className="glass-input" value={tactics[t.id]?.style} onChange={e => update(t.id, { style: e.target.value as Style })}><option className="bg-gray-900" value="balanced">Balanced</option><option className="bg-gray-900" value="attacking">Attacking</option><option className="bg-gray-900" value="defensive">Defensive</option><option className="bg-gray-900" value="counter">Counter Attack</option><option className="bg-gray-900" value="possession">Possession</option></select></div>
                <div><label className="text-xs text-white/40 block mb-1">pressing: {tactics[t.id]?.press}</label><input type="range" min="0" max="100" value={tactics[t.id]?.press} onChange={e => update(t.id, { press: Number(e.target.value) })} className="w-full" /></div>
              </div>
            </div>
          ))}
          <div className="md:col-span-2 text-center"><button onClick={simulateSeason} className="btn-gold px-12 py-4 text-lg font-black">simulate season ⚽</button></div>
        </div>
      )}

      {done && (
        <>
          <div className="glass p-6"><h3 className="text-lg font-bold mb-4">league table</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-white/40 text-xs"><th className="text-left py-2">#</th><th className="text-left">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>PTS</th></tr></thead><tbody>{table.map((s, i) => <tr key={s.p.id} className={`border-t border-white/5 ${i === 0 ? "bg-yellow-500/10" : ""}`}><td className="py-3">{i + 1}</td><td className="font-bold">{s.p.name}{i === 0 && " 🏆"}</td><td className="text-center">{s.played}</td><td className="text-center text-green-400">{s.w}</td><td className="text-center text-white/40">{s.d}</td><td className="text-center text-red-400">{s.l}</td><td className="text-center">{s.gf}</td><td className="text-center">{s.ga}</td><td className="text-center">{s.gd > 0 ? "+" : ""}{s.gd}</td><td className="text-center font-black">{s.pts}</td></tr>)}</tbody></table></div></div>
          <div className="glass p-6"><h3 className="text-lg font-bold mb-4">matchdays</h3><div className="grid md:grid-cols-2 gap-3">{matches.map((m, i) => <div key={i} className="bg-white/5 border border-white/5 rounded-xl p-3"><div className="text-xs text-white/30 mb-1">Matchday {m.round} · {m.note}</div><div className="flex justify-between items-center"><span className={m.hs > m.as ? "text-green-400 font-bold" : "font-bold"}>{m.home.name}</span><span className="text-xl font-black">{m.hs} - {m.as}</span><span className={m.as > m.hs ? "text-green-400 font-bold" : "font-bold"}>{m.away.name}</span></div></div>)}</div></div>
        </>
      )}
    </div>
  );
}
