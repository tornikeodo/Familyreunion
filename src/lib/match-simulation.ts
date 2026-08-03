// Realistic Football Match Simulation Engine

import { GamePlayer, PlayerData } from "./types";

export interface MatchEvent {
  minute: number;
  type: "goal" | "assist" | "yellow_card" | "red_card" | "save" | "miss" | "woodwork" | "commentary";
  team: "home" | "away";
  playerName: string;
  assistPlayerName?: string;
  description: string;
  commentary?: string; // Optional broadcaster-style commentary
}

// Commentary templates
const goalCommentary = [
  "AND IT'S IN! What a moment!",
  "GOOOAAAL! The crowd goes wild!",
  "He couldn't miss from there!",
  "A clinical finish. Ice cold.",
  "Scenes! Absolute scenes!",
  "The net ripples! Beautiful goal!",
  "What a strike! Top corner!",
  "He's been waiting all game for that!",
  "The keeper had no chance!",
  "Pure quality. That's why he costs what he costs.",
];

const saveCommentary = [
  "Outstanding save! Kept his team alive!",
  "The keeper denies him! Incredible reflexes!",
  "What a stop! That was heading in!",
  "The goalkeeper comes up huge!",
  "Fingertip save! Unbelievable!",
];

const missCommentary = [
  "Off the post! So close!",
  "He'll be gutted with that one.",
  "Agonizingly wide! He had the goal at his mercy.",
  "Rattles the crossbar! Almost!",
];

export interface MatchResult {
  homePlayer: GamePlayer;
  awayPlayer: GamePlayer;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  homeXG: number;
  awayXG: number;
  homePossession: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
}

