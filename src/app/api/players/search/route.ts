import { NextRequest, NextResponse } from "next/server";

// Game positions and what FC26 database positions they map to
const GAME_POSITIONS = ["ST", "LW", "RW", "CAM", "CM", "CDM", "LCB", "RCB", "LB", "RB", "GK"] as const;
type GamePosition = typeof GAME_POSITIONS[number];

// Map game positions to FC26 database positions
const positionMapping: Record<GamePosition, string[]> = {
  ST: ["ST", "CF"],
  LW: ["LW", "LM"],
  RW: ["RW", "RM"],
  CAM: ["CAM", "CF"],
  CM: ["CM"],
  CDM: ["CDM"],
  LCB: ["CB"],
  RCB: ["CB"],
  LB: ["LB", "LWB"],
  RB: ["RB", "RWB"],
  GK: ["GK"],
};

// Cache responses for 10 minutes to avoid hammering external API
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function fetchFromAPI(position: string, query: string): Promise<unknown[]> {
  const cacheKey = `${position}:${query}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as unknown[];
  }

  try {
    const params = new URLSearchParams();
    params.set("game", "fc26");
    params.set("gender", "m");
    if (position) params.set("position", position.toLowerCase());
    if (query) params.set("name", query.toLowerCase());

    const res = await fetch(`https://api.msmc.cc/api/eafc/players?${params}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const result = Array.isArray(data) ? data : [];
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch {
    return [];
  }
}

interface APIPlayer {
  id?: string;
  name?: string;
  ovr?: string;
  team?: string;
  nation?: string;
  position?: string;
  card?: string;
  "alternative positions"?: string[];
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") || "";
  const gamePosition = url.searchParams.get("position") as GamePosition | null;

  if (!gamePosition || !GAME_POSITIONS.includes(gamePosition)) {
    return NextResponse.json({ players: [] });
  }

  // Get matching FC26 positions
  const fc26Positions = positionMapping[gamePosition];
  
  // Fetch from all matching positions
  const allResults: APIPlayer[] = [];
  
  for (const pos of fc26Positions) {
    const results = await fetchFromAPI(pos, query);
    allResults.push(...(results as APIPlayer[]));
  }

  // If searching by name, also search without position filter to find players with alt positions
  if (query.length >= 2) {
    const extraResults = await fetchFromAPI("", query);
    for (const p of (extraResults as APIPlayer[])) {
      const altPositions = p["alternative positions"] || [];
      const playerPos = p.position || "";
      const allPlayerPositions = [playerPos, ...altPositions];
      
      if (allPlayerPositions.some(pp => fc26Positions.includes(pp))) {
        if (!allResults.some(existing => existing.id === p.id)) {
          allResults.push(p);
        }
      }
    }
  }

  // Remove duplicates by ID
  const seen = new Set<string>();
  const unique = allResults.filter(p => {
    const id = p.id || p.name || "";
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // Map to our format and sort by rating
  const players = unique
    .map(p => ({
      name: p.name || "Unknown",
      rating: parseInt(p.ovr || "50"),
      team: p.team || "Unknown",
      position: p.position || "",
      nationality: p.nation || "",
      card: p.card || "",
      id: p.id || "",
    }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 200);

  return NextResponse.json({ players });
}
