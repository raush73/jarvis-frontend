import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Frontend API traffic is proxied by App Router route handlers using
  // BACKEND_ORIGIN (lib/backendOrigin.ts). Do not rewrite /api/:path* here:
  // array rewrites run before dynamic routes, and an IPv6 literal destination
  // makes Next's rewrite proxy fail with 500.
};

export default nextConfig;
