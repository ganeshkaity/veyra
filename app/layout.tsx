import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { AlertModalProvider } from "@/components/providers/AlertModalProvider";
import { PwaProvider } from "@/components/providers/PwaProvider";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#090e17" },
  ],
};

export const metadata: Metadata = {
  title: "Veyra — Har Baat, Apno Ke Saath.",
  description:
    "A modern, premium, secure web-based messaging application built with Firebase and Next.js.",
  manifest: "/manifest.json?v=2.0.0",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Veyra",
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/icons/icon-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512x512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json?v=2.0.0" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="application-name" content="Veyra" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var stored = localStorage.getItem('veyra_theme');
                if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)]">
        <ThemeProvider>
          <AuthProvider>
            <AlertModalProvider>
              <PwaProvider>{children}</PwaProvider>
            </AlertModalProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
