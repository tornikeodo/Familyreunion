"use client";

import { useState, useEffect } from "react";
import { POSITIONS } from "@/data/fifa-players";
import { getTierLabel } from "@/lib/format";

interface Props {
  onSpinComplete: (result: { position: string; optionIndex: number }) => void;
  spinning: boolean;
  result: { position: string; optionIndex: number } | null;
}

const WHEEL_ITEMS = POSITIONS.flatMap(pos =>
  [0, 1, 2].map(idx => ({ position: pos, optionIndex: idx }))
);

const COLORS = [
  "#7c3aed", "#3b82f6", "#06b6d4", "#10b981", "#84cc16",
  "#eab308", "#f97316", "#ef4444", "#ec4899", "#8b5cf6",
  "#6366f1", "#14b8a6", "#22c55e", "#a3e635", "#facc15",
  "#fb923c", "#f87171", "#f472b6", "#a78bfa", "#818cf8",
  "#2dd4bf", "#4ade80", "#bef264", "#fde047", "#fdba74",
  "#fca5a5", "#f9a8d4", "#c4b5fd", "#a5b4fc", "#99f6e4",
  "#86efac", "#d9f99d", "#fef08a",
];

export default function SpinWheel({ spinning, result }: Props) {
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (spinning) {
      setIsAnimating(true);
      let speed = 50;
      let count = 0;
      const maxCount = 40;

      const animate = () => {
        setDisplayIndex(prev => (prev + 1) % WHEEL_ITEMS.length);
        count++;
        speed = 50 + (count / maxCount) * 250; // Slow down

        if (count < maxCount) {
          setTimeout(animate, speed);
        } else {
          setIsAnimating(false);
        }
      };

      animate();
    }
  }, [spinning]);

  const currentItem = result && !isAnimating ? result : WHEEL_ITEMS[displayIndex];

  return (
    <div className="text-center">
      {/* Slot machine style display */}
      <div className="glass-strong p-8 inline-block mb-6 relative overflow-hidden">
        <div className="flex items-center gap-4">
          {/* Position */}
          <div className={`text-center px-6 py-4 rounded-xl transition-all duration-200 ${
            isAnimating ? "scale-105" : ""
          }`} style={{ 
            background: `${COLORS[POSITIONS.indexOf(currentItem.position as typeof POSITIONS[number]) % COLORS.length]}22`,
            borderColor: `${COLORS[POSITIONS.indexOf(currentItem.position as typeof POSITIONS[number]) % COLORS.length]}44`,
            borderWidth: "1px"
          }}>
            <div className="text-xs text-white/40 mb-1">POSITION</div>
            <div className={`text-3xl font-black transition-all ${isAnimating ? "animate-pulse" : ""}`}>
              {currentItem.position}
            </div>
          </div>

          <div className="text-3xl text-white/20">×</div>

          {/* Tier */}
          <div className={`text-center px-6 py-4 rounded-xl transition-all duration-200 ${
            isAnimating ? "scale-105" : ""
          }`} style={{
            background: currentItem.optionIndex === 0 ? "rgba(251,191,36,0.1)" :
                        currentItem.optionIndex === 1 ? "rgba(156,163,175,0.1)" :
                        "rgba(180,83,9,0.1)",
            borderColor: currentItem.optionIndex === 0 ? "rgba(251,191,36,0.3)" :
                         currentItem.optionIndex === 1 ? "rgba(156,163,175,0.3)" :
                         "rgba(180,83,9,0.3)",
            borderWidth: "1px"
          }}>
            <div className="text-xs text-white/40 mb-1">TIER</div>
            <div className={`text-2xl font-bold transition-all ${isAnimating ? "animate-pulse" : ""}`}>
              {getTierLabel(currentItem.optionIndex)}
            </div>
          </div>
        </div>

        {/* Shimmer effect while spinning */}
        {isAnimating && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse pointer-events-none" />
        )}
      </div>
    </div>
  );
}
