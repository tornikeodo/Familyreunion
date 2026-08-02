import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ratings-images-prod.pulse.ea.com",
      },
    ],
  },
};

export default nextConfig;
