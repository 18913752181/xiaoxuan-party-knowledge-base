/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the local development cache separate from production builds.
  // This prevents `next build` (used before deployment) from overwriting
  // chunks that a running `next dev` server is still serving.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  // Windows local builds cannot always create pnpm symlinks for standalone output.
  // Production keeps standalone; set NEXT_DISABLE_STANDALONE=1 only for local verification.
  output: process.env.NEXT_DISABLE_STANDALONE === "1" ? undefined : "standalone"
};

export default nextConfig;
