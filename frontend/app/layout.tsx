import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter, Fraunces } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { ThemeProvider, themeInitScript } from "@/contexts/ThemeContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import SplashWrapper from "@/components/SplashWrapper";
import DemoBanner from "@/components/DemoBanner";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import InstallPrompt from "@/components/InstallPrompt";
import BottomNav from "@/components/BottomNav";
import "@/styles/globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
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
    "Encuentra y reserva hospedajes únicos en todo México. Casas, departamentos y villas con anfitriones locales.",
  keywords: ["hospedajes", "méxico", "airbnb", "alquiler", "vacaciones", "casas", "departamentos"],
  authors: [{ name: "Beel" }],
  creator: "Beel",
  icons: {
    icon: "/beel_icon_app.png",
    apple: "/apple-touch-icon.png",
    shortcut: "/beel_icon_app.png",
  },
  appleWebApp: {
    capable: true,
    title: "Beel",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "https://beel.mx",
    siteName: "Beel",
    title: "Beel — Hospedajes únicos en México",
    description: "Encuentra y reserva hospedajes únicos en todo México.",
    images: [{ url: "/beel_logo_white_green.png", width: 600, height: 600, alt: "Beel" }],
  },
  twitter: {
    card: "summary",
    title: "Beel — Hospedajes únicos en México",
    description: "Encuentra y reserva hospedajes únicos en todo México.",
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
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <CurrencyProvider>
        <FavoritesProvider>
        <ThemeProvider>
          <html lang="es" className={`${plusJakarta.variable} ${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
            <head>
              <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
            </head>
            <body>
              <ServiceWorkerRegister />
              <InstallPrompt />
              <DemoBanner />
              <SplashWrapper>{children}</SplashWrapper>
              <BottomNav />
            </body>
          </html>
        </ThemeProvider>
        </FavoritesProvider>
      </CurrencyProvider>
    </SessionProvider>
  );
}
