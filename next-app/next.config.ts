import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lightgreen-crab-324738.hostingersite.com",
      },
    ],
  },
  allowedDevOrigins: [
    "https://*.replit.dev",
    "https://*.replit.app",
    "https://*.repl.co",
  ],
};

export default nextConfig;
