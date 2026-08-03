"use client";

import { useState, useEffect, useRef } from "react";
import { GamePlayer, PlayerData } from "@/lib/types";
import { playGoalSound } from "@/lib/sounds";
import { 
  simulateMatch, 
  generateFixtures, 
  calculateStandings,
  MatchResult,
  TournamentStanding,
  MatchEvent
} from "@/lib/match-simulation";
import { formatMoney, getRatingColor } from "@/lib/format";
import { POSITIONS } from "@/data/fifa-players";

interface Props {
  gamePlayers: GamePlayer[];
}

// Formation positions for visual display
const formationCoords: Record<string, { top: string; left: string }> = {
  GK: { top: "90%", left: "50%" },
  LB: { top: "75%", left: "15%" },
  LCB: { top: "75%", left: "38%" },
  RCB: { top: "75%", left: "62%" },
  RB: { top: "75%", left: "85%" },
  CDM: { top: "55%", left: "50%" },
  CM: { top: "45%", left: "30%" },
  CAM: { top: "45%", left: "70%" },
  LW: { top: "22%", left: "15%" },
  ST: { top: "12%", left: "50%" },
  RW: { top: "22%", left: "85%" },
};

// Flipped for away team (playing downward)
const formationCoordsAway: Record<string, { top: string; left: string }> = {
  GK: { top: "10%", left: "50%" },
  LB: { top: "25%", left: "85%" },
  LCB: { top: "25%", left: "62%" },
  RCB: { top: "25%", left: "38%" },
  RB: { top: "25%", left: "15%" },
  CDM: { top: "45%", left: "50%" },
  CM: { top: "55%", left: "70%" },
  CAM: { top: "55%", left: "30%" },
  LW: { top: "78%", left: "85%" },
  ST: { top: "88%", left: "50%" },
  RW: { top: "78%", left: "15%" },
};

