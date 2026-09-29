import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
