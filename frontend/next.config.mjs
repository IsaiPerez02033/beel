const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const apiOrigin = (() => {
  try {
    const u = new URL(apiUrl);
    return u.origin;
  } catch {
    return apiUrl;
  }
})();
const wsOrigin = apiOrigin.replace(/^http/, "ws");

const cspHeader = [
  "default-src 'self' 'unsafe-inline' data: blob:",
  `script-src 'self' 'unsafe-inline' https://accounts.google.com https://www.mercadopago.com.ar https://www.mercadopago.com https://*.mercadopago.com https://*.google.com https://www.googletagmanager.com https://maps.googleapis.com https://maps.gstatic.com`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://maps.googleapis.com https://maps.gstatic.com`,
  `img-src 'self' data: blob: ${apiOrigin} https://lh3.googleusercontent.com https://*.googleusercontent.com https://images.unsplash.com https://*.supabase.co https://*.cloudfront.net https://www.mercadopago.com https://www.google.com https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com https://maps.gstatic.com`,
  `connect-src 'self' ${apiOrigin} ${wsOrigin} https://accounts.google.com https://www.mercadopago.com https://api.mercadopago.com https://*.google-analytics.com https://*.analytics.google.com https://open.er-api.com https://maps.googleapis.com https://*.googleapis.com`,
  `frame-src 'self' https://accounts.google.com https://www.mercadopago.com https://www.mercadopago.com.ar https://*.mercadopago.com`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "worker-src 'self' blob:",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.cloudfront.net" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },

  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
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
