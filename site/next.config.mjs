/** @type {import('next').NextConfig} */
export default {
  images: {
    // Directus serves assets from its own origin; in production that is the
    // same App Platform app under /admin.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  poweredByHeader: false,
};
