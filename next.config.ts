import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The /api/profile route reads the sample GPX and the font at runtime from
  // public/. These live outside the function bundle by default (public/ is
  // served statically), so trace them into the serverless function.
  outputFileTracingIncludes: {
    "/api/profile": ["./public/sample-diagonale-des-fous.gpx", "./public/fonts/SairaCondensed-SemiBold.ttf"],
  },
};

export default nextConfig;
