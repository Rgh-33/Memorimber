import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @param {string} phase @returns {import('next').NextConfig} */
const nextConfig = (phase) => ({
  reactStrictMode: true,
  // Keep this branch's live CSS/JS separate from builds and other previews.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-konohaan-dev" : ".next",
});

export default nextConfig;
