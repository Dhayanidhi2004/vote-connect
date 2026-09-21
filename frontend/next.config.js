const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");

module.exports = (phase) => {
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    reactStrictMode: true,
    // Keep dev and production artifacts separate so `next dev` and `next build`
    // cannot corrupt the same output tree.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next-prod",
  };

  return nextConfig;
};
