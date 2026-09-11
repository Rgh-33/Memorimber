import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @param {string} phase @returns {import('next').NextConfig} */
const nextConfig = (phase) => ({
  reactStrictMode: true,
  async headers() {
    return [{ source: "/sw.js", headers: [
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      { key: "Content-Type", value: "application/javascript; charset=utf-8" },
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
    ] }];
  },
  // Keep this branch's live CSS/JS separate from builds and other previews.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-konohaan-dev" : ".next",
});

export default nextConfig;
