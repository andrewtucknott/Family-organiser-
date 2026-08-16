import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; it must stay external to the server bundle.
  serverExternalPackages: ["better-sqlite3"],
  // Emit a self-contained server so the Docker image doesn't need node_modules.
  output: "standalone",
};

export default nextConfig;
