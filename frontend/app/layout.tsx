import type { Metadata, Viewport } from "next";
import { Quicksand, Caveat, Inter } from "next/font/google";

import "./globals.css";

import { cn } from "@/lib/utils";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { ActiveThemeProvider } from "@/components/active-theme";
import { ThemeSync } from "@/components/theme-sync";
import { THEME_BOOT_SCRIPT } from "@/lib/themes";
import { KeyboardNav } from "@/components/keyboard-nav";
import { Toaster } from "sonner";
import { CurrencyProvider } from "@/context/CurrencyContext";

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
  display: "swap",
});

// Inter lleva la interfaz: neutra, pensada para pantalla, con acentos y
// signos de apertura (¿ ¡ ñ) bien dibujados y cifras de ancho fijo para que
// las columnas de importes no bailen.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Syncro CRM",
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
import { DesktopUpdateBadge } from "@/components/desktop-update-badge";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" translate="no" className={cn("notranslate", inter.variable, quicksand.variable, caveat.variable)} suppressHydrationWarning>
      <head>
        {/* The chosen colour theme, before the first paint (no flash of the default one) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
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
                  <script src="https://app.theandeans.com/embed/inbox-loader.js"></script>
<script>
  KoenyxInbox.init({
    getToken: () =>
      fetch("https://app.theandeans.com/api/public/v1/embed/sessions", {
        method: "POST",
        headers: {
          Authorization: Bearer kx_Hnj6dhCEHJR_ogsWN_G_0q6_daui4I61cvTeR1UjQ6g,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "agente@tudominio.com",
          name: "Demo",
        }),
      })
        .then((r) => r.json())
        .then((d) => d.token),
  })
</script>
              })();
              
            `
        
          }
        }

        />
        
        {/* Una sola paleta para toda la app: forcedTheme fija el tema y deja
            sin efecto cualquier conmutador de claro/oscuro que quede suelto. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <NotificationsProvider>
            <CurrencyProvider>
              <ActiveThemeProvider>
                {children}
                <ThemeSync />
                <SessionMonitor timeoutMinutes={15} />
                <DesktopUpdateBadge />
                <KeyboardNav />
                <Toaster position="top-right" closeButton visibleToasts={4} />
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
