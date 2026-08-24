import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  // `tsc` already runs separately in dev and CI on every change — re-running
  // it inside `next build` is redundant work that has crashed with OOM on
  // the small (1GB RAM) deploy droplet. Skip it at build time.
  typescript: { ignoreBuildErrors: true },
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
