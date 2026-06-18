const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.clerk.services https://www.mercadopago.com.ar https://www.mercadopago.com https://*.mercadopago.com https://*.google.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://img.clerk.com https://beel-media.s3.amazonaws.com https://*.cloudfront.net https://www.mercadopago.com https://www.google.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://api.beel.mx https://clerk.beel.mx wss://api.beel.mx https://js.clerk.services https://www.mercadopago.com https://api.mercadopago.com https://*.google-analytics.com https://*.analytics.google.com",
  "frame-src 'self' https://www.mercadopago.com https://www.mercadopago.com.ar https://*.mercadopago.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "beel-media.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Content-Security-Policy", value: cspHeader },
        ],
      },
    ];
  },
};

export default nextConfig;