export interface TournamentStanding {
  player: GamePlayer;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

// Calculate team overall rating with positional weighting
function calculateTeamStrength(lineup: Record<string, PlayerData & { pricePaid: number }>): {
  attack: number;
  midfield: number;
  defense: number;
  goalkeeper: number;
  overall: number;
} {
  const positions = {
    attack: ["ST", "LW", "RW"],
    midfield: ["CAM", "CM", "CDM"],
    defense: ["LCB", "RCB", "LB", "RB"],
    goalkeeper: ["GK"],
  };

  const getAverage = (posArray: string[]) => {
    const players = posArray.map(pos => lineup[pos]).filter(Boolean);
    if (players.length === 0) return 50; // Default for missing players
    return players.reduce((sum, p) => sum + p.rating, 0) / players.length;
  };

  const attack = getAverage(positions.attack);
  const midfield = getAverage(positions.midfield);
  const defense = getAverage(positions.defense);
  const goalkeeper = getAverage(positions.goalkeeper);

  // Overall weighted: attack and midfield slightly more important for scoring
  const overall = (attack * 0.3 + midfield * 0.3 + defense * 0.25 + goalkeeper * 0.15);

  return { attack, midfield, defense, goalkeeper, overall };
}

// Get attacking players for goal/assist attribution
function getAttackingPlayers(lineup: Record<string, PlayerData & { pricePaid: number }>): string[] {
  const attackingPositions = ["ST", "LW", "RW", "CAM", "CM"];
  return attackingPositions
    .map(pos => lineup[pos]?.name)
    .filter((name): name is string => !!name);
}

function getMidfieldPlayers(lineup: Record<string, PlayerData & { pricePaid: number }>): string[] {
  const positions = ["CAM", "CM", "CDM", "LW", "RW"];
  return positions
    .map(pos => lineup[pos]?.name)
    .filter((name): name is string => !!name);
}

function getDefensivePlayers(lineup: Record<string, PlayerData & { pricePaid: number }>): string[] {
  const positions = ["LCB", "RCB", "LB", "RB", "CDM"];
  return positions
    .map(pos => lineup[pos]?.name)
    .filter((name): name is string => !!name);
}

function getGoalkeeper(lineup: Record<string, PlayerData & { pricePaid: number }>): string {
  return lineup["GK"]?.name || "Goalkeeper";
}

// Random pick from array
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Weighted random based on probability
function weightedRandom(probability: number): boolean {
  return Math.random() < probability;
}

// Generate match events
function generateMatchEvents(
  homeLineup: Record<string, PlayerData & { pricePaid: number }>,
  awayLineup: Record<string, PlayerData & { pricePaid: number }>,
  homeStrength: ReturnType<typeof calculateTeamStrength>,
  awayStrength: ReturnType<typeof calculateTeamStrength>
): { events: MatchEvent[]; homeScore: number; awayScore: number; homeXG: number; awayXG: number } {
  const events: MatchEvent[] = [];
  let homeScore = 0;
  let awayScore = 0;
  let homeXG = 0;
  let awayXG = 0;

  const homeAttackers = getAttackingPlayers(homeLineup);
  const awayAttackers = getAttackingPlayers(awayLineup);
  const homeMidfielders = getMidfieldPlayers(homeLineup);
  const awayMidfielders = getMidfieldPlayers(awayLineup);
  const homeDefenders = getDefensivePlayers(homeLineup);
  const awayDefenders = getDefensivePlayers(awayLineup);
  const homeGK = getGoalkeeper(homeLineup);
  const awayGK = getGoalkeeper(awayLineup);

  // Calculate chance creation rates based on team strength
  const homeChanceRate = (homeStrength.attack + homeStrength.midfield) / 160; // 0.5 to 1.1
  const awayChanceRate = (awayStrength.attack + awayStrength.midfield) / 160;

  // Simulate match in 5-minute intervals
  for (let minute = 1; minute <= 90; minute += 5) {
    const actualMinute = minute + Math.floor(Math.random() * 5);
    
    // Home team chance
    if (weightedRandom(homeChanceRate * 0.15)) {
      const xg = 0.1 + Math.random() * 0.3; // 0.1 to 0.4 xG per chance
      homeXG += xg;
      
      const conversionBonus = (homeStrength.attack - awayStrength.defense) / 100;
      const saveChance = (awayStrength.goalkeeper - 70) / 100;
      
      if (weightedRandom(xg + conversionBonus - saveChance * 0.3)) {
        // GOAL!
        homeScore++;
        const scorer = pickRandom(homeAttackers);
        const assister = pickRandom(homeMidfielders.filter(p => p !== scorer));
        
        const descriptions = [
          `${scorer} finds the net with a clinical finish!`,
          `What a strike from ${scorer}! Unstoppable!`,
          `${scorer} slots it home coolly.`,
          `${scorer} heads it in from close range!`,
          `A brilliant team move finished by ${scorer}!`,
        ];
        
        events.push({
          minute: actualMinute,
          type: "goal",
          team: "home",
          playerName: scorer,
          assistPlayerName: assister,
          description: pickRandom(descriptions),
          commentary: pickRandom(goalCommentary),
        });
        
        if (assister && weightedRandom(0.7)) {
          events.push({
            minute: actualMinute,
            type: "assist",
            team: "home",
            playerName: assister,
            description: `Lovely assist from ${assister}.`,
          });
        }
      } else if (weightedRandom(0.4)) {
        // Save
        events.push({
          minute: actualMinute,
          type: "save",
          team: "away",
          playerName: awayGK,
          description: `Great save by ${awayGK}!`,
          commentary: pickRandom(saveCommentary),
        });
      } else if (weightedRandom(0.2)) {
        // Woodwork
        events.push({
          minute: actualMinute,
          type: "woodwork",
          team: "home",
          playerName: pickRandom(homeAttackers),
          description: `So close! It hits the post!`,
          commentary: pickRandom(missCommentary),
        });
      }
    }

    // Periodic commentary (every ~15 mins)
    if (minute % 15 === 1 && weightedRandom(0.5)) {
      const commentaries = [
        `Possession has been fairly even so far.`,
        `Both teams looking to get on the front foot here.`,
        `The midfield battle is intense right now.`,
        `Some good build-up play from both sides.`,
        `The tempo has really picked up.`,
        `Both managers will be pleased with the effort.`,
        minute > 70 ? `We're into the final stretch now.` : `Still plenty of time left.`,
        minute > 80 ? `Nerves are showing as the clock winds down.` : `Good spell of pressure here.`,
      ];
      events.push({
        minute: actualMinute,
        type: "commentary",
        team: "home",
        playerName: "",
        description: pickRandom(commentaries),
      });
    }

    // Away team chance
    if (weightedRandom(awayChanceRate * 0.15)) {
      const xg = 0.1 + Math.random() * 0.3;
      awayXG += xg;
      
      const conversionBonus = (awayStrength.attack - homeStrength.defense) / 100;
      const saveChance = (homeStrength.goalkeeper - 70) / 100;
      
      if (weightedRandom(xg + conversionBonus - saveChance * 0.3)) {
        // GOAL!
        awayScore++;
        const scorer = pickRandom(awayAttackers);
        const assister = pickRandom(awayMidfielders.filter(p => p !== scorer));
        
        const descriptions = [
          `${scorer} makes no mistake!`,
          `Brilliant finish from ${scorer}!`,
          `${scorer} taps it in!`,
          `A thunderbolt from ${scorer}!`,
          `${scorer} rounds the keeper and scores!`,
        ];
        
        events.push({
          minute: actualMinute,
          type: "goal",
          team: "away",
          playerName: scorer,
          assistPlayerName: assister,
          description: pickRandom(descriptions),
          commentary: pickRandom(goalCommentary),
        });
        
        if (assister && weightedRandom(0.7)) {
          events.push({
            minute: actualMinute,
            type: "assist",
            team: "away",
            playerName: assister,
            description: `Assisted by ${assister}.`,
          });
        }
      } else if (weightedRandom(0.4)) {
        events.push({
          minute: actualMinute,
          type: "save",
          team: "home",
          playerName: homeGK,
          description: `${homeGK} keeps it out!`,
        });
      }
    }

    // Yellow cards (random fouls)
    if (weightedRandom(0.02)) {
      const team = weightedRandom(0.5) ? "home" : "away";
      const players = team === "home" ? [...homeMidfielders, ...homeDefenders] : [...awayMidfielders, ...awayDefenders];
      const player = pickRandom(players);
      events.push({
        minute: actualMinute,
        type: "yellow_card",
        team,
        playerName: player,
        description: `Yellow card for ${player}. Cynical foul.`,
      });
    }
  }

  // Sort events by minute
  events.sort((a, b) => a.minute - b.minute);

  return { events, homeScore, awayScore, homeXG: Math.round(homeXG * 10) / 10, awayXG: Math.round(awayXG * 10) / 10 };
}

// Simulate a single match
export function simulateMatch(homePlayer: GamePlayer, awayPlayer: GamePlayer): MatchResult {
  const homeLineup = (homePlayer.lineup || {}) as Record<string, PlayerData & { pricePaid: number }>;
  const awayLineup = (awayPlayer.lineup || {}) as Record<string, PlayerData & { pricePaid: number }>;

  const homeStrength = calculateTeamStrength(homeLineup);
  const awayStrength = calculateTeamStrength(awayLineup);

  const { events, homeScore, awayScore, homeXG, awayXG } = generateMatchEvents(
    homeLineup,
    awayLineup,
    homeStrength,
    awayStrength
  );

  // Calculate possession based on midfield strength
  const totalMidfield = homeStrength.midfield + awayStrength.midfield;
  const homePossession = Math.round((homeStrength.midfield / totalMidfield) * 100);

  // Shots based on attack strength
  const homeShots = Math.round(8 + (homeStrength.attack - 70) / 5 + Math.random() * 6);
  const awayShots = Math.round(8 + (awayStrength.attack - 70) / 5 + Math.random() * 6);
  
  const homeShotsOnTarget = Math.round(homeShots * (0.3 + Math.random() * 0.3));
  const awayShotsOnTarget = Math.round(awayShots * (0.3 + Math.random() * 0.3));

  return {
    homePlayer,
    awayPlayer,
    homeScore,
    awayScore,
    events,
    homeXG,
    awayXG,
    homePossession,
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
  };
}

// Generate round-robin tournament fixtures
export function generateFixtures(players: GamePlayer[]): { home: GamePlayer; away: GamePlayer }[] {
  const fixtures: { home: GamePlayer; away: GamePlayer }[] = [];
  
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      // Randomly decide home/away
      if (Math.random() > 0.5) {
        fixtures.push({ home: players[i], away: players[j] });
      } else {
        fixtures.push({ home: players[j], away: players[i] });
      }
    }
  }

  // Shuffle fixtures
  for (let i = fixtures.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fixtures[i], fixtures[j]] = [fixtures[j], fixtures[i]];
  }

  return fixtures;
}

