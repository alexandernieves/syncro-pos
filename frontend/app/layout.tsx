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
  other: {
    google: "notranslate",
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
    <html lang="es" translate="no" className="notranslate bg-[#09090b]" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={cn(
          "bg-background overscroll-none font-sans antialiased notranslate"
        )}
      >
        {/* Script to remove bis_skin_checked attribute added by Bitdefender extension to prevent React hydration mismatch */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const removeBis = (el) => {
                  if (el.nodeType === 1) {
                    if (el.hasAttribute('bis_skin_checked')) {
                      el.removeAttribute('bis_skin_checked');
                    }
                    const children = el.getElementsByTagName('*');
                    for (let i = 0; i < children.length; i++) {
                      if (children[i].hasAttribute('bis_skin_checked')) {
                        children[i].removeAttribute('bis_skin_checked');
                      }
                    }
                  }
                };
                removeBis(document.documentElement);
                const observer = new MutationObserver((mutations) => {
                  for (let i = 0; i < mutations.length; i++) {
                    const m = mutations[i];
                    if (m.type === 'attributes' && m.attributeName === 'bis_skin_checked') {
                      m.target.removeAttribute('bis_skin_checked');
                    } else if (m.type === 'childList') {
                      for (let j = 0; j < m.addedNodes.length; j++) {
                        removeBis(m.addedNodes[j]);
                      }
                    }
                  }
                });
                observer.observe(document.documentElement, {
                  attributes: true,
                  childList: true,
                  subtree: true,
                  attributeFilter: ['bis_skin_checked']
                });
              })();
            `
          }}
        />
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
                <Toaster position="top-right" closeButton />
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
