import type { Metadata, Viewport } from "next";

import "./globals.css";

import { cn } from "@/lib/utils";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { ActiveThemeProvider } from "@/components/active-theme";
import { Toaster } from "sonner";
import { CurrencyProvider } from "@/context/CurrencyContext";

export const metadata: Metadata = {
  title: "SYNCRO POS",
  description: "Sistema de gestión y auditoría comercial premium.",
  manifest: "/manifest.json",
  icons: {
    icon: "/syncro.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

import { NotificationsProvider } from "@/context/NotificationsContext";
import { SessionMonitor } from "@/components/session-monitor";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={cn(
          "bg-background overscroll-none font-sans antialiased"
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          enableColorScheme
        >
          <NotificationsProvider>
            <CurrencyProvider>
              <ActiveThemeProvider>
                {children}
                <SessionMonitor timeoutMinutes={15} />
                <Toaster position="top-right" />
                <script
                  dangerouslySetInnerHTML={{
                    __html: `
                      if ('serviceWorker' in navigator) {
                        window.addEventListener('load', function() {
                          navigator.serviceWorker.register('/sw.js').then(function(registration) {
                            console.log('ServiceWorker registration successful');
                          }, function(err) {
                            console.log('ServiceWorker registration failed: ', err);
                          });
                        });
                      }
                    `,
                  }}
                />
              </ActiveThemeProvider>
            </CurrencyProvider>
          </NotificationsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