// Calculate standings from results
export function calculateStandings(players: GamePlayer[], results: MatchResult[]): TournamentStanding[] {
  const standings: Map<string, TournamentStanding> = new Map();

  // Initialize standings
  players.forEach(player => {
    standings.set(player.id, {
      player,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  });

  // Process results
  results.forEach(result => {
    const homeStanding = standings.get(result.homePlayer.id)!;
    const awayStanding = standings.get(result.awayPlayer.id)!;

    homeStanding.played++;
    awayStanding.played++;

    homeStanding.goalsFor += result.homeScore;
    homeStanding.goalsAgainst += result.awayScore;
    awayStanding.goalsFor += result.awayScore;
    awayStanding.goalsAgainst += result.homeScore;

    if (result.homeScore > result.awayScore) {
      homeStanding.won++;
      homeStanding.points += 3;
      awayStanding.lost++;
    } else if (result.homeScore < result.awayScore) {
      awayStanding.won++;
      awayStanding.points += 3;
      homeStanding.lost++;
    } else {
      homeStanding.drawn++;
      awayStanding.drawn++;
      homeStanding.points += 1;
      awayStanding.points += 1;
    }

    homeStanding.goalDifference = homeStanding.goalsFor - homeStanding.goalsAgainst;
    awayStanding.goalDifference = awayStanding.goalsFor - awayStanding.goalsAgainst;
  });

  // Sort by points, then GD, then GF
  return Array.from(standings.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });
}
