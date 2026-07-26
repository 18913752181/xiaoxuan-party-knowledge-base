/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the local development cache separate from production builds.
  // This prevents `next build` (used before deployment) from overwriting
  // chunks that a running `next dev` server is still serving.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  output: "standalone"
};

export default nextConfig;
