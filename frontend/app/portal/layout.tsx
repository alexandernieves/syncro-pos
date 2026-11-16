import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Syncro Credit",
  description: "Accede a tus créditos y realiza pagos en línea.",
  manifest: "/manifest-portal.json",
  icons: {
    icon: [{ url: "/sc-icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/sc-apple-touch.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Syncro Credit",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#F26B3A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// Syncro's palette for the whole PWA (globals.css → html.syncro-credit), set before the first
// paint so the splash and the page never flash the old colours. Dialogs live in <body>, so it
// goes on <html>.
const PALETTE_SCRIPT = `document.documentElement.classList.add('syncro-credit');
// Android offers the install once, when the page loads (maybe before logging in): keep it for later
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); window.__scInstall = e; });`;

export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PALETTE_SCRIPT }} />
      {children}
    </>
  );
}
