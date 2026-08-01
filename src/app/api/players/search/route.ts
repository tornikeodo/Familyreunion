import { NextRequest, NextResponse } from "next/server";
import { players } from "@/data/players-db";

// Game positions - LCB and RCB are SEPARATE positions but both search CB players
const GAME_POSITIONS = ["ST", "LW", "RW", "CAM", "CM", "CDM", "LCB", "RCB", "LB", "RB", "GK"] as const;
type GamePosition = typeof GAME_POSITIONS[number];

// Map game positions to database positions for searching
// LCB and RCB both search for CB players, but they are separate auction positions
const positionMapping: Record<GamePosition, string[]> = {
  ST: ["ST", "CF"],
  LW: ["LW", "LM"],
  RW: ["RW", "RM"],
  CAM: ["CAM", "CF", "AM"],
  CM: ["CM", "CAM", "CDM"],
  CDM: ["CDM", "CM", "DM"],
  LCB: ["CB"], // Left Center Back - searches CB players
  RCB: ["CB"], // Right Center Back - searches CB players
  LB: ["LB", "LWB"],
  RB: ["RB", "RWB"],
  GK: ["GK"],
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") || "";
  const position = url.searchParams.get("position") as GamePosition | null;

  let results = players;

  // Filter by position if specified
  if (position && GAME_POSITIONS.includes(position)) {
    const validPositions = positionMapping[position];
    results = results.filter(p => validPositions.includes(p.position));
  }

  // Filter by search query
  if (query.length > 0) {
    const q = query.toLowerCase();
    results = results.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.team.toLowerCase().includes(q) ||
      p.nationality.toLowerCase().includes(q)
    );
  }

  // Sort by rating (highest first) and limit to 50 results
  results = results
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 50);

  return NextResponse.json({ players: results });
}
