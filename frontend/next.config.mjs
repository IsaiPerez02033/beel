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
  "default-src 'self'",
  // Clerk carga su JS desde *.clerk.accounts.dev (dev) y clerk.com (prod)
  `script-src 'self' 'unsafe-inline' https://js.clerk.services https://*.clerk.accounts.dev https://clerk.com https://*.clerk.com https://www.mercadopago.com.ar https://www.mercadopago.com https://*.mercadopago.com https://*.google.com https://www.googletagmanager.com`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.clerk.accounts.dev https://*.clerk.com`,
  `img-src 'self' data: blob: ${apiOrigin} https://img.clerk.com https://*.clerk.com https://images.unsplash.com https://beel-media.s3.amazonaws.com https://*.cloudfront.net https://www.mercadopago.com https://www.google.com`,
  `font-src 'self' https://fonts.gstatic.com`,
  // Clerk necesita conectarse a sus APIs para verificar sesiones
  `connect-src 'self' ${apiOrigin} ${wsOrigin} https://api.beel.mx https://clerk.beel.mx wss://api.beel.mx https://js.clerk.services https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com https://www.mercadopago.com https://api.mercadopago.com https://*.google-analytics.com https://*.analytics.google.com`,
  `frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://www.mercadopago.com https://www.mercadopago.com.ar https://*.mercadopago.com`,
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
      { protocol: "https", hostname: "beel-media.s3.amazonaws.com" },
      { protocol: "https", hostname: "*.cloudfront.net" },
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
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
