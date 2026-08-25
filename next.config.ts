import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

// Next.js's Server Actions reject requests whose Origin doesn't match a
// known host, as CSRF protection. Behind a reverse proxy on an IP/domain
// Next isn't aware of, that rejects real logins from the admin UI (and any
// other form using a server action) — so trust whatever host this app is
// actually being served from.
const publicServerHost = process.env.PAYLOAD_PUBLIC_SERVER_URL
  ? new URL(process.env.PAYLOAD_PUBLIC_SERVER_URL).host
  : undefined;

const nextConfig: NextConfig = {
  // `tsc` already runs separately in dev and CI on every change — re-running
  // it inside `next build` is redundant work that has crashed with OOM on
  // the small (1GB RAM) deploy droplet. Skip it at build time.
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverActions: {
      allowedOrigins: publicServerHost ? [publicServerHost] : undefined,
    },
  },
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
