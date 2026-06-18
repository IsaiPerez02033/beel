import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "@/styles/globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Beel — Hospedajes únicos en México",
    template: "%s | Beel",
  },
  description:
    "Encuentra y reserva hospedajes únicos en Mérida y toda la Península de Yucatán. Casas, departamentos y villas con anfitriones locales.",
  keywords: ["hospedajes", "mérida", "yucatán", "airbnb", "alquiler", "vacaciones"],
  authors: [{ name: "Beel" }],
  creator: "Beel",
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "https://beel.mx",
    siteName: "Beel",
    title: "Beel — Hospedajes únicos en México",
    description: "Encuentra y reserva hospedajes únicos en Mérida y la Península de Yucatán.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#147A5C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const inner = (
    <html lang="es" className={`${plusJakarta.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );

  if (!clerkKey) {
    return inner;
  }

  return (
    <ClerkProvider
      publishableKey={clerkKey}
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: "#147A5C",
          colorText: "#2C2C2A",
          colorBackground: "#FFFFFF",
        },
      }}
    >
      {inner}
    </ClerkProvider>
  );
}
