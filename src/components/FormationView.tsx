"use client";

import { PlayerData } from "@/lib/types";
import { getRatingColor } from "@/lib/format";
import { formatMoney } from "@/lib/format";

interface Props {
  lineup: Record<string, PlayerData & { pricePaid: number }>;
  playerName: string;
}

// Formation 4-3-3 with positions matching the game
const positionCoords: Record<string, { top: string; left: string }> = {
  GK: { top: "88%", left: "50%" },
  LB: { top: "72%", left: "12%" },
  LCB: { top: "72%", left: "35%" },
  RCB: { top: "72%", left: "65%" },
  RB: { top: "72%", left: "88%" },
  CDM: { top: "55%", left: "50%" },
  CM: { top: "42%", left: "28%" },
  CAM: { top: "42%", left: "72%" },
  LW: { top: "18%", left: "12%" },
  ST: { top: "10%", left: "50%" },
  RW: { top: "18%", left: "88%" },
};

export default function FormationView({ lineup, playerName }: Props) {
  return (
    <div className="fade-in">
      <h4 className="text-sm font-bold text-white/60 mb-3">{playerName}&apos;s formation</h4>
      <div className="formation-field relative w-full" style={{ paddingTop: "140%" }}>
        {Object.entries(positionCoords).map(([pos, coords]) => {
          const player = lineup[pos];
          return (
            <div
              key={pos}
              className="absolute transform -translate-x-1/2 -translate-y-1/2"
              style={{ top: coords.top, left: coords.left }}
            >
              {player ? (
                <div className="text-center group">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-purple-500/40 to-blue-500/40 border-2 border-purple-400/50 flex items-center justify-center mx-auto mb-1 group-hover:scale-110 transition-transform">
                    <span className={`text-lg md:text-xl font-black ${getRatingColor(player.rating)}`}>
                      {player.rating}
                    </span>
                  </div>
                  <div className="text-[10px] md:text-xs font-bold bg-black/50 rounded-md px-1.5 py-0.5 backdrop-blur-sm max-w-[80px] truncate">
                    {player.name.split(" ").pop()}
                  </div>
                  <div className="text-[9px] text-white/40">
                    ${formatMoney(player.pricePaid)}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/5 border-2 border-white/10 border-dashed flex items-center justify-center mx-auto mb-1">
                    <span className="text-xs text-white/20">?</span>
                  </div>
                  <div className="text-[10px] text-white/30 font-bold">{pos}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
