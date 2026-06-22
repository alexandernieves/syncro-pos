import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/dashboard/pos",
        destination: "/pos",
        permanent: true,
      },
    ];
  },
  // ── Security Headers ──────────────────────────────────────────────────────
  // NOTE: headers() is only applied in Next.js server mode.
  // For static export (output: 'export'), configure these headers in your
  // CDN/hosting provider (Render, Vercel, Cloudflare Pages, etc.)
  // The values below serve as documentation for what your host should set.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // XSS protection (legacy browsers)
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Referrer policy
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(self), interest-cohort=()",
          },
          // HSTS — force HTTPS for 1 year
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://api.mapbox.com",   // unsafe-inline needed for Next.js hydration, api.mapbox.com for map scripts
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: https: blob: https://*.mapbox.com",
              "connect-src 'self' https: wss: http://localhost:9000 ws://localhost:9000 https://*.mapbox.com",      // Allow API + WebSocket + Mapbox calls
              "worker-src 'self' blob:",
              "child-src 'self' blob:",
              "media-src 'self' https: blob:",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
