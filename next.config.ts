import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone — a self-contained server with only the node_modules
  // actually reached at runtime. It is what lets the Docker image ship ~200MB
  // instead of carrying the full dependency tree, and it is why the runner
  // stage copies three paths rather than the whole project.
  output: "standalone",

  // The Convex backend lives in `convex/` and is typechecked by its own
  // tsconfig (`npm run typecheck`). Next's build would otherwise try to
  // compile it under the app's config, where the generated server types do
  // not apply.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