function MatchView({ match, onClose }: { match: MatchResult; onClose: () => void }) {
  const [currentEventIndex, setCurrentEventIndex] = useState(-1);
  const [displayedEvents, setDisplayedEvents] = useState<MatchEvent[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [showFullTime, setShowFullTime] = useState(false);
  const [ballPos, setBallPos] = useState({ top: 50, left: 50 });
  const prevGoalCount = useRef(0);

  // Animate ball position randomly and on events
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setBallPos({ top: 20 + Math.random() * 60, left: 15 + Math.random() * 70 });
    }, 800);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Move ball towards goal on goal events, play sound
  useEffect(() => {
    const goalCount = displayedEvents.filter(e => e.type === "goal").length;
    if (goalCount > prevGoalCount.current) {
      const lastGoal = [...displayedEvents].reverse().find(e => e.type === "goal");
      if (lastGoal) {
        // Move ball to the goal area
        setBallPos(lastGoal.team === "home" ? { top: 5, left: 50 } : { top: 95, left: 50 });
        playGoalSound();
      }
    }
    prevGoalCount.current = goalCount;
  }, [displayedEvents]);

  const homeLineup = (match.homePlayer.lineup || {}) as Record<string, PlayerData & { pricePaid: number }>;
  const awayLineup = (match.awayPlayer.lineup || {}) as Record<string, PlayerData & { pricePaid: number }>;

  function startMatch() {
    setIsPlaying(true);
    setCurrentEventIndex(0);
    setDisplayedEvents([]);
    setCurrentMinute(0);
    setShowFullTime(false);
  }

  function skipToEnd() {
    setDisplayedEvents(match.events);
    setCurrentMinute(90);
    setShowFullTime(true);
    setIsPlaying(false);
  }

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentMinute(prev => {
        const next = prev + 1;
        if (next > 90) {
          setIsPlaying(false);
          setShowFullTime(true);
          return 90;
        }
        return next;
      });
    }, 100); // Speed: 100ms per minute = 9 seconds for full match

    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    // Add events as we reach their minute
    const newEvents = match.events.filter(e => e.minute <= currentMinute && !displayedEvents.includes(e));
    if (newEvents.length > 0) {
      setDisplayedEvents(prev => [...prev, ...newEvents]);
    }
  }, [currentMinute, match.events, displayedEvents]);

  const currentHomeScore = displayedEvents.filter(e => e.team === "home" && e.type === "goal").length;
  const currentAwayScore = displayedEvents.filter(e => e.team === "away" && e.type === "goal").length;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onClose} className="glass-button px-4 py-2 text-sm">
            ← back to tournament
          </button>
          <div className="flex gap-2">
            {!isPlaying && !showFullTime && (
              <button onClick={startMatch} className="btn-gold px-6 py-2">
                ▶ play match
              </button>
            )}
            {isPlaying && (
              <button onClick={skipToEnd} className="glass-button px-4 py-2">
                ⏭ skip to end
              </button>
            )}
          </div>
        </div>

        {/* Match Header with Score */}
        <div className="glass p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-2xl font-bold mb-1">{match.homePlayer.name}</div>
              <div className="text-xs text-white/40">HOME</div>
            </div>
            <div className="text-center px-8">
              <div className="text-5xl font-black mb-2">
                <span className={currentHomeScore > currentAwayScore ? "text-green-400" : ""}>{currentHomeScore}</span>
                <span className="text-white/30 mx-3">-</span>
                <span className={currentAwayScore > currentHomeScore ? "text-green-400" : ""}>{currentAwayScore}</span>
              </div>
              {isPlaying && (
                <div className="text-sm text-yellow-400 animate-pulse">{currentMinute}&apos;</div>
              )}
              {showFullTime && (
                <div className="text-sm text-white/40">FULL TIME</div>
              )}
              {!isPlaying && !showFullTime && (
                <div className="text-sm text-white/30">press play to start</div>
              )}
            </div>
            <div className="text-center flex-1">
              <div className="text-2xl font-bold mb-1">{match.awayPlayer.name}</div>
              <div className="text-xs text-white/40">AWAY</div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Pitch with both teams */}
          <div className="lg:col-span-2">
            <div className="relative w-full bg-gradient-to-b from-green-800 via-green-700 to-green-800 rounded-xl overflow-hidden" style={{ paddingTop: "130%" }}>
              {/* Field markings */}
              <div className="absolute inset-0">
                {/* Center circle */}
                <div className="absolute top-1/2 left-1/2 w-24 h-24 border-2 border-white/20 rounded-full -translate-x-1/2 -translate-y-1/2" />
                {/* Center line */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/20" />
                {/* Penalty areas */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-44 h-16 border-2 border-white/20 border-b-0" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-44 h-16 border-2 border-white/20 border-t-0" />
                {/* Goal areas */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-6 border-2 border-white/20 border-b-0" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-6 border-2 border-white/20 border-t-0" />
                
                {/* Animated ball */}
                {isPlaying && (
                  <div className="absolute w-3 h-3 bg-white rounded-full shadow-lg shadow-white/30 transition-all duration-700 ease-in-out z-20 -translate-x-1/2 -translate-y-1/2"
                    style={{ top: `${ballPos.top}%`, left: `${ballPos.left}%` }} />
                )}
              </div>

              {/* Home team (playing upward - at bottom) */}
              {POSITIONS.map(pos => {
                const player = homeLineup[pos];
                const coords = formationCoords[pos];
                if (!coords) return null;
                return (
                  <div
                    key={`home-${pos}`}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                    style={{ top: coords.top, left: coords.left }}
                  >
                    {player ? (
                      <div className="text-center group">
                        <div className="w-10 h-10 rounded-full bg-blue-600 border-2 border-blue-400 flex items-center justify-center mx-auto shadow-lg">
                          <span className={`text-xs font-black ${getRatingColor(player.rating)}`}>
                            {player.rating}
                          </span>
                        </div>
                        <div className="text-[9px] font-bold text-white bg-black/60 rounded px-1 mt-0.5 truncate max-w-[60px]">
                          {player.name.split(" ").pop()}
                        </div>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 border-dashed" />
                    )}
                  </div>
                );
              })}

              {/* Away team (playing downward - at top) */}
              {POSITIONS.map(pos => {
                const player = awayLineup[pos];
                const coords = formationCoordsAway[pos];
                if (!coords) return null;
                return (
                  <div
                    key={`away-${pos}`}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                    style={{ top: coords.top, left: coords.left }}
                  >
                    {player ? (
                      <div className="text-center group">
                        <div className="w-10 h-10 rounded-full bg-red-600 border-2 border-red-400 flex items-center justify-center mx-auto shadow-lg">
                          <span className={`text-xs font-black ${getRatingColor(player.rating)}`}>
                            {player.rating}
                          </span>
                        </div>
                        <div className="text-[9px] font-bold text-white bg-black/60 rounded px-1 mt-0.5 truncate max-w-[60px]">
                          {player.name.split(" ").pop()}
                        </div>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 border-dashed" />
                    )}
                  </div>
                );
              })}

              {/* Team labels */}
              <div className="absolute bottom-2 left-2 text-xs font-bold text-blue-400 bg-black/50 px-2 py-1 rounded">
                {match.homePlayer.name}
              </div>
              <div className="absolute top-2 right-2 text-xs font-bold text-red-400 bg-black/50 px-2 py-1 rounded">
                {match.awayPlayer.name}
              </div>
            </div>
          </div>

          {/* Events & Stats */}
          <div className="space-y-4">
            {/* Live Events */}
            <div className="glass p-4">
              <h3 className="text-sm font-bold text-white/60 mb-3">📋 MATCH EVENTS</h3>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {displayedEvents.length === 0 && (
                  <div className="text-center text-white/30 text-sm py-4">
                    {isPlaying ? "waiting for action..." : "start the match to see events"}
                  </div>
                )}
                {displayedEvents.map((event, idx) => (
                  <div
                    key={idx}
                    className={`text-xs p-2 rounded-lg fade-in ${
                      event.type === "goal"
                        ? event.team === "home"
                          ? "bg-blue-600/20 border border-blue-500/30"
                          : "bg-red-600/20 border border-red-500/30"
                        : event.type === "yellow_card"
                        ? "bg-yellow-600/20 border border-yellow-500/30"
                        : event.type === "commentary"
                        ? "bg-white/[0.02] border border-white/5"
                        : "bg-white/5 border border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white/60">{event.minute}&apos;</span>
                      <span>
                        {event.type === "goal" && "⚽"}
                        {event.type === "assist" && "👟"}
                        {event.type === "yellow_card" && "🟨"}
                        {event.type === "red_card" && "🟥"}
                        {event.type === "save" && "🧤"}
                        {event.type === "woodwork" && "🥅"}
                        {event.type === "commentary" && "🎙️"}
                      </span>
                      {event.playerName && (
                        <span className={event.team === "home" ? "text-blue-400" : "text-red-400"}>
                          {event.playerName}
                        </span>
                      )}
                    </div>
                    <div className="text-white/40 mt-1">{event.description}</div>
                    {event.commentary && (
                      <div className="text-white/25 mt-0.5 italic text-[10px]">🎙️ {event.commentary}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Match Stats (show after full time) */}
            {showFullTime && (
              <div className="glass p-4 fade-in">
                <h3 className="text-sm font-bold text-white/60 mb-3">📊 MATCH STATS</h3>
                <div className="space-y-3">
                  <StatBar label="Possession" home={match.homePossession} away={100 - match.homePossession} unit="%" />
                  <StatBar label="Shots" home={match.homeShots} away={match.awayShots} />
                  <StatBar label="On Target" home={match.homeShotsOnTarget} away={match.awayShotsOnTarget} />
                  <StatBar label="xG" home={match.homeXG} away={match.awayXG} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBar({ label, home, away, unit = "" }: { label: string; home: number; away: number; unit?: string }) {
  const total = home + away || 1;
  const homePercent = (home / total) * 100;
  
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-blue-400 font-bold">{home}{unit}</span>
        <span className="text-white/40">{label}</span>
        <span className="text-red-400 font-bold">{away}{unit}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
        <div className="bg-blue-500 transition-all duration-500" style={{ width: `${homePercent}%` }} />
        <div className="bg-red-500 flex-1" />
      </div>
    </div>
  );
}

export default function Tournament({ gamePlayers }: Props) {
  const [fixtures, setFixtures] = useState<{ home: GamePlayer; away: GamePlayer }[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [standings, setStandings] = useState<TournamentStanding[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
  const [tournamentStarted, setTournamentStarted] = useState(false);
  const [tournamentComplete, setTournamentComplete] = useState(false);

  // Filter out host and eliminated players
  const eligiblePlayers = gamePlayers.filter(p => !p.isHost && !p.isEliminated);

  useEffect(() => {
    if (eligiblePlayers.length >= 2) {
      const generatedFixtures = generateFixtures(eligiblePlayers);
      setFixtures(generatedFixtures);
    }
  }, [eligiblePlayers.length]);

  function startTournament() {
    setTournamentStarted(true);
    // Simulate all matches
    const allResults: MatchResult[] = fixtures.map(fixture => 
      simulateMatch(fixture.home, fixture.away)
    );
    setResults(allResults);
    setStandings(calculateStandings(eligiblePlayers, allResults));
    setTournamentComplete(true);
  }

  if (eligiblePlayers.length < 2) {
    return (
      <div className="glass p-8 text-center">
        <div className="text-5xl mb-4">😢</div>
        <h3 className="text-xl font-bold mb-2">not enough teams</h3>
        <p className="text-white/40">need at least 2 non-host players to run a tournament</p>
      </div>
    );
  }

  if (selectedMatch) {
    return <MatchView match={selectedMatch} onClose={() => setSelectedMatch(null)} />;
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="glass p-6 text-center">
        <div className="text-5xl mb-4">🏆</div>
        <h2 className="text-3xl font-black mb-2">Tournament Mode</h2>
        <p className="text-white/40">
          {tournamentComplete 
            ? "all matches played! check out the results below"
            : `${eligiblePlayers.length} teams will compete in a round-robin tournament`
          }
        </p>
        {!tournamentStarted && (
          <button onClick={startTournament} className="btn-gold px-8 py-4 text-lg mt-6">
            🎮 simulate tournament
          </button>
        )}
      </div>

      {tournamentComplete && (
        <>
          {/* League Table */}
          <div className="glass p-6">
            <h3 className="text-lg font-bold mb-4">📊 Final Standings</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs">
                    <th className="text-left py-2 px-2">#</th>
                    <th className="text-left py-2">Team</th>
                    <th className="text-center py-2 px-2">P</th>
                    <th className="text-center py-2 px-2">W</th>
                    <th className="text-center py-2 px-2">D</th>
                    <th className="text-center py-2 px-2">L</th>
                    <th className="text-center py-2 px-2">GF</th>
                    <th className="text-center py-2 px-2">GA</th>
                    <th className="text-center py-2 px-2">GD</th>
                    <th className="text-center py-2 px-2 font-bold">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((standing, idx) => (
                    <tr 
                      key={standing.player.id}
                      className={`border-t border-white/5 ${
                        idx === 0 ? "bg-yellow-500/10" : ""
                      }`}
                    >
                      <td className="py-3 px-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? "bg-yellow-500/30 text-yellow-400" :
                          idx === 1 ? "bg-gray-400/30 text-gray-300" :
                          idx === 2 ? "bg-orange-600/30 text-orange-400" :
                          "bg-white/5 text-white/40"
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 font-bold">
                        {standing.player.name}
                        {idx === 0 && <span className="ml-2">🏆</span>}
                      </td>
                      <td className="text-center py-3 px-2 text-white/60">{standing.played}</td>
                      <td className="text-center py-3 px-2 text-green-400">{standing.won}</td>
                      <td className="text-center py-3 px-2 text-white/40">{standing.drawn}</td>
                      <td className="text-center py-3 px-2 text-red-400">{standing.lost}</td>
                      <td className="text-center py-3 px-2 text-white/60">{standing.goalsFor}</td>
                      <td className="text-center py-3 px-2 text-white/60">{standing.goalsAgainst}</td>
                      <td className="text-center py-3 px-2">
                        <span className={standing.goalDifference > 0 ? "text-green-400" : standing.goalDifference < 0 ? "text-red-400" : "text-white/40"}>
                          {standing.goalDifference > 0 ? "+" : ""}{standing.goalDifference}
                        </span>
                      </td>
                      <td className="text-center py-3 px-2 font-black text-lg">{standing.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Match Results */}
          <div className="glass p-6">
            <h3 className="text-lg font-bold mb-4">⚽ All Matches</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {results.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedMatch(result)}
                  className="glass-button p-4 text-left hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className={`font-semibold text-sm ${result.homeScore > result.awayScore ? "text-green-400" : ""}`}>
                        {result.homePlayer.name}
                      </div>
                    </div>
                    <div className="px-4 text-center">
                      <div className="text-xl font-black">
                        {result.homeScore} - {result.awayScore}
                      </div>
                    </div>
                    <div className="flex-1 text-right">
                      <div className={`font-semibold text-sm ${result.awayScore > result.homeScore ? "text-green-400" : ""}`}>
                        {result.awayPlayer.name}
                      </div>
                    </div>
                  </div>
                  <div className="text-center text-xs text-white/30 mt-2">
                    click to watch replay →
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Champion Celebration */}
          {standings[0] && (
            <div className="glass p-8 text-center bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-2xl font-black text-yellow-400 mb-2">
                {standings[0].player.name} wins!
              </h2>
              <p className="text-white/60">
                {standings[0].points} points · {standings[0].won} wins · {standings[0].goalsFor} goals scored
              </p>
              <div className="mt-6 flex gap-3 justify-center flex-wrap">
                <button onClick={() => {
                  const text = `🏆 Family Reunion Tournament Results\n\n${
                    standings.map((s, i) => `${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}.`} ${s.player.name} - ${s.points}pts (W${s.won} D${s.drawn} L${s.lost}) GD: ${s.goalDifference > 0 ? "+" : ""}${s.goalDifference}`).join("\n")
                  }\n\nPlayed on familyreunion.app`;
                  navigator.clipboard.writeText(text).then(() => alert("Results copied to clipboard!")).catch(() => {});
                }} className="glass-button px-6 py-3 text-sm">
                  📋 copy results
                </button>
                <a href="/" className="btn-primary px-8 py-3 inline-block">
                  🏠 back to home
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
