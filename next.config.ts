import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@hebcal/core"],
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
