import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Smaller production image for VPS / Docker
  output: "standalone",
};

export default nextConfig;
