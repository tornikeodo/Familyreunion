// Convert any medal.tv URL into an embeddable iframe src
// Medal URLs can look like:
//   https://medal.tv/games/game/clips/abc123/def456
//   https://medal.tv/clip/abc123/def456
//   https://medal.tv/clips/abc123
//   https://medal.tv/games/game/clips/abc123
// The embed format is the same URL with query params for autoplay etc.

export function getMedalEmbedUrl(url: string, options?: { autoplay?: boolean; muted?: boolean; loop?: boolean }): string {
  const { autoplay = false, muted = true, loop = true } = options || {};

  let cleanUrl = url.trim();

  // If it's already an embed URL, just return it
  if (cleanUrl.includes("?")) {
    cleanUrl = cleanUrl.split("?")[0];
  }

  // Build query params
  const params = new URLSearchParams();
  params.set("autoplay", autoplay ? "1" : "0");
  params.set("muted", muted ? "1" : "0");
  params.set("loop", loop ? "1" : "0");

  return `${cleanUrl}?${params.toString()}`;
}

export function isValidMedalUrl(url: string): boolean {
  return url.includes("medal.tv");
}
