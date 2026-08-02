// Position definitions for the auction game
// LCB and RCB are SEPARATE positions but both use CB players from the database
export const POSITIONS = ["ST", "LW", "RW", "CAM", "CM", "CDM", "LCB", "RCB", "LB", "RB", "GK"] as const;
export type Position = typeof POSITIONS[number];

export interface FifaPlayer {
  name: string;
  rating: number;
  team: string;
  position: string;
  nationality: string;
}

// Position mapping for searches - maps game positions to database positions
// LCB and RCB both search CB players, but they are auctioned separately
export const positionMapping: Record<Position, string[]> = {
  ST: ["ST", "CF"],
  LW: ["LW", "LM"],
  RW: ["RW", "RM"],
  CAM: ["CAM", "CF", "AM"],
  CM: ["CM", "CAM", "CDM"],
  CDM: ["CDM", "CM", "DM"],
  LCB: ["CB"], // Left Center Back position
  RCB: ["CB"], // Right Center Back position
  LB: ["LB", "LWB"],
  RB: ["RB", "RWB"],
  GK: ["GK"],
};
