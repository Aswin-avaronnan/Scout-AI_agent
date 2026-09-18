const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ? process.env.NEXT_PUBLIC_API_BASE_URL.trim() : '';

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://avatars.githubusercontent.com https://github.com;
  font-src 'self';
  connect-src 'self' ${apiBaseUrl} http://localhost:7860 https://*.ingest.sentry.io https://*.ingest.us.sentry.io;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: cspHeader },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

// Wrap with Sentry config for source map uploads and performance monitoring.
// Using /config import path as required by @sentry/nextjs v10+.
const { withSentryConfig } = require("@sentry/nextjs/config");

module.exports = withSentryConfig(nextConfig, {
  org: "avdeisgns",
  project: "catalyst-scout-frontend",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors.
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
