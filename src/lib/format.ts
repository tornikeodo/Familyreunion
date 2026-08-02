export function formatMoney(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(amount % 1_000_000_000 === 0 ? 0 : 1)}B`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(0)}K`;
  }
  return amount.toLocaleString();
}

export function formatMoneyFull(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

export function getRatingColor(rating: number): string {
  if (rating >= 90) return "text-yellow-400";
  if (rating >= 85) return "text-green-400";
  if (rating >= 80) return "text-blue-400";
  if (rating >= 75) return "text-purple-400";
  return "text-gray-400";
}

export function getCardTier(optionIndex: number): "gold" | "silver" | "bronze" {
  if (optionIndex === 0) return "gold";
  if (optionIndex === 1) return "silver";
  return "bronze";
}

export function getTierLabel(optionIndex: number): string {
  if (optionIndex === 0) return "⭐ Best";
  if (optionIndex === 1) return "🥈 Mid";
  return "🥉 Budget";
}
