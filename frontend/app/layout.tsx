import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
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
  icons: {
    icon: "/beel_icon_app.png",
    apple: "/beel_symbol_app.png",
    shortcut: "/beel_icon_app.png",
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "https://beel.mx",
    siteName: "Beel",
    title: "Beel — Hospedajes únicos en México",
    description: "Encuentra y reserva hospedajes únicos en Mérida y la Península de Yucatán.",
    images: [{ url: "/beel_logo_white_green.png", width: 600, height: 600, alt: "Beel" }],
  },
  twitter: {
    card: "summary",
    title: "Beel — Hospedajes únicos en México",
    description: "Encuentra y reserva hospedajes únicos en Mérida y la Península de Yucatán.",
    images: ["/beel_logo_white_green.png"],
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
  return (
    <SessionProvider>
      <CurrencyProvider>
        <html lang="es" className={`${plusJakarta.variable} ${inter.variable}`}>
          <body>{children}</body>
        </html>
      </CurrencyProvider>
    </SessionProvider>
  );
}
